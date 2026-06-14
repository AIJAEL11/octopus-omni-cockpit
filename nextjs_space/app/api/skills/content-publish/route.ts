import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateBlogImage } from '@/services/image-generator'
import { authorizePublish, type PublishDecision } from '@/lib/skills/skill-factory-service'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Decrypt API key (same as api-hub)
function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// POST - Publish content to user's configured endpoint
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  let logId: string | null = null

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content, slug, contentType = 'blog_post', metadata = {}, agentId } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title y content son requeridos' },
        { status: 400 }
      )
    }

    // 🛡️ SKILL FACTORY SECURITY PROTOCOL — Trust + Audit Gate
    const callerContext = (metadata.callerContext || (agentId === 'manual' ? 'manual' : 'api')) as 'agent-factory' | 'cron' | 'api' | 'manual' | 'external'
    const publishDecision: PublishDecision = authorizePublish({
      agentId: agentId || 'manual',
      title,
      content,
      contentType,
      callerContext,
    })

    console.log(`[Content Publisher] 🛡️ Security: mode=${publishDecision.mode}, trust=${publishDecision.trustLevel}, authorized=${publishDecision.authorized}, audit=${publishDecision.audit.audit_status}`)

    // If SAFE mode requires manual approval, block the publish
    if (publishDecision.requiresManualApproval) {
      return NextResponse.json({
        success: false,
        blocked: true,
        mode: publishDecision.mode,
        reason: publishDecision.reason,
        audit: publishDecision.audit,
        message: 'Publicación requiere aprobación manual (SAFE mode)'
      }, { status: 403 })
    }

    // If not authorized (VERIFIED agent with failed audit, or EXTERNAL), block
    if (!publishDecision.authorized) {
      return NextResponse.json({
        success: false,
        blocked: true,
        mode: publishDecision.mode,
        reason: publishDecision.reason,
        audit: publishDecision.audit,
        message: publishDecision.requiresManualApproval
          ? 'Publicación requiere aprobación manual (SAFE mode)'
          : 'Contenido no pasó la auditoría de calidad'
      }, { status: publishDecision.requiresManualApproval ? 403 : 422 })
    }

    // Get user's content_publisher API config
    const publisherConfig = await prisma.apiKey.findFirst({
      where: {
        userId: session.user.id,
        serviceType: 'content_publisher'
      }
    })

    if (!publisherConfig || !publisherConfig.baseUrl) {
      return NextResponse.json(
        { error: 'No hay endpoint de Content Publisher configurado. Ve a API Hub para configurarlo.' },
        { status: 404 }
      )
    }

    // Create initial log entry
    const log = await prisma.contentPublishLog.create({
      data: {
        userId: session.user.id,
        agentId: agentId || 'manual',
        title,
        slug: slug || generateSlug(title),
        status: 'publishing',
        contentType,
        payload: JSON.stringify({ title, content, slug, contentType, metadata }),
        metadata: JSON.stringify(metadata)
      }
    })
    logId = log.id

    // Decrypt the API key
    const apiKey = decryptApiKey(publisherConfig.apiKey)
    const endpointUrl = publisherConfig.baseUrl

    // Parse field mapping from publisherConfig.name field if it contains JSON config
    let fieldMapping: Record<string, string> = { title: 'title', content: 'content', slug: 'slug', status: 'status' }
    try {
      const configData = JSON.parse(publisherConfig.name)
      if (configData.fieldMapping) {
        fieldMapping = configData.fieldMapping
      }
    } catch {
      // name is just a plain name string, use defaults
    }

    // Build the payload based on field mapping
    const publishPayload: Record<string, unknown> = {}
    if (fieldMapping.title) publishPayload[fieldMapping.title] = title
    if (fieldMapping.content) publishPayload[fieldMapping.content] = content
    if (fieldMapping.slug) publishPayload[fieldMapping.slug] = slug || generateSlug(title)
    if (fieldMapping.status) publishPayload[fieldMapping.status] = metadata.publishStatus || 'published'

    // 🎨 Auto-generate cover image (non-blocking — won't stop publishing if it fails)
    let coverImageUrl: string | null = metadata.coverImage || null
    if (!coverImageUrl && metadata.generateImage !== false) {
      try {
        const imgResult = await generateBlogImage({
          title,
          excerpt: typeof content === 'string' ? content.substring(0, 200) : '',
          category: metadata.category || contentType,
          slug: slug || generateSlug(title),
          userId: session.user.id,
        })
        if (imgResult?.imageUrl) {
          coverImageUrl = imgResult.imageUrl
          console.log(`[Content Publisher] 🎨 Cover image generated: ${coverImageUrl.substring(0, 100)}...`)
        }
      } catch (imgErr) {
        console.warn('[Content Publisher] Image generation skipped:', imgErr)
      }
    }

    // Attach cover image to payload if generated/provided (both field names for compatibility)
    if (coverImageUrl) {
      publishPayload.cover_image = coverImageUrl
      publishPayload.coverImage = coverImageUrl
    }

    // Add any extra fields from metadata
    if (metadata.extraFields && typeof metadata.extraFields === 'object') {
      Object.assign(publishPayload, metadata.extraFields)
    }

    // Determine auth type
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-real-source': 'octopus-content-publisher',
    }
    const authType = metadata.authType || 'bearer'
    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`
    } else if (authType === 'apikey') {
      headers['apikey'] = apiKey
    } else if (authType === 'basic') {
      headers['Authorization'] = `Basic ${Buffer.from(apiKey).toString('base64')}`
    } else if (authType === 'custom_header') {
      const headerName = metadata.customHeaderName || 'X-API-Key'
      headers[headerName] = apiKey
    }

    // Make the HTTP request to user's endpoint
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(publishPayload),
      signal: controller.signal
    })

    clearTimeout(timeout)

    const duration = Date.now() - startTime
    let responseText = ''
    try {
      responseText = await response.text()
    } catch {
      responseText = 'No response body'
    }

    let publishedUrl = ''
    try {
      const respJson = JSON.parse(responseText)
      publishedUrl = respJson.url || respJson.published_url || respJson.link || ''
    } catch {
      // non-JSON response
    }

    if (response.ok) {
      // Merge coverImage into metadata for caching
      let updatedMeta = metadata
      if (coverImageUrl) {
        updatedMeta = { ...metadata, coverImage: coverImageUrl }
      }

      // Update log as success
      await prisma.contentPublishLog.update({
        where: { id: logId },
        data: {
          status: 'published',
          publishedUrl,
          response: responseText.substring(0, 5000),
          duration,
          metadata: JSON.stringify(updatedMeta),
        }
      })

      // Update usage count on the API key
      await prisma.apiKey.update({
        where: { id: publisherConfig.id },
        data: {
          usageCount: { increment: 1 },
          lastUsed: new Date(),
          status: 'active'
        }
      })

      // Track skill execution
      await prisma.skillExecution.create({
        data: {
          userId: session.user.id,
          skillId: 'content-publisher',
          method: 'publish',
          params: JSON.stringify({ title, contentType, publishedUrl }),
          success: true,
          duration,
          trigger: 'manual'
        }
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        logId,
        publishedUrl,
        coverImage: coverImageUrl,
        status: 'published',
        duration,
        security: {
          mode: publishDecision.mode,
          trustLevel: publishDecision.trustLevel,
          agent: publishDecision.agentName,
          audit_status: publishDecision.audit.audit_status,
          zero_stats_audit: publishDecision.audit.zero_stats_audit,
          quality_score: publishDecision.audit.quality_score,
        },
        message: `"${title}" publicado exitosamente`
      })
    } else {
      // Update log as error
      const errorMsg = `HTTP ${response.status}: ${responseText.substring(0, 1000)}`
      await prisma.contentPublishLog.update({
        where: { id: logId },
        data: {
          status: 'error',
          error: errorMsg,
          response: responseText.substring(0, 5000),
          duration
        }
      })

      return NextResponse.json({
        success: false,
        logId,
        error: errorMsg,
        status: 'error',
        duration
      }, { status: 502 })
    }
  } catch (error: unknown) {
    const duration = Date.now() - startTime
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'

    // Update log if we created one
    if (logId) {
      await prisma.contentPublishLog.update({
        where: { id: logId },
        data: {
          status: 'error',
          error: errorMsg,
          duration
        }
      }).catch(() => {})
    }

    console.error('[Content Publisher] Error:', errorMsg)
    return NextResponse.json({
      success: false,
      logId,
      error: errorMsg,
      status: 'error',
      duration
    }, { status: 500 })
  }
}

// GET - Fetch publish logs for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const status = searchParams.get('status')
    const cursor = searchParams.get('cursor')

    const where: Record<string, unknown> = { userId: session.user.id }
    if (status) where.status = status

    const logs = await prisma.contentPublishLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        agentId: true,
        title: true,
        slug: true,
        publishedUrl: true,
        status: true,
        contentType: true,
        error: true,
        duration: true,
        metadata: true,
        createdAt: true
      }
    })

    const hasMore = logs.length > limit
    if (hasMore) logs.pop()

    // Get summary stats
    const [total, published, errors] = await Promise.all([
      prisma.contentPublishLog.count({ where: { userId: session.user.id } }),
      prisma.contentPublishLog.count({ where: { userId: session.user.id, status: 'published' } }),
      prisma.contentPublishLog.count({ where: { userId: session.user.id, status: 'error' } })
    ])

    // Check if publisher is configured
    const config = await prisma.apiKey.findFirst({
      where: { userId: session.user.id, serviceType: 'content_publisher' },
      select: { id: true, baseUrl: true, status: true, usageCount: true, lastUsed: true }
    })

    return NextResponse.json({
      logs,
      hasMore,
      nextCursor: hasMore && logs.length > 0 ? logs[logs.length - 1].id : null,
      stats: { total, published, errors },
      configured: !!config,
      endpoint: config ? { baseUrl: config.baseUrl, status: config.status, usageCount: config.usageCount, lastUsed: config.lastUsed } : null
    })
  } catch (error) {
    console.error('[Content Publisher] GET Error:', error)
    return NextResponse.json({ error: 'Error al obtener logs' }, { status: 500 })
  }
}

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .substring(0, 100)
}
