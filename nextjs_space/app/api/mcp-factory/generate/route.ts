import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MCP_SERVERS } from '@/lib/mcp-directory-data'

export const dynamic = 'force-dynamic'

// Buscar servidores MCP relevantes del directorio
function findRelevantServers(query: string, limit: number = 8) {
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 2)

  const scored = MCP_SERVERS.map(server => {
    let score = 0
    const name = server.name.toLowerCase()
    const desc = server.description.toLowerCase()
    const cat = server.category.toLowerCase()
    const author = server.author.toLowerCase()

    // Coincidencia exacta en nombre
    if (name.includes(q)) score += 50
    // Coincidencia parcial en nombre
    for (const w of words) {
      if (name.includes(w)) score += 20
      if (desc.includes(w)) score += 10
      if (cat.includes(w)) score += 5
      if (author.includes(w)) score += 3
    }
    // Bonus por popularidad
    score += Math.log10(server.stars) * 2

    return { ...server, score }
  })

  return scored
    .filter(s => s.score > 5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { query, action } = await request.json()

    // Acción: buscar patrones del directorio
    if (action === 'search') {
      const results = findRelevantServers(query)
      return NextResponse.json({ results })
    }

    // Acción: generar configuración MCP con IA
    if (action === 'generate') {
      if (!query || typeof query !== 'string') {
        return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })
      }

      // Encontrar patrones relevantes del directorio
      const patterns = findRelevantServers(query, 5)
      const patternContext = patterns.map(p =>
        `- ${p.name} (by ${p.author}): ${p.description} [${p.category}, ${p.stars} stars]`
      ).join('\n')

      const systemPrompt = `Eres OCTOPUS MCP Architect — un experto en crear configuraciones de servidores Model Context Protocol.

Tienes acceso a un directorio de ${MCP_SERVERS.length} servidores MCP reales. Basándote en la solicitud del usuario y los patrones encontrados en el directorio, genera una configuración MCP completa y funcional.

PATRONES RELEVANTES DEL DIRECTORIO:
${patternContext || 'No se encontraron patrones exactos, genera uno desde cero.'}

DEBES responder SOLO con un JSON válido (sin markdown, sin backticks) con esta estructura:
{
  "name": "Nombre del MCP Server",
  "description": "Descripción clara en español",
  "category": "communication|storage|development|ai|productivity|custom",
  "icon": "uno de: MessageCircle, HardDrive, GitBranch, Brain, Calendar, Plug, Cloud, Mail, Send, Sparkles, FileText, Github",
  "color": "color hex",
  "capabilities": ["lista", "de", "capacidades"],
  "version": "1.0.0",
  "tools": [
    {
      "name": "nombre_herramienta",
      "description": "Qué hace",
      "inputSchema": {
        "type": "object",
        "properties": {
          "param1": { "type": "string", "description": "desc" }
        },
        "required": ["param1"]
      }
    }
  ],
  "resources": [
    {
      "uri": "mcp://nombre/recurso",
      "name": "Nombre del recurso",
      "description": "Descripción",
      "mimeType": "application/json"
    }
  ],
  "prompts": [
    {
      "name": "nombre_prompt",
      "description": "Cuándo usar este prompt",
      "arguments": [
        { "name": "arg1", "description": "desc", "required": true }
      ]
    }
  ],
  "configExample": {
    "mcpServers": {
      "nombre-server": {
        "command": "npx",
        "args": ["-y", "@nombre/mcp-server"],
        "env": {
          "API_KEY": "tu-api-key-aqui"
        }
      }
    }
  },
  "inspiradoEn": ["nombres de MCPs del directorio que inspiraron esto"],
  "readme": "Instrucciones de instalación y uso en español (formato texto plano, máximo 500 chars)"
}

Reglas:
- Las tools deben tener inputSchema válido según JSON Schema
- Los resources deben usar URIs MCP válidas
- El configExample debe ser compatible con Claude Desktop / Cursor
- Inspírate en los patrones del directorio pero adapta a la necesidad del usuario
- Todo en español excepto nombres técnicos
- Genera entre 3-6 tools relevantes
- Genera 1-3 resources
- Genera 1-2 prompts`

      const userPrompt = `Crea un servidor MCP para: ${query}`

      // Llamar al LLM via centralized helper (Turbo Mode + Abacus AI fallback)
      const llmData = await callLLM(session.user.id, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { model: 'gpt-4.1', temperature: 0.7, maxTokens: 3000 })

      const content = llmData.choices?.[0]?.message?.content || ''

      // Parsear JSON de la respuesta
      try {
        // Limpiar posible markdown
        const cleaned = content
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim()
        const config = JSON.parse(cleaned)
        return NextResponse.json({
          config,
          patterns: patterns.map(p => ({ name: p.name, author: p.author, category: p.category, stars: p.stars })),
        })
      } catch {
        console.error('[MCP-Factory] JSON parse error:', content.slice(0, 200))
        return NextResponse.json({ error: 'Error parseando la respuesta de IA', raw: content.slice(0, 500) }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })
  } catch (error) {
    console.error('[MCP-Factory] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
