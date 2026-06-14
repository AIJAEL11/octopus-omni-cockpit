import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AGENT_PROMPTS, ProjectPlan, DESIGN_SYSTEM } from '@/lib/orchestrator'
import { generateProjectPrompt } from '@/lib/master-prompts'
import { saveProjectPattern, createProjectMemory } from '@/lib/knowledge-base'

export const dynamic = 'force-dynamic'

// POST - Generar código con el Enjambre
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { plan, sessionId } = body as { plan: ProjectPlan; sessionId: string }

    if (!plan) {
      return NextResponse.json({ error: 'Plan requerido' }, { status: 400 })
    }

    // Crear proyecto en DB
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: plan.projectName,
        description: plan.description,
        projectType: plan.projectType,
        status: 'building',
        progress: 0,
      },
    })

    // Actualizar sesión de chat con projectId
    if (sessionId) {
      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { projectId: project.id }
      })
    }

    const encoder = new TextEncoder()
    
    // Determinar agentes a usar basado en el tipo de proyecto
    let agents: string[] = []
    
    if (plan.requiresGame) {
      // Proyecto de juego: solo necesita Game Agent
      agents = ['game']
    } else {
      // Proyecto web normal
      agents = ['image', 'architect', 'designer', 'frontend']
      if (plan.requiresBackend) {
        agents.push('backend')
      }
    }
    
    let totalProgress = 0

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'start', 
            projectId: project.id,
            projectName: plan.projectName,
            requiresBackend: plan.requiresBackend || false,
            requiresGame: plan.requiresGame || false,
            gameType: plan.gameType || null
          })}\n\n`))

          for (let i = 0; i < agents.length; i++) {
            const agentType = agents[i]
            const agentNames: Record<string, string> = {
              architect: '🏗️ Arquitecto',
              designer: '🎨 Diseñador UI',
              frontend: '💻 Frontend Agent',
              backend: '🔧 Backend Agent',
              game: '🎮 Game Agent',
              image: '🖼️ Image Agent',
            }

            // Notificar inicio de agente
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'agent_start', 
              agent: agentType,
              name: agentNames[agentType]
            })}\n\n`))

            // Generar con LLM usando prompts maestros cinematográficos
            const projectContext = generateProjectPrompt(plan.projectName, plan.projectType, plan.description, plan.features)
            
            // Construir prompt específico según el tipo de agente
            let agentPrompt = ''
            let userMessage = ''
            
            const agentPrompts = AGENT_PROMPTS as Record<string, string>
            
            if (agentType === 'game') {
              // Prompt especial para Game Agent
              agentPrompt = `${agentPrompts[agentType]}

PROYECTO DE JUEGO: ${plan.projectName}
TIPO DE JUEGO: ${plan.gameType || 'snake'}
DESCRIPCIÓN: ${plan.description}

COLORES A USAR:
- Primario: ${DESIGN_SYSTEM.colors.verdeMusgo}
- Secundario: ${DESIGN_SYSTEM.colors.arcilla}
- Fondo: ${DESIGN_SYSTEM.colors.carbon}
- Acento: ${DESIGN_SYSTEM.colors.crema}

GENERA EL COMPONENTE DE JUEGO COMPLETO Y FUNCIONAL.
Incluye: game loop, controles, puntuación, estados (menu, playing, gameOver).
El código debe funcionar inmediatamente al copiarlo.`
              userMessage = `Crea el juego ${plan.gameType || 'snake'} completo para ${plan.projectName}`
            } else if (agentType === 'image') {
              // Prompt para Image Agent
              agentPrompt = `${agentPrompts[agentType]}

PROYECTO: ${plan.projectName}
TIPO: ${plan.projectType}
SECCIONES: ${plan.sections?.join(', ') || 'hero, features, cta, footer'}

Busca imágenes apropiadas de alta calidad para cada sección del proyecto.`
              userMessage = `Encuentra imágenes profesionales para ${plan.projectName} (${plan.projectType})`
            } else {
              // Prompt estándar para otros agentes
              agentPrompt = `${agentPrompts[agentType]}\n\n${projectContext}\n\nEstructura solicitada: ${JSON.stringify(plan.structure)}\n\nSISTEMA DE DISEÑO OBLIGATORIO:\n- Verde Musgo: ${DESIGN_SYSTEM.colors.verdeMusgo}\n- Arcilla: ${DESIGN_SYSTEM.colors.arcilla}\n- Crema: ${DESIGN_SYSTEM.colors.crema}\n- Carbón: ${DESIGN_SYSTEM.colors.carbon}\n\nGenera código/configuración de alta calidad cinematográfica. Nada genérico.`
              userMessage = `Genera la parte correspondiente para el proyecto ${plan.projectName}`
            }

            // Call LLM via centralized helper (Turbo Mode + Abacus AI fallback)
            const result = await callLLM(session.user.id, [
              { role: 'system', content: agentPrompt },
              { role: 'user', content: userMessage }
            ], { model: 'gpt-4.1', maxTokens: 4000, temperature: 0.5 })

            const content = result.choices?.[0]?.message?.content || ''

            // Guardar log del agente
            await prisma.agentLog.create({
              data: {
                projectId: project.id,
                agentName: agentNames[agentType],
                agentType,
                message: `Tarea completada`,
                status: 'completed',
              },
            })

            // Guardar archivo generado
            const fileNames: Record<string, string> = {
              architect: 'project-structure.json',
              designer: 'design-system.json',
              frontend: 'components.tsx',
              backend: 'api-routes.ts',
              game: 'game-component.tsx',
              image: 'images-config.json',
            }

            const fileTypes: Record<string, string> = {
              architect: 'json',
              designer: 'json',
              frontend: 'tsx',
              backend: 'ts',
              game: 'tsx',
              image: 'json',
            }

            await prisma.projectFile.create({
              data: {
                projectId: project.id,
                name: fileNames[agentType],
                path: `/${fileNames[agentType]}`,
                content: content,
                fileType: fileTypes[agentType],
                agentId: agentType,
              },
            })

            totalProgress = Math.round(((i + 1) / agents.length) * 100)

            // Actualizar progreso del proyecto
            await prisma.project.update({
              where: { id: project.id },
              data: { progress: totalProgress },
            })

            // Notificar completado
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'agent_done', 
              agent: agentType,
              name: agentNames[agentType],
              progress: totalProgress,
              output: content.slice(0, 500) + '...'
            })}\n\n`))
          }

          // Marcar proyecto como completado
          await prisma.project.update({
            where: { id: project.id },
            data: { status: 'completed', progress: 100 },
          })

          // ============================================
          // RAG 2.0: Guardar patrón exitoso para aprendizaje
          // ============================================
          try {
            // Guardar patrón de proyecto
            await saveProjectPattern(
              plan.projectType,
              plan.description,
              `Proyecto ${plan.projectName} con ${plan.features.join(', ')}`,
              plan.sections || []
            )

            // Crear memoria del proyecto
            await createProjectMemory(
              project.id,
              `${plan.projectType}: ${plan.description}`,
              plan.features,
              DESIGN_SYSTEM
            )
          } catch (memoryError) {
            console.error('Error saving project memory:', memoryError)
            // No falla la generación por error de memoria
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'complete', 
            projectId: project.id,
            message: '¡Proyecto creado exitosamente! El sistema ha aprendido de esta creación.' 
          })}\n\n`))

          controller.close()
        } catch (error) {
          console.error('Generation error:', error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: 'error', 
            message: 'Error durante la generación' 
          })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
