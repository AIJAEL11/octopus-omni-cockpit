import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { JarvisAction } from '@/lib/jarvis-actions'
import { assessSkillCode } from '@/lib/skill-validation'

export const dynamic = 'force-dynamic'

// POST - Crear herramientas (skills, agents, MCPs) desde JARVIS
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body as { action: JarvisAction }

    if (!action || !action.type || !action.data) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    let result: {
      success: boolean
      type: string
      name: string
      location: string
      data: Record<string, unknown>
    } | null = null

    // Normalize field names: tool-calling sends {name, description, code}
    // Legacy jarvis-action sends {skillName, skillDescription, skillCode}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = action.data as Record<string, any>

    switch (action.type) {
      case 'create_skill': {
        const skillName = (d.skillName || d.name) as string
        if (skillName) {
          const skillCode = (d.skillCode || d.code || '') as string
          // Anti-humo: si el código no es ejecutable, se guarda como borrador inactivo
          const assessment = assessSkillCode(skillCode)
          const newSkill = {
            id: `skill-${Date.now()}`,
            name: skillName,
            description: (d.skillDescription || d.description || '') as string,
            category: (d.skillCategory || d.category || 'general') as string,
            code: skillCode,
            usageCount: 0,
            isActive: assessment.executable,
            createdAt: new Date().toISOString(),
            createdBy: 'JARVIS',
          }
          
          result = {
            success: true,
            type: 'skill',
            name: newSkill.name,
            location: assessment.executable ? 'Skill Factory' : `Skill Factory (BORRADOR — ${assessment.reason})`,
            data: newSkill,
          }
        }
        break
      }

      case 'create_agent': {
        const agentName = (d.agentName || d.name) as string
        if (agentName) {
          const categoryColors: Record<string, string> = {
            code: '#2D4A3E',
            design: '#C4622D',
            data: '#4A90D9',
            automation: '#9B59B6',
            custom: '#1ABC9C',
          }
          const cat = (d.agentCategory || d.category || 'custom') as string
          
          const newAgent = {
            id: `agent-${Date.now()}`,
            name: agentName,
            description: (d.agentDescription || d.description || '') as string,
            category: cat,
            systemPrompt: (d.agentPrompt || d.systemPrompt || '') as string,
            model: (d.agentModel || d.model || 'gpt-4.1') as string,
            temperature: 0.7,
            icon: 'Bot',
            color: categoryColors[cat] || '#1ABC9C',
            capabilities: [],
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'JARVIS',
          }
          
          result = {
            success: true,
            type: 'agent',
            name: newAgent.name,
            location: 'Agent Factory',
            data: newAgent,
          }
        }
        break
      }

      case 'create_mcp': {
        const mcpName = (d.mcpName || d.name) as string
        if (mcpName) {
          const newMCP = {
            id: `mcp-${Date.now()}`,
            name: mcpName,
            description: (d.mcpDescription || d.description || '') as string,
            category: 'custom',
            endpoint: (d.mcpEndpoint || d.endpoint || '') as string,
            capabilities: (d.mcpCapabilities || d.capabilities || []) as string[],
            icon: 'Plug',
            color: '#1ABC9C',
            isConnected: false,
            version: '1.0.0',
            createdBy: 'JARVIS',
          }
          
          result = {
            success: true,
            type: 'mcp',
            name: newMCP.name,
            location: 'MCP Factory',
            data: newMCP,
          }
        }
        break
      }
    }

    if (!result) {
      return NextResponse.json({ error: 'No se pudo crear' }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('JARVIS Create Error:', error)
    return NextResponse.json(
      { error: 'Error al crear herramienta' },
      { status: 500 }
    )
  }
}
