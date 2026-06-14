import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { API_SERVICE_CONFIGS, ApiServiceType } from '@/lib/api-hub-types'

export const dynamic = 'force-dynamic'

function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// POST - Test API key connection
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    let { id, serviceType, apiKey: directKey, baseUrl } = body

    let apiKey: string
    let config = API_SERVICE_CONFIGS[serviceType as ApiServiceType]
    let testUrl: string

    if (id) {
      // Test existing key from database
      const storedKey = await prisma.apiKey.findFirst({
        where: {
          id,
          userId: session.user.id
        }
      })

      if (!storedKey) {
        return NextResponse.json({ error: 'Clave no encontrada' }, { status: 404 })
      }

      apiKey = decryptApiKey(storedKey.apiKey)
      serviceType = storedKey.serviceType
      config = API_SERVICE_CONFIGS[storedKey.serviceType as ApiServiceType]
      testUrl = (storedKey.baseUrl || config?.baseUrl || '') + (config?.testEndpoint || '/models')
    } else {
      // Test new key directly
      if (!directKey || !serviceType) {
        return NextResponse.json(
          { error: 'API key y tipo de servicio requeridos' },
          { status: 400 }
        )
      }
      apiKey = directKey
      testUrl = (baseUrl || config?.baseUrl || '') + (config?.testEndpoint || '/models')
    }

    // Update status to testing
    if (id) {
      await prisma.apiKey.update({
        where: { id },
        data: { status: 'testing' }
      })
    }

    // Resolve the effective serviceType for test logic (ugc_fal uses falai config)
    const effectiveType = (serviceType === 'ugc_fal' || (id && !config && testUrl.includes('/models'))) 
      ? 'falai' : serviceType
    
    // For ugc_fal or unrecognized fal types, use falai config
    if (!config && (serviceType === 'ugc_fal' || effectiveType === 'falai')) {
      config = API_SERVICE_CONFIGS['falai']
      testUrl = config.baseUrl + config.testEndpoint
    }

    // Build headers using config
    const headers = config?.headers(apiKey) || {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }

    console.log(`Testing API: ${testUrl} (type: ${serviceType}, effective: ${effectiveType})`)

    // Make test request
    const startTime = Date.now()
    
    // Special handling for different services
    let testResponse: Response
    
    if (serviceType === 'anthropic') {
      // Anthropic needs a POST request to /messages
      testResponse = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
    } else if (serviceType === 'perplexity') {
      // Perplexity needs a chat completion request
      testResponse = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'sonar-small-online',
          messages: [{ role: 'user', content: 'test' }]
        })
      })
    } else if (serviceType === 'falai' || serviceType === 'ugc_fal') {
      // fal.ai queue API requires POST - send minimal body to validate auth
      // A 422 (validation error) means the key is valid but params are missing = success
      testResponse = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: 'test', num_frames: 1 })
      })
      // For fal.ai: 401/403 = bad key, anything else (200/422/400) = key is valid
      if (testResponse.status === 422 || testResponse.status === 400) {
        // Key authenticated successfully, params were just invalid - treat as success
        const fakeLat = Date.now() - startTime
        if (id) {
          await prisma.apiKey.update({
            where: { id },
            data: { status: 'active', lastTested: new Date() }
          })
        }
        return NextResponse.json({
          success: true,
          latency: fakeLat,
          info: { note: 'fal.ai autenticado correctamente' },
          message: `Conexión exitosa (${fakeLat}ms)`
        })
      }
    } else if (serviceType === 'content_publisher') {
      // Content Publisher endpoints only accept POST — send a lightweight draft payload
      testResponse = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'Test Connectivity', status: 'draft' })
      })

      const cpLatency = Date.now() - startTime

      // 200/201 = success, 400/422 = endpoint reachable but payload validation = still counts as connected
      if (testResponse.ok || testResponse.status === 400 || testResponse.status === 422) {
        if (id) {
          await prisma.apiKey.update({
            where: { id },
            data: { status: 'active', lastTested: new Date() }
          })
        }
        return NextResponse.json({
          success: true,
          latency: cpLatency,
          info: { note: 'Content Publisher conectado correctamente' },
          message: `Conexión exitosa (${cpLatency}ms)`
        })
      }
      // For other error codes (401, 403, 405, 500…) fall through to the normal error handling below
    } else {
      // Most services use GET for /models
      testResponse = await fetch(testUrl, {
        method: 'GET',
        headers
      })
    }
    
    const latency = Date.now() - startTime

    if (!testResponse.ok) {
      const errorText = await testResponse.text()
      console.error(`API Test failed: ${testResponse.status}`, errorText)
      
      // Update status to error
      if (id) {
        await prisma.apiKey.update({
          where: { id },
          data: { 
            status: 'error',
            lastTested: new Date()
          }
        })
      }

      return NextResponse.json({
        success: false,
        error: `Error ${testResponse.status}: ${errorText.substring(0, 200)}`,
        latency
      })
    }

    // Success - update database
    if (id) {
      await prisma.apiKey.update({
        where: { id },
        data: {
          status: 'active',
          lastTested: new Date()
        }
      })
    }

    // Try to get some info from response
    let info: Record<string, unknown> = {}
    try {
      const data = await testResponse.json()
      if (data.data && Array.isArray(data.data)) {
        info.modelCount = data.data.length
        info.models = data.data.slice(0, 5).map((m: { id?: string; name?: string }) => m.id || m.name)
      } else if (Array.isArray(data)) {
        info.modelCount = data.length
      }
    } catch {
      // Ignore JSON parse errors
    }

    return NextResponse.json({
      success: true,
      latency,
      info,
      message: `Conexión exitosa (${latency}ms)`
    })

  } catch (error) {
    console.error('API Test Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error de conexión'
      },
      { status: 500 }
    )
  }
}
