import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Mapeo de capacidades creativas a tipos de servicio del API Hub
const CAPABILITY_MAP: Record<string, { apiHubTypes: string[]; builtIn: boolean; label: string }> = {
  image: {
    apiHubTypes: ['openai', 'stability', 'replicate', 'huggingface', 'together'],
    builtIn: true, // RouteLLM siempre disponible
    label: 'Generación de Imágenes',
  },
  video: {
    apiHubTypes: ['replicate', 'stability'],
    builtIn: true, // RouteLLM genera frames
    label: 'Generación de Video (Frames)',
  },
  copy: {
    apiHubTypes: ['openai', 'anthropic', 'groq', 'mistral', 'cohere', 'together', 'openrouter', 'perplexity'],
    builtIn: true, // RouteLLM para texto
    label: 'Generación de Copy/Texto',
  },
}

export interface CreativeCapability {
  type: string
  label: string
  available: boolean
  engine: string // 'builtin' | nombre del servicio externo
  engineLabel: string
  externalApis: Array<{
    serviceType: string
    name: string
    status: string
    icon: string
  }>
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener APIs activas del usuario desde API Hub
    const userApiKeys = await prisma.apiKey.findMany({
      where: { userId: session.user.id },
      select: {
        serviceType: true,
        name: true,
        status: true,
      },
    })

    // Verificar que ABACUSAI_API_KEY existe (motor built-in)
    const hasBuiltInKey = !!process.env.ABACUSAI_API_KEY

    // Iconos de servicios
    const serviceIcons: Record<string, string> = {
      openai: '🧠', anthropic: '🧊', groq: '⚡', stability: '🎨',
      replicate: '🔮', huggingface: '🤗', cohere: '🔍', mistral: '🌬️',
      together: '🤝', openrouter: '🌐', perplexity: '🔭', elevenlabs: '🎙️',
    }

    const capabilities: CreativeCapability[] = Object.entries(CAPABILITY_MAP).map(
      ([type, config]) => {
        // APIs externas relevantes para esta capacidad
        const externalApis = userApiKeys
          .filter((k) => config.apiHubTypes.includes(k.serviceType))
          .map((k) => ({
            serviceType: k.serviceType,
            name: k.name,
            status: k.status,
            icon: serviceIcons[k.serviceType] || '⚙️',
          }))

        const activeExternal = externalApis.filter((a) => a.status === 'active')
        const builtInAvailable = config.builtIn && hasBuiltInKey

        // Determinar motor principal
        let engine = 'none'
        let engineLabel = 'No disponible'
        if (builtInAvailable) {
          engine = 'builtin'
          engineLabel = '🐙 OCTOPUS RouteLLM'
        } else if (activeExternal.length > 0) {
          engine = activeExternal[0].serviceType
          engineLabel = `${activeExternal[0].icon} ${activeExternal[0].name}`
        }

        return {
          type,
          label: config.label,
          available: builtInAvailable || activeExternal.length > 0,
          engine,
          engineLabel,
          externalApis,
        }
      }
    )

    // Resumen
    const summary = {
      totalActive: capabilities.filter((c) => c.available).length,
      totalCapabilities: capabilities.length,
      builtInActive: hasBuiltInKey,
      externalActive: userApiKeys.filter((k) => k.status === 'active').length,
      externalTotal: userApiKeys.length,
    }

    return NextResponse.json({ capabilities, summary })
  } catch (error) {
    console.error('Capabilities Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener capacidades' },
      { status: 500 }
    )
  }
}
