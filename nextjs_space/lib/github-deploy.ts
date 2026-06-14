/**
 * Sprint S2: GitHub Auto-Push
 * Creates a new GitHub repo and pushes all Code Engine session files to it.
 * Uses the GitHub REST API — no git binary needed.
 * Credentials come from ArmConnection (armType: 'github').
 */

import { prisma } from '@/lib/prisma'

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface GitHubCredentials {
  token: string
  username: string
}

export interface GitHubFile {
  path: string   // e.g. "index.html", "css/style.css"
  content: string // raw file content (will be base64-encoded)
}

export interface GitHubPushResult {
  success: boolean
  repoUrl?: string
  repoName?: string
  filesCount?: number
  error?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET CREDENTIALS
// ═══════════════════════════════════════════════════════════════════════════════

export async function getGitHubCredentials(userId: string): Promise<GitHubCredentials | null> {
  const conn = await prisma.armConnection.findFirst({
    where: { userId, armType: 'github', status: 'connected' },
    select: { credentials: true },
  })
  if (!conn) return null
  try {
    const creds = JSON.parse(conn.credentials)
    if (!creds.token || !creds.username) return null
    return { token: creds.token, username: creds.username }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const GITHUB_API = 'https://api.github.com'

async function githubFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export async function createRepository(
  token: string,
  name: string,
  description: string = 'Generado por Octopus Code Engine'
): Promise<{ success: boolean; repoName: string; error?: string }> {
  // Sanitize repo name: lowercase, replace spaces with hyphens, remove special chars
  const sanitized = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_.]/g, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'octopus-project'

  const { ok, data } = await githubFetch(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name: sanitized,
      description,
      private: false,
      auto_init: false, // We'll create the initial commit ourselves
    }),
  })

  if (!ok) {
    // If repo already exists (422), that's fine — we'll push to it
    if (data?.errors?.[0]?.message?.includes('already exists')) {
      return { success: true, repoName: sanitized }
    }
    return {
      success: false,
      repoName: sanitized,
      error: data?.message || `GitHub API error: ${JSON.stringify(data)}`,
    }
  }

  return { success: true, repoName: data.name || sanitized }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH FILES VIA GIT TREES API (atomic commit)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pushes multiple files to a GitHub repo in a single atomic commit.
 * Uses the low-level Git Trees API for efficiency:
 * 1. Create blobs for each file
 * 2. Create a tree referencing all blobs
 * 3. Create a commit pointing to the tree
 * 4. Update the default branch ref
 */
export async function pushFilesToRepo(
  token: string,
  owner: string,
  repo: string,
  files: GitHubFile[],
  commitMessage: string = '🐙 Proyecto generado por Octopus Code Engine'
): Promise<{ success: boolean; error?: string }> {
  if (files.length === 0) {
    return { success: false, error: 'No hay archivos para subir' }
  }

  try {
    // Step 1: Get the current default branch ref (if repo has commits)
    let parentSha: string | null = null
    let baseTreeSha: string | null = null
    
    const refRes = await githubFetch(token, `/repos/${owner}/${repo}/git/ref/heads/main`)
    if (refRes.ok) {
      parentSha = refRes.data.object?.sha
      // Get the tree SHA from the parent commit
      const commitRes = await githubFetch(token, `/repos/${owner}/${repo}/git/commits/${parentSha}`)
      if (commitRes.ok) {
        baseTreeSha = commitRes.data.tree?.sha
      }
    }

    // Step 2: Create blobs for each file
    const treeItems: { path: string; mode: string; type: string; sha: string }[] = []
    
    for (const file of files) {
      const blobRes = await githubFetch(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({
          content: Buffer.from(file.content, 'utf-8').toString('base64'),
          encoding: 'base64',
        }),
      })
      if (!blobRes.ok) {
        console.warn(`[GitHubDeploy] Failed to create blob for ${file.path}:`, blobRes.data)
        continue
      }
      treeItems.push({
        path: file.path.replace(/^\/+/, ''), // Remove leading slashes
        mode: '100644', // Regular file
        type: 'blob',
        sha: blobRes.data.sha,
      })
    }

    if (treeItems.length === 0) {
      return { success: false, error: 'No se pudo crear ningún blob — verifica tus permisos de GitHub' }
    }

    // Step 3: Create tree
    const treeBody: Record<string, unknown> = { tree: treeItems }
    if (baseTreeSha) treeBody.base_tree = baseTreeSha
    
    const treeRes = await githubFetch(token, `/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify(treeBody),
    })
    if (!treeRes.ok) {
      return { success: false, error: `Error creando tree: ${treeRes.data?.message}` }
    }

    // Step 4: Create commit
    const commitBody: Record<string, unknown> = {
      message: commitMessage,
      tree: treeRes.data.sha,
    }
    if (parentSha) commitBody.parents = [parentSha]
    
    const commitRes = await githubFetch(token, `/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify(commitBody),
    })
    if (!commitRes.ok) {
      return { success: false, error: `Error creando commit: ${commitRes.data?.message}` }
    }

    // Step 5: Update or create the ref
    if (parentSha) {
      // Update existing ref
      const updateRes = await githubFetch(token, `/repos/${owner}/${repo}/git/refs/heads/main`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commitRes.data.sha, force: true }),
      })
      if (!updateRes.ok) {
        return { success: false, error: `Error actualizando ref: ${updateRes.data?.message}` }
      }
    } else {
      // Create new ref (first commit)
      const createRefRes = await githubFetch(token, `/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        body: JSON.stringify({ ref: 'refs/heads/main', sha: commitRes.data.sha }),
      })
      if (!createRefRes.ok) {
        return { success: false, error: `Error creando ref: ${createRefRes.data?.message}` }
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ORCHESTRATOR: Collect files from session → Create repo → Push
// ═══════════════════════════════════════════════════════════════════════════════

export async function deployToGitHub(
  userId: string,
  sessionId: string,
  projectName?: string
): Promise<GitHubPushResult> {
  // 1. Get credentials
  const creds = await getGitHubCredentials(userId)
  if (!creds) {
    return { success: false, error: 'No hay credenciales de GitHub configuradas. Conecta tu cuenta en Brazos Activos.' }
  }

  // 2. Collect all write_file commands from the session
  const commands = await prisma.bridgeCommand.findMany({
    where: {
      sessionId,
      type: 'write_file',
      status: { in: ['completed', 'approved', 'executing'] },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (commands.length === 0) {
    return { success: false, error: 'No hay archivos en esta sesión. Genera un proyecto primero.' }
  }

  // Build file map (last write wins for each path)
  const fileMap = new Map<string, string>()
  for (const cmd of commands) {
    try {
      const payload = JSON.parse(cmd.payload as string)
      const path = (payload.path || payload.filePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
      const content = payload.content || ''
      if (path && content) fileMap.set(path, content)
    } catch { /* skip malformed */ }
  }

  const files: GitHubFile[] = Array.from(fileMap.entries()).map(([path, content]) => ({ path, content }))
  if (files.length === 0) {
    return { success: false, error: 'No se encontraron archivos válidos en la sesión.' }
  }

  // 3. Determine repo name from session title or project name
  const session = await prisma.codeSession.findUnique({ where: { id: sessionId }, select: { title: true } })
  const repoName = projectName || session?.title || 'octopus-project'

  // 4. Create repo
  const createResult = await createRepository(creds.token, repoName)
  if (!createResult.success) {
    return { success: false, error: createResult.error || 'Error creando repositorio' }
  }

  // 5. Push files
  const pushResult = await pushFilesToRepo(
    creds.token,
    creds.username,
    createResult.repoName,
    files,
    `🐙 ${files.length} archivos — generado por Octopus Code Engine`
  )

  if (!pushResult.success) {
    return { success: false, error: pushResult.error }
  }

  const repoUrl = `https://github.com/${creds.username}/${createResult.repoName}`
  return {
    success: true,
    repoUrl,
    repoName: createResult.repoName,
    filesCount: files.length,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIST USER REPOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface GitHubRepo {
  name: string
  full_name: string
  description: string | null
  html_url: string
  updated_at: string
  language: string | null
  private: boolean
  default_branch: string
}

export async function listUserRepos(
  token: string,
  page: number = 1,
  perPage: number = 20
): Promise<{ repos: GitHubRepo[]; error?: string }> {
  const { ok, data } = await githubFetch(
    token,
    `/user/repos?sort=updated&direction=desc&per_page=${perPage}&page=${page}&type=owner`
  )
  if (!ok) return { repos: [], error: data?.message || 'Error listing repos' }
  return {
    repos: (data as GitHubRepo[]).map((r: GitHubRepo) => ({
      name: r.name,
      full_name: r.full_name,
      description: r.description,
      html_url: r.html_url,
      updated_at: r.updated_at,
      language: r.language,
      private: r.private,
      default_branch: r.default_branch || 'main',
    })),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRANCHES — List, create, and manage branches
// ═══════════════════════════════════════════════════════════════════════════════

export interface GitHubBranch {
  name: string
  sha: string
  protected: boolean
  isDefault: boolean
}

/**
 * List all branches of a repository.
 */
export async function listBranches(
  token: string,
  owner: string,
  repo: string
): Promise<{ branches: GitHubBranch[]; defaultBranch: string; error?: string }> {
  // First get repo info for default branch
  const repoRes = await githubFetch(token, `/repos/${owner}/${repo}`)
  const defaultBranch = repoRes.ok ? (repoRes.data.default_branch || 'main') : 'main'

  const { ok, data } = await githubFetch(
    token,
    `/repos/${owner}/${repo}/branches?per_page=100`
  )
  if (!ok) return { branches: [], defaultBranch, error: data?.message || 'Error listing branches' }
  return {
    branches: (data as { name: string; commit: { sha: string }; protected: boolean }[]).map(b => ({
      name: b.name,
      sha: b.commit?.sha || '',
      protected: b.protected || false,
      isDefault: b.name === defaultBranch,
    })),
    defaultBranch,
  }
}

/**
 * Create a new branch from an existing branch (defaults to main).
 */
export async function createBranch(
  token: string,
  owner: string,
  repo: string,
  newBranch: string,
  fromBranch: string = 'main'
): Promise<{ success: boolean; error?: string }> {
  // Get the SHA of the source branch
  const refRes = await githubFetch(token, `/repos/${owner}/${repo}/git/ref/heads/${fromBranch}`)
  if (!refRes.ok) {
    return { success: false, error: `Branch '${fromBranch}' not found` }
  }
  const sha = refRes.data.object?.sha
  if (!sha) return { success: false, error: 'Could not resolve branch SHA' }

  // Create the new branch
  const createRes = await githubFetch(token, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha }),
  })
  if (!createRes.ok) {
    const msg = createRes.data?.message || 'Error creating branch'
    return { success: false, error: msg.includes('Reference already exists') ? `Branch '${newBranch}' already exists` : msg }
  }
  return { success: true }
}

/**
 * Merge one branch into another.
 */
export async function mergeBranches(
  token: string,
  owner: string,
  repo: string,
  head: string,
  base: string,
  commitMessage?: string
): Promise<{ success: boolean; sha?: string; error?: string }> {
  const res = await githubFetch(token, `/repos/${owner}/${repo}/merges`, {
    method: 'POST',
    body: JSON.stringify({
      base,
      head,
      commit_message: commitMessage || `Merge ${head} into ${base}`,
    }),
  })
  if (res.status === 204) {
    return { success: true } // Already merged / nothing to merge
  }
  if (!res.ok) {
    const msg = res.data?.message || 'Merge failed'
    return { success: false, error: msg.includes('Merge conflict') ? 'Merge conflict — resolve manually on GitHub' : msg }
  }
  return { success: true, sha: res.data?.sha }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMITS — List recent commits for a repo
// ═══════════════════════════════════════════════════════════════════════════════

export interface GitHubCommit {
  sha: string
  message: string
  author: string
  date: string
  url: string
}

/**
 * List recent commits for a repository (optionally on a specific branch).
 */
export async function listCommits(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
  perPage: number = 30
): Promise<{ commits: GitHubCommit[]; error?: string }> {
  const params = new URLSearchParams({ per_page: String(perPage) })
  if (branch) params.set('sha', branch)
  const { ok, data } = await githubFetch(
    token,
    `/repos/${owner}/${repo}/commits?${params.toString()}`
  )
  if (!ok) return { commits: [], error: data?.message || 'Error listing commits' }
  return {
    commits: (data as { sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string }[]).map(c => ({
      sha: c.sha,
      message: c.commit?.message?.split('\n')[0] || '',
      author: c.commit?.author?.name || 'Unknown',
      date: c.commit?.author?.date || '',
      url: c.html_url || '',
    })),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PULL/CLONE REPO — Download all files from a GitHub repo into Code Engine workspace
// ═══════════════════════════════════════════════════════════════════════════════

export interface GitHubPullResult {
  success: boolean
  files?: GitHubFile[]
  repoName?: string
  branch?: string
  error?: string
}

/**
 * Recursively fetches all files from a GitHub repo using the Git Trees API.
 * Returns an array of { path, content } objects ready to be written via Bridge.
 */
export async function pullRepoFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string = 'main'
): Promise<GitHubPullResult> {
  try {
    // Get the tree recursively
    const treeRes = await githubFetch(
      token,
      `/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`
    )
    if (!treeRes.ok) {
      return { success: false, error: treeRes.data?.message || 'Could not read repo tree' }
    }

    const tree = treeRes.data.tree as { path: string; type: string; sha: string; size?: number }[]
    // Filter: only blobs (files), skip huge files (>500KB), skip common non-source dirs
    const SKIP_DIRS = ['node_modules/', '.git/', 'dist/', 'build/', '.next/', '__pycache__/', '.yarn/']
    const blobs = tree.filter(item => {
      if (item.type !== 'blob') return false
      if ((item.size || 0) > 500_000) return false
      return !SKIP_DIRS.some(d => item.path.startsWith(d))
    })

    // Cap at 200 files to avoid massive pulls
    const cappedBlobs = blobs.slice(0, 200)

    // Fetch content for each file (parallel in batches of 10)
    const files: GitHubFile[] = []
    for (let i = 0; i < cappedBlobs.length; i += 10) {
      const batch = cappedBlobs.slice(i, i + 10)
      const results = await Promise.all(
        batch.map(async (blob) => {
          const blobRes = await githubFetch(token, `/repos/${owner}/${repo}/git/blobs/${blob.sha}`)
          if (!blobRes.ok) return null
          try {
            const content = Buffer.from(blobRes.data.content, 'base64').toString('utf-8')
            return { path: blob.path, content }
          } catch {
            return null // Binary file — skip
          }
        })
      )
      files.push(...results.filter(Boolean) as GitHubFile[])
    }

    return { success: true, files, repoName: repo, branch }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB PAGES — Auto-enable after push
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enables GitHub Pages on a repository using the main branch.
 * If Pages is already enabled, it updates the config.
 * Returns the published URL (e.g. https://username.github.io/repo-name)
 */
export async function enableGitHubPages(
  token: string,
  owner: string,
  repo: string
): Promise<{ success: boolean; pagesUrl?: string; error?: string }> {
  try {
    // Check if Pages is already enabled
    const checkRes = await githubFetch(token, `/repos/${owner}/${repo}/pages`)

    if (checkRes.ok && checkRes.data?.html_url) {
      // Already enabled — return existing URL
      console.log(`[GitHubPages] Already enabled: ${checkRes.data.html_url}`)
      return { success: true, pagesUrl: checkRes.data.html_url }
    }

    // Enable Pages — source from main branch, root
    const enableRes = await githubFetch(token, `/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      body: JSON.stringify({
        source: { branch: 'main', path: '/' },
      }),
    })

    if (enableRes.ok || enableRes.status === 201) {
      const pagesUrl = enableRes.data?.html_url || `https://${owner}.github.io/${repo}`
      console.log(`[GitHubPages] ✓ Enabled: ${pagesUrl}`)
      return { success: true, pagesUrl }
    }

    // 409 = Pages already exists but may need update
    if (enableRes.status === 409) {
      const updateRes = await githubFetch(token, `/repos/${owner}/${repo}/pages`, {
        method: 'PUT',
        body: JSON.stringify({
          source: { branch: 'main', path: '/' },
        }),
      })
      const url = updateRes.data?.html_url || `https://${owner}.github.io/${repo}`
      return { success: true, pagesUrl: url }
    }

    console.warn(`[GitHubPages] Failed to enable:`, enableRes.data)
    return {
      success: false,
      error: enableRes.data?.message || 'No se pudo activar GitHub Pages',
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error activando Pages' }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPLOY TO PRODUCTION — Push files + Enable Pages in one step
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductionDeployResult extends GitHubPushResult {
  pagesUrl?: string
  pagesError?: string
}

/**
 * Full production deploy: push to GitHub + enable Pages = live URL.
 * This is the "one-click deploy" experience.
 */
export async function deployToProduction(
  userId: string,
  sessionId: string,
  projectName?: string
): Promise<ProductionDeployResult> {
  // Step 1: Push to GitHub (reuse existing flow)
  const pushResult = await deployToGitHub(userId, sessionId, projectName)

  if (!pushResult.success || !pushResult.repoName) {
    return { ...pushResult }
  }

  // Step 2: Get credentials again for Pages API
  const creds = await getGitHubCredentials(userId)
  if (!creds) {
    return { ...pushResult, pagesError: 'Credenciales no disponibles para Pages' }
  }

  // Step 3: Enable GitHub Pages
  const pagesResult = await enableGitHubPages(creds.token, creds.username, pushResult.repoName)

  return {
    ...pushResult,
    pagesUrl: pagesResult.pagesUrl,
    pagesError: pagesResult.success ? undefined : pagesResult.error,
  }
}
