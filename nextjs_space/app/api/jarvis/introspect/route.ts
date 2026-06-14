import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'

// Rutas permitidas para introspección (seguridad)
const ALLOWED_PATHS = [
  'lib/jarvis-actions.ts',
  'lib/jarvis-chat.ts',
  'lib/jarvis-intelligence.ts',
  'lib/jarvis-types.ts',
  'lib/orchestrator.ts',
  'lib/project-types.ts',
  'lib/brazos-types.ts',
  'lib/metrics-context.tsx',
  'lib/knowledge-base.ts',
  'app/api/jarvis',
  'app/(dashboard)/dashboard',
  'components/layout',
  'components/ui',
]

// Estructura del proyecto para JARVIS
const PROJECT_STRUCTURE = {
  name: 'Octopus Omni Cockpit',
  version: '1.0.0',
  modules: [
    { name: 'Dashboard', path: '/dashboard', file: 'app/(dashboard)/dashboard/page.tsx' },
    { name: 'JARVIS', path: '/dashboard/jarvis', file: 'app/(dashboard)/dashboard/jarvis/page.tsx' },
    { name: 'Chat Terminal', path: '/dashboard/chat', file: 'app/(dashboard)/dashboard/chat/page.tsx' },
    { name: 'Proyectos', path: '/dashboard/projects', file: 'app/(dashboard)/dashboard/projects/page.tsx' },
    { name: 'Project Builder', path: '/dashboard/project-builder', file: 'app/(dashboard)/dashboard/project-builder/page.tsx' },
    { name: 'Brazos', path: '/dashboard/brazos', file: 'app/(dashboard)/dashboard/brazos/page.tsx' },
    { name: 'Skill Factory', path: '/dashboard/skill-factory', file: 'app/(dashboard)/dashboard/skill-factory/page.tsx' },
    { name: 'Agent Factory', path: '/dashboard/agent-factory', file: 'app/(dashboard)/dashboard/agent-factory/page.tsx' },
    { name: 'MCP Factory', path: '/dashboard/mcp-factory', file: 'app/(dashboard)/dashboard/mcp-factory/page.tsx' },
    { name: 'API Hub', path: '/dashboard/api-hub', file: 'app/(dashboard)/dashboard/api-hub/page.tsx' },
  ],
  coreLibs: [
    { name: 'JARVIS Actions', file: 'lib/jarvis-actions.ts', description: 'Parsers de jarvis-action blocks (fallback) + tipos ActionType/JarvisAction' },
    { name: 'JARVIS Chat', file: 'lib/jarvis-chat.ts', description: 'Prompts y contexto del chat' },
    { name: 'JARVIS Intelligence', file: 'lib/jarvis-intelligence.ts', description: 'Vibe detection y task chaining' },
    { name: 'Orchestrator', file: 'lib/orchestrator.ts', description: 'Sistema de orquestación de agentes' },
    { name: 'Project Types', file: 'lib/project-types.ts', description: 'Tipos de proyectos y agentes' },
    { name: 'Brazos Types', file: 'lib/brazos-types.ts', description: 'Configuración de conexiones' },
    { name: 'Knowledge Base', file: 'lib/knowledge-base.ts', description: 'Sistema RAG de conocimiento' },
  ],
  apis: [
    { name: 'JARVIS Chat', path: '/api/jarvis/chat', method: 'POST' },
    { name: 'JARVIS Create', path: '/api/jarvis/create', method: 'POST' },
    { name: 'JARVIS Generate Image', path: '/api/jarvis/generate-image', method: 'POST' },
    { name: 'JARVIS Generate Video', path: '/api/jarvis/generate-video', method: 'POST' },
    { name: 'JARVIS Introspect', path: '/api/jarvis/introspect', method: 'GET/POST' },
    { name: 'Projects', path: '/api/projects', method: 'GET/POST' },
    { name: 'Brazos', path: '/api/brazos', method: 'GET/POST/DELETE' },
    { name: 'Chat', path: '/api/chat', method: 'GET/POST' },
    { name: 'API Hub', path: '/api/api-hub', method: 'GET/POST/DELETE' },
  ]
}

// GET: Obtener estructura del proyecto o leer archivo
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'structure'
    const filePath = searchParams.get('file')

    // Acción: Obtener estructura del proyecto
    if (action === 'structure') {
      return NextResponse.json({
        success: true,
        structure: PROJECT_STRUCTURE,
        timestamp: new Date().toISOString()
      })
    }

    // Acción: Leer un archivo específico
    if (action === 'read' && filePath) {
      // Validar que el path está permitido
      const isAllowed = ALLOWED_PATHS.some(allowed => filePath.startsWith(allowed))
      if (!isAllowed) {
        return NextResponse.json({ 
          error: 'Acceso denegado a este archivo',
          allowedPaths: ALLOWED_PATHS 
        }, { status: 403 })
      }

      const fullPath = path.join(process.cwd(), filePath)
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8')
        const stats = await fs.stat(fullPath)
        
        return NextResponse.json({
          success: true,
          file: {
            path: filePath,
            content,
            size: stats.size,
            modified: stats.mtime,
            lines: content.split('\n').length
          }
        })
      } catch {
        return NextResponse.json({ 
          error: 'Archivo no encontrado',
          path: filePath 
        }, { status: 404 })
      }
    }

    // Acción: Listar archivos en un directorio
    if (action === 'list' && filePath) {
      const isAllowed = ALLOWED_PATHS.some(allowed => filePath.startsWith(allowed))
      if (!isAllowed) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }

      const fullPath = path.join(process.cwd(), filePath)
      
      try {
        const entries = await fs.readdir(fullPath, { withFileTypes: true })
        const files = entries.map(entry => ({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          path: path.join(filePath, entry.name)
        }))
        
        return NextResponse.json({ success: true, files })
      } catch {
        return NextResponse.json({ error: 'Directorio no encontrado' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Introspect Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Analizar código o buscar patrones
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action, query, files } = body

    // Acción: Buscar en archivos
    if (action === 'search' && query) {
      const results: { file: string; line: number; content: string }[] = []
      const searchFiles = files || ['lib/jarvis-actions.ts', 'lib/jarvis-chat.ts']

      for (const filePath of searchFiles) {
        const isAllowed = ALLOWED_PATHS.some(allowed => filePath.startsWith(allowed))
        if (!isAllowed) continue

        try {
          const fullPath = path.join(process.cwd(), filePath)
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(query.toLowerCase())) {
              results.push({
                file: filePath,
                line: index + 1,
                content: line.trim()
              })
            }
          })
        } catch {
          // Skip files that don't exist
        }
      }

      return NextResponse.json({ success: true, results, query })
    }

    // Acción: Analizar mi propio código
    if (action === 'analyze-self') {
      const analysis = {
        prompts: {
          file: 'lib/jarvis-chat.ts',
          description: 'Contiene detectores IoT/Brazos + buildChatContext (prompt legacy eliminado en limpieza)'
        },
        actions: {
          file: 'lib/jarvis-actions.ts', 
          description: 'Contiene parsers de jarvis-action blocks (fallback) + tipos ActionType/JarvisAction'
        },
        intelligence: {
          file: 'lib/jarvis-intelligence.ts',
          description: 'Contiene analyzeUserVibe() y detectTaskChain() - mi inteligencia'
        },
        capabilities: [
          'Crear skills con código TypeScript',
          'Crear agentes con prompts personalizados',
          'Crear MCPs/conectores',
          'Generar imágenes con RouteLLM',
          'Generar videos (slideshow)',
          'Navegar dentro del sistema',
          'Analizar imágenes subidas',
          'Introspección de código (NUEVO)'
        ],
        improvements: [
          'Puedo leer y analizar mi propio código',
          'Puedo crear skills que mejoren mis capacidades',
          'Puedo detectar patrones en el código existente'
        ]
      }

      return NextResponse.json({ success: true, analysis })
    }

    // Acción: Obtener estadísticas del sistema
    if (action === 'stats') {
      const stats = {
        totalModules: PROJECT_STRUCTURE.modules.length,
        totalApis: PROJECT_STRUCTURE.apis.length,
        coreLibs: PROJECT_STRUCTURE.coreLibs.length,
        jarvisFiles: [
          'lib/jarvis-actions.ts',
          'lib/jarvis-chat.ts',
          'lib/jarvis-intelligence.ts',
          'lib/jarvis-types.ts',
          'app/api/jarvis/chat/route.ts',
          'app/api/jarvis/create/route.ts',
          'app/api/jarvis/generate-image/route.ts',
          'app/api/jarvis/generate-video/route.ts',
          'app/api/jarvis/introspect/route.ts',
          'app/(dashboard)/dashboard/jarvis/page.tsx'
        ]
      }

      return NextResponse.json({ success: true, stats })
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Introspect POST Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
