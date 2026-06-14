import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// GET - Obtener configuración turbo del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { turboEnabled: true, turboModel: true, turboProvider: true },
    })

    // Obtener API keys configuradas (sin exponer el valor completo)
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id, serviceType: { startsWith: 'turbo_' } },
      select: {
        id: true,
        serviceType: true,
        name: true,
        status: true,
        lastTested: true,
        lastUsed: true,
        usageCount: true,
        apiKey: true,
      },
    })

    // Ocultar API keys (mostrar solo últimos 4 chars)
    const maskedKeys = apiKeys.map(k => ({
      ...k,
      apiKey: k.apiKey ? `${'•'.repeat(20)}${k.apiKey.slice(-4)}` : '',
      provider: k.serviceType.replace('turbo_', ''),
    }))

    return NextResponse.json({
      turboEnabled: user?.turboEnabled || false,
      turboModel: user?.turboModel || null,
      turboProvider: user?.turboProvider || null,
      apiKeys: maskedKeys,
    })
  } catch (error) {
    console.error('Error getting turbo config:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Guardar configuración turbo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'toggle': {
        // Toggle turbo on/off
        const { enabled } = body
        // Plan gate: Turbo Mode requires Pro+
        if (enabled) {
          const gate = await checkPlanGate(session.user.id, 'turbo_mode')
          if (!gate.allowed) {
            return NextResponse.json({ error: 'plan_limit', gate }, { status: 403 })
          }
        }
        await prisma.user.update({
          where: { id: session.user.id },
          data: { turboEnabled: enabled },
        })
        return NextResponse.json({ success: true, turboEnabled: enabled })
      }

      case 'set_provider': {
        // Cambiar proveedor y modelo
        const { provider, model } = body
        await prisma.user.update({
          where: { id: session.user.id },
          data: { turboProvider: provider, turboModel: model },
        })
        return NextResponse.json({ success: true })
      }

      case 'save_key': {
        // Guardar API key para un proveedor
        const { provider, apiKey: rawKey } = body
        if (!provider || !rawKey) {
          return NextResponse.json({ error: 'Provider y API key son requeridos' }, { status: 400 })
        }

        const serviceType = `turbo_${provider}`
        
        // Upsert la API key
        await prisma.apiKey.upsert({
          where: {
            userId_serviceType: {
              userId: session.user.id,
              serviceType,
            },
          },
          update: {
            apiKey: rawKey,
            status: 'active',
            updatedAt: new Date(),
          },
          create: {
            userId: session.user.id,
            serviceType,
            name: `Turbo - ${provider}`,
            apiKey: rawKey,
            status: 'active',
          },
        })

        return NextResponse.json({ success: true })
      }

      case 'delete_key': {
        // Eliminar API key de un proveedor
        const { provider: delProvider } = body
        await prisma.apiKey.deleteMany({
          where: {
            userId: session.user.id,
            serviceType: `turbo_${delProvider}`,
          },
        })
        
        // Si era el proveedor activo, desactivar turbo
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { turboProvider: true },
        })
        if (user?.turboProvider === delProvider) {
          await prisma.user.update({
            where: { id: session.user.id },
            data: { turboEnabled: false, turboProvider: null, turboModel: null },
          })
        }

        return NextResponse.json({ success: true })
      }

      case 'test_key': {
        // Probar API key
        const { provider: testProvider } = body
        const apiKeyRecord = await prisma.apiKey.findFirst({
          where: {
            userId: session.user.id,
            serviceType: `turbo_${testProvider}`,
          },
        })

        if (!apiKeyRecord) {
          return NextResponse.json({ error: 'No hay API key para este proveedor' }, { status: 404 })
        }

        // Test OpenRouter - verificar key listando modelos
        let testSuccess = false
        let testError = ''
        try {
          const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKeyRecord.apiKey}` },
          })
          testSuccess = res.ok
          if (!res.ok) {
            const errBody = await res.text().catch(() => '')
            testError = `HTTP ${res.status}${errBody ? ': ' + errBody.substring(0, 100) : ''}`
          }
        } catch (err) {
          testError = err instanceof Error ? err.message : 'Error desconocido'
        }

        // Actualizar estado
        await prisma.apiKey.update({
          where: { id: apiKeyRecord.id },
          data: {
            status: testSuccess ? 'active' : 'error',
            lastTested: new Date(),
          },
        })

        return NextResponse.json({ 
          success: testSuccess, 
          error: testError || undefined,
          status: testSuccess ? 'active' : 'error',
        })
      }

      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in turbo settings:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
