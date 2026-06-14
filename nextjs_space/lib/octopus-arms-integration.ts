/**
 * OCTOPUS RAG 2.0 Phase 2 - Arms Integration
 * 
 * Conecta los Brazos (GitHub, Gmail) con el sistema de conocimiento
 * para alimentar el Knowledge Graph y la búsqueda semántica
 */

import { prisma } from './prisma'
import { processTriples, ExtractedTriple, extractTriplesFromText } from './octopus-knowledge-graph'
import { upsertSemanticVector } from './octopus-vectors'

// ============================================
// TIPOS
// ============================================

export interface GitHubRepo {
  name: string
  description: string
  language: string
  url: string
  stars: number
  topics: string[]
}

export interface GitHubCommit {
  message: string
  date: string
  sha: string
}

export interface GmailThread {
  subject: string
  snippet: string
  from: string
  date: string
  id: string
}

export interface SyncResult {
  imported: number
  entities: number
  relations: number
  errors: string[]
}

// ============================================
// GITHUB INTEGRATION
// ============================================

/**
 * Obtiene las credenciales de GitHub del usuario
 */
async function getGitHubCredentials(userId: string): Promise<{ token: string } | null> {
  const connection = await prisma.armConnection.findUnique({
    where: {
      userId_armType: { userId, armType: 'github' }
    },
  })
  
  if (!connection || connection.status !== 'connected') return null
  
  try {
    const creds = JSON.parse(connection.credentials)
    return { token: creds.token || creds.accessToken || creds.api_token }
  } catch {
    return null
  }
}

/**
 * Obtiene repositorios del usuario de GitHub
 */
export async function fetchGitHubRepos(userId: string): Promise<GitHubRepo[]> {
  const creds = await getGitHubCredentials(userId)
  if (!creds) throw new Error('GitHub no conectado')
  
  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=30&sort=updated', {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    })
    
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
    
    const repos = await response.json()
    
    return repos.map((repo: Record<string, unknown>) => ({
      name: repo.name as string,
      description: (repo.description as string) || '',
      language: (repo.language as string) || 'Unknown',
      url: (repo.html_url as string) || '',
      stars: (repo.stargazers_count as number) || 0,
      topics: (repo.topics as string[]) || [],
    }))
  } catch (error) {
    console.error('Error fetching GitHub repos:', error)
    throw error
  }
}

/**
 * Sincroniza repos de GitHub con el Knowledge Graph
 */
export async function syncGitHubToGraph(userId: string): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, entities: 0, relations: 0, errors: [] }
  
  try {
    const repos = await fetchGitHubRepos(userId)
    
    for (const repo of repos) {
      try {
        // Save to ArmData
        await prisma.armData.upsert({
          where: {
            userId_armType_externalId: {
              userId,
              armType: 'github',
              externalId: repo.name,
            }
          },
          create: {
            userId,
            armType: 'github',
            dataType: 'repo',
            title: repo.name,
            content: `Repository: ${repo.name}\nDescription: ${repo.description}\nLanguage: ${repo.language}\nStars: ${repo.stars}\nTopics: ${repo.topics.join(', ')}`,
            metadata: JSON.stringify(repo),
            externalId: repo.name,
          },
          update: {
            content: `Repository: ${repo.name}\nDescription: ${repo.description}\nLanguage: ${repo.language}\nStars: ${repo.stars}\nTopics: ${repo.topics.join(', ')}`,
            metadata: JSON.stringify(repo),
            syncedAt: new Date(),
          },
        })
        result.imported++
        
        // Extract triples for Knowledge Graph
        const triples: ExtractedTriple[] = [
          {
            subject: { name: 'user', type: 'person' },
            predicate: 'created',
            object: { name: repo.name, type: 'project' },
          },
        ]
        
        if (repo.language && repo.language !== 'Unknown') {
          triples.push({
            subject: { name: repo.name, type: 'project' },
            predicate: 'uses',
            object: { name: repo.language.toLowerCase(), type: 'language' },
          })
        }
        
        for (const topic of repo.topics.slice(0, 5)) {
          triples.push({
            subject: { name: repo.name, type: 'project' },
            predicate: 'related_to',
            object: { name: topic, type: 'concept' },
          })
        }
        
        const processed = await processTriples(userId, triples, 'github')
        result.entities += processed.entitiesCreated
        result.relations += processed.relationsCreated
        
        // Create semantic vector for the repo
        const vectorText = `${repo.name} ${repo.description} ${repo.language} ${repo.topics.join(' ')}`
        await upsertSemanticVector(userId, 'github', repo.name, vectorText)
        
      } catch (error) {
        result.errors.push(`Error processing repo ${repo.name}: ${error}`)
      }
    }
  } catch (error) {
    result.errors.push(`Error fetching repos: ${error}`)
  }
  
  return result
}

// ============================================
// GMAIL INTEGRATION
// ============================================

/**
 * Obtiene las credenciales de Gmail del usuario
 */
async function getGmailCredentials(userId: string): Promise<{ token: string } | null> {
  const connection = await prisma.armConnection.findUnique({
    where: {
      userId_armType: { userId, armType: 'gmail' }
    },
  })
  
  if (!connection || connection.status !== 'connected') return null
  
  try {
    const creds = JSON.parse(connection.credentials)
    return { token: creds.token || creds.accessToken || creds.api_token }
  } catch {
    return null
  }
}

/**
 * Obtiene threads recientes de Gmail
 */
export async function fetchGmailThreads(userId: string): Promise<GmailThread[]> {
  const creds = await getGmailCredentials(userId)
  if (!creds) throw new Error('Gmail no conectado')
  
  try {
    // List recent threads
    const listResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=20',
      {
        headers: {
          'Authorization': `Bearer ${creds.token}`,
          'Accept': 'application/json',
        },
      }
    )
    
    if (!listResponse.ok) throw new Error(`Gmail API error: ${listResponse.status}`)
    
    const listData = await listResponse.json()
    const threads: GmailThread[] = []
    
    for (const thread of (listData.threads || []).slice(0, 10)) {
      try {
        const threadResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=metadata`,
          {
            headers: {
              'Authorization': `Bearer ${creds.token}`,
              'Accept': 'application/json',
            },
          }
        )
        
        if (threadResponse.ok) {
          const threadData = await threadResponse.json()
          const messages = threadData.messages || []
          const firstMessage = messages[0]
          
          const headers = firstMessage?.payload?.headers || []
          const subject = headers.find((h: Record<string, string>) => h.name === 'Subject')?.value || 'Sin asunto'
          const from = headers.find((h: Record<string, string>) => h.name === 'From')?.value || ''
          const date = headers.find((h: Record<string, string>) => h.name === 'Date')?.value || ''
          
          threads.push({
            id: thread.id,
            subject,
            snippet: threadData.snippet || '',
            from,
            date,
          })
        }
      } catch {
        // Skip individual thread errors
      }
    }
    
    return threads
  } catch (error) {
    console.error('Error fetching Gmail threads:', error)
    throw error
  }
}

/**
 * Sincroniza Gmail con el Knowledge Graph
 */
export async function syncGmailToGraph(userId: string): Promise<SyncResult> {
  const result: SyncResult = { imported: 0, entities: 0, relations: 0, errors: [] }
  
  try {
    const threads = await fetchGmailThreads(userId)
    
    for (const thread of threads) {
      try {
        await prisma.armData.upsert({
          where: {
            userId_armType_externalId: {
              userId,
              armType: 'gmail',
              externalId: thread.id,
            }
          },
          create: {
            userId,
            armType: 'gmail',
            dataType: 'thread',
            title: thread.subject,
            content: `Subject: ${thread.subject}\nFrom: ${thread.from}\nDate: ${thread.date}\nSnippet: ${thread.snippet}`,
            metadata: JSON.stringify(thread),
            externalId: thread.id,
          },
          update: {
            content: `Subject: ${thread.subject}\nFrom: ${thread.from}\nDate: ${thread.date}\nSnippet: ${thread.snippet}`,
            syncedAt: new Date(),
          },
        })
        result.imported++
        
        // Extract entities from email content
        const fullText = `${thread.subject} ${thread.snippet}`
        const triples = extractTriplesFromText(fullText)
        
        // Add email sender as entity
        if (thread.from) {
          const emailName = thread.from.split('<')[0].trim().replace(/"/g, '')
          if (emailName.length > 2) {
            triples.push({
              subject: { name: 'user', type: 'person' },
              predicate: 'collaborates_with',
              object: { name: emailName.toLowerCase(), type: 'person' },
              context: `From email: ${thread.subject}`,
            })
          }
        }
        
        if (triples.length > 0) {
          const processed = await processTriples(userId, triples, 'gmail')
          result.entities += processed.entitiesCreated
          result.relations += processed.relationsCreated
        }
        
        // Create semantic vector
        await upsertSemanticVector(userId, 'gmail', thread.id, `${thread.subject} ${thread.snippet}`)
        
      } catch (error) {
        result.errors.push(`Error processing thread ${thread.subject}: ${error}`)
      }
    }
  } catch (error) {
    result.errors.push(`Error fetching threads: ${error}`)
  }
  
  return result
}

// ============================================
// SEARCH ACROSS ARMS DATA
// ============================================

/**
 * Busca en datos importados de los brazos
 */
export async function searchArmData(
  userId: string,
  query: string,
  armType?: string,
  limit: number = 5
): Promise<{ id: string; armType: string; dataType: string; title: string; content: string; syncedAt: Date }[]> {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  if (queryWords.length === 0) return []
  
  const where: Record<string, unknown> = {
    userId,
    OR: queryWords.flatMap(word => [
      { title: { contains: word, mode: 'insensitive' } },
      { content: { contains: word, mode: 'insensitive' } },
    ]),
  }
  
  if (armType) {
    where.armType = armType
  }
  
  const results = await prisma.armData.findMany({
    where,
    orderBy: { syncedAt: 'desc' },
    take: limit,
  })
  
  return results.map(r => ({
    id: r.id,
    armType: r.armType,
    dataType: r.dataType,
    title: r.title,
    content: r.content.substring(0, 500),
    syncedAt: r.syncedAt,
  }))
}

/**
 * Obtiene el estado de sincronización de los brazos
 */
export async function getArmsSyncStatus(userId: string): Promise<{
  github: { connected: boolean; lastSync: Date | null; itemCount: number }
  gmail: { connected: boolean; lastSync: Date | null; itemCount: number }
}> {
  const [githubConn, gmailConn] = await Promise.all([
    prisma.armConnection.findUnique({
      where: { userId_armType: { userId, armType: 'github' } },
    }),
    prisma.armConnection.findUnique({
      where: { userId_armType: { userId, armType: 'gmail' } },
    }),
  ])
  
  const [githubData, gmailData] = await Promise.all([
    prisma.armData.findMany({
      where: { userId, armType: 'github' },
      orderBy: { syncedAt: 'desc' },
      take: 1,
    }),
    prisma.armData.findMany({
      where: { userId, armType: 'gmail' },
      orderBy: { syncedAt: 'desc' },
      take: 1,
    }),
  ])
  
  const [githubCount, gmailCount] = await Promise.all([
    prisma.armData.count({ where: { userId, armType: 'github' } }),
    prisma.armData.count({ where: { userId, armType: 'gmail' } }),
  ])
  
  return {
    github: {
      connected: githubConn?.status === 'connected',
      lastSync: githubData[0]?.syncedAt || null,
      itemCount: githubCount,
    },
    gmail: {
      connected: gmailConn?.status === 'connected',
      lastSync: gmailData[0]?.syncedAt || null,
      itemCount: gmailCount,
    },
  }
}
