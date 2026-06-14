import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { API_SERVICE_CONFIGS, ApiServiceType } from '@/lib/api-hub-types'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// Simple encryption for API keys (in production, use a proper KMS)
function encryptApiKey(apiKey: string): string {
  const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
  return Buffer.from(`${salt}:${apiKey}`).toString('base64')
}

function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// GET - Fetch all API keys for user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' }
    })

    // Mask API keys for security
    const maskedKeys = apiKeys.map(key => ({
      ...key,
      apiKey: key.apiKey.length > 8 
        ? key.apiKey.substring(0, 4) + '...' + key.apiKey.substring(key.apiKey.length - 4)
        : '****',
      // Include full key only for display in modal (will be re-encrypted)
      _rawKey: undefined
    }))

    return NextResponse.json(maskedKeys)
  } catch (error) {
    console.error('API Hub GET Error:', error)
    return NextResponse.json({ error: 'Error al obtener claves' }, { status: 500 })
  }
}

// POST - Create or update API key
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { serviceType, name, apiKey, baseUrl } = body

    if (!serviceType || !apiKey) {
      return NextResponse.json(
        { error: 'Tipo de servicio y API key son requeridos' },
        { status: 400 }
      )
    }

    // Validate service type
    if (!API_SERVICE_CONFIGS[serviceType as ApiServiceType] && serviceType !== 'custom') {
      return NextResponse.json(
        { error: 'Tipo de servicio inválido' },
        { status: 400 }
      )
    }

    const config = API_SERVICE_CONFIGS[serviceType as ApiServiceType]
    const serviceName = name || config?.name || 'API Personalizada'

    // Check if key already exists for this service
    const existing = await prisma.apiKey.findFirst({
      where: {
        userId: session.user.id,
        serviceType: serviceType
      }
    })

    // Plan gate: only check when creating NEW key (not updating)
    if (!existing) {
      const gate = await checkPlanGate(session.user.id, 'api_keys')
      if (!gate.allowed) {
        return NextResponse.json({ error: 'plan_limit', gate }, { status: 403 })
      }
    }

    if (existing) {
      // Update existing
      const updated = await prisma.apiKey.update({
        where: { id: existing.id },
        data: {
          name: serviceName,
          apiKey: encryptApiKey(apiKey),
          baseUrl: baseUrl || config?.baseUrl,
          status: 'inactive',
          updatedAt: new Date()
        }
      })
      return NextResponse.json(updated)
    }

    // Create new
    const newKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        serviceType,
        name: serviceName,
        apiKey: encryptApiKey(apiKey),
        baseUrl: baseUrl || config?.baseUrl,
        status: 'inactive',
        usageCount: 0
      }
    })

    return NextResponse.json(newKey)
  } catch (error) {
    console.error('API Hub POST Error:', error)
    return NextResponse.json({ error: 'Error al guardar clave' }, { status: 500 })
  }
}

// DELETE - Remove API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    // Verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'Clave no encontrada' }, { status: 404 })
    }

    await prisma.apiKey.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API Hub DELETE Error:', error)
    return NextResponse.json({ error: 'Error al eliminar clave' }, { status: 500 })
  }
}
