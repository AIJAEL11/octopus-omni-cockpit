import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Recommendation } from '@/lib/jarvis-types'

export const dynamic = 'force-dynamic'

// POST - Implementar una recomendación aprobada
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { recommendation, action } = body as { recommendation: Recommendation; action: 'approve' | 'reject' }

    if (!recommendation) {
      return NextResponse.json({ error: 'Recomendación requerida' }, { status: 400 })
    }

    if (action === 'reject') {
      return NextResponse.json({
        success: true,
        message: 'Recomendación rechazada',
        status: 'rejected',
      })
    }

    // Implementar según el tipo
    let result = { success: false, message: '', data: null as Record<string, unknown> | null }

    switch (recommendation.type) {
      case 'agent':
        if (recommendation.implementation.agentConfig) {
          const config = recommendation.implementation.agentConfig
          result = {
            success: true,
            message: `Agente "${config.name}" listo para ser creado`,
            data: {
              id: `agent-${Date.now()}`,
              ...config,
              icon: 'Bot',
              color: config.category === 'code' ? '#2D4A3E' : 
                     config.category === 'design' ? '#C4622D' :
                     config.category === 'data' ? '#4A90D9' : '#9B59B6',
              capabilities: [],
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              createdBy: 'JARVIS',
            },
          }
        }
        break

      case 'skill':
        if (recommendation.implementation.skillConfig) {
          const config = recommendation.implementation.skillConfig
          result = {
            success: true,
            message: `Skill "${config.name}" lista para ser creada`,
            data: {
              id: `skill-${Date.now()}`,
              ...config,
              usageCount: 0,
              isActive: true,
              createdAt: new Date().toISOString(),
              createdBy: 'JARVIS',
            },
          }
        }
        break

      case 'mcp':
        if (recommendation.implementation.mcpConfig) {
          const config = recommendation.implementation.mcpConfig
          result = {
            success: true,
            message: `MCP "${config.name}" listo para ser conectado`,
            data: {
              id: `mcp-${Date.now()}`,
              ...config,
              icon: 'Plug',
              color: '#1ABC9C',
              isConnected: false,
              version: '1.0.0',
              createdBy: 'JARVIS',
            },
          }
        }
        break

      case 'optimization':
        result = {
          success: true,
          message: 'Pasos de optimización registrados',
          data: {
            steps: recommendation.implementation.optimizationSteps || [],
          },
        }
        break

      case 'warning':
        result = {
          success: true,
          message: 'Advertencia reconocida',
          data: null,
        }
        break
    }

    return NextResponse.json({
      success: result.success,
      message: result.message,
      status: 'implemented',
      data: result.data,
      implementedAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error('JARVIS Implementation Error:', error)
    return NextResponse.json(
      { error: 'Error al implementar recomendación' },
      { status: 500 }
    )
  }
}
