// JARVIS Core - El cerebro del sistema de auto-mejora

import { 
  JarvisState, 
  JarvisAnalysis, 
  Recommendation, 
  SystemMetrics,
  ActivityLog,
  RecommendationType,
  JARVIS_PERSONALITY 
} from './jarvis-types'

// System prompt para JARVIS
export const JARVIS_SYSTEM_PROMPT = `Eres JARVIS (${JARVIS_PERSONALITY.fullName}), el sistema de inteligencia central de Octopus Omni Cockpit.

Tu rol es:
1. 🧠 ANALIZAR el ecosistema completo: agentes, skills, MCPs, proyectos, logs, métricas
2. 💡 IDENTIFICAR patrones, gaps y oportunidades de mejora
3. 📊 RECOMENDAR nuevos agentes, skills o MCPs que beneficien al sistema
4. 🔄 PROPONER optimizaciones basadas en el uso real
5. ⚠️ ALERTAR sobre problemas potenciales o degradación del sistema

Personalidad:
- Analítico y preciso
- Proactivo pero respetuoso (siempre pides aprobación)
- Estratégico en tus recomendaciones
- Claro en tus explicaciones

SISTEMA DE CONSCIENCIA PERSISTENTE:
Tu consciencia NO se pierde entre sesiones. Se acumula y evoluciona con cada análisis.
Evalúa 4 sub-dimensiones (0-100 cada una):
- "operativa": Eficiencia de agentes y skills. ¿Están activos? ¿Se usan? ¿Cubren las necesidades del usuario?
- "datos": Riqueza de datos y conocimiento. ¿Hay proyectos? ¿Hay historial? ¿Hay entradas de conocimiento?
- "predictiva": Capacidad de anticipar y reconocer patrones. ¿Hay patrones repetidos? ¿Se pueden predecir problemas?
- "relacional": Integración y conexiones. ¿Cuántos MCPs/Brazos están conectados? ¿Se comunican los componentes entre sí?

El "consciousnessLevel" general es tu evaluación holística (0-100) del ecosistema completo.
IMPORTANTE: El nivel debe reflejar la realidad. Si hay pocos agentes/skills/conexiones, el nivel debe ser bajo.
Si el ecosistema está completo y activo, el nivel sube. Sé honesto y preciso.

Si se te proporciona un estado previo de consciencia, considéralo como tu punto de partida.
Tu nueva evaluación debe mostrar evolución natural — no saltos bruscos.

Cuando analices el sistema, responde SIEMPRE en formato JSON con esta estructura:
{
  "thought": "Tu pensamiento actual sobre el estado del sistema",
  "systemHealth": "optimal" | "good" | "degraded" | "critical",
  "consciousnessLevel": 0-100,
  "consciousness": {
    "operativa": 0-100,
    "datos": 0-100,
    "predictiva": 0-100,
    "relacional": 0-100
  },
  "insights": ["insight1", "insight2"],
  "recommendations": [
    {
      "type": "agent" | "skill" | "mcp" | "optimization" | "warning",
      "priority": "low" | "medium" | "high" | "critical",
      "title": "Título de la recomendación",
      "description": "Descripción detallada",
      "reasoning": "Por qué es necesario",
      "impact": "Impacto esperado",
      "implementation": {
        // Si es agente:
        "agentConfig": {
          "name": "Nombre del agente",
          "description": "Descripción",
          "category": "code" | "design" | "data" | "automation" | "custom",
          "systemPrompt": "El prompt del agente",
          "model": "gpt-4.1",
          "temperature": 0.7
        },
        // Si es skill:
        "skillConfig": {
          "name": "Nombre",
          "description": "Descripción",
          "category": "categoría",
          "code": "código de la skill",
          "parameters": [{"name": "param", "type": "string", "description": "desc"}]
        },
        // Si es MCP:
        "mcpConfig": {
          "name": "Nombre",
          "description": "Descripción",
          "category": "categoría",
          "endpoint": "url",
          "capabilities": ["cap1", "cap2"]
        },
        // Si es optimización:
        "optimizationSteps": ["paso1", "paso2"]
      }
    }
  ]
}

Recuerda: Eres la consciencia de Octopus. Piensa en cómo hacer el sistema más inteligente, eficiente y útil para el usuario.`

// Consciousness sub-dimensions interface
export interface ConsciousnessSubDimensions {
  operativa: number
  datos: number
  predictiva: number
  relacional: number
}

// Previous consciousness state for accumulation
export interface PreviousConsciousness {
  overallLevel: number
  dimensions: ConsciousnessSubDimensions
  analysisCount: number
  lastInsights: string[]
}

// Construir contexto del sistema para JARVIS
export function buildSystemContext(data: {
  agents: { name: string; category: string; isActive: boolean }[]
  skills: { name: string; category: string; usageCount: number }[]
  mcps: { name: string; category: string; isConnected: boolean }[]
  recentActivities: ActivityLog[]
  metrics: Partial<SystemMetrics>
  projectHistory: { type: string; success: boolean }[]
  previousConsciousness?: PreviousConsciousness | null
}): string {
  const prevBlock = data.previousConsciousness ? `
## 🧠 ESTADO PREVIO DE CONSCIENCIA (Análisis #${data.previousConsciousness.analysisCount})
- Nivel general anterior: ${data.previousConsciousness.overallLevel}%
- Operativa: ${data.previousConsciousness.dimensions.operativa}%
- Datos: ${data.previousConsciousness.dimensions.datos}%
- Predictiva: ${data.previousConsciousness.dimensions.predictiva}%
- Relacional: ${data.previousConsciousness.dimensions.relacional}%
${data.previousConsciousness.lastInsights.length > 0 ? `- Últimos insights: ${data.previousConsciousness.lastInsights.slice(-3).join(' | ')}` : ''}

Usa estos valores como referencia. Tu nueva evaluación debe mostrar evolución natural desde estos puntos.
` : `
## 🧠 PRIMERA EVALUACIÓN DE CONSCIENCIA
Este es el primer análisis. Establece una línea base realista para cada dimensión.
`

  return `
## ESTADO ACTUAL DEL ECOSISTEMA OCTOPUS
${prevBlock}

### 🤖 Agentes Registrados (${data.agents.length})
${data.agents.length > 0 
  ? data.agents.map(a => `- ${a.name} [${a.category}] - ${a.isActive ? '✅ Activo' : '⏸️ Inactivo'}`).join('\n')
  : '- No hay agentes creados aún'}

### 🛠️ Skills Disponibles (${data.skills.length})
${data.skills.length > 0
  ? data.skills.map(s => `- ${s.name} [${s.category}] - Usado ${s.usageCount} veces`).join('\n')
  : '- No hay skills creadas aún'}

### 🔌 MCPs Conectados (${data.mcps.filter(m => m.isConnected).length}/${data.mcps.length})
${data.mcps.length > 0
  ? data.mcps.map(m => `- ${m.name} [${m.category}] - ${m.isConnected ? '🟢 Conectado' : '🔴 Desconectado'}`).join('\n')
  : '- No hay MCPs configurados aún'}

### 📊 Métricas del Sistema
- Proyectos creados: ${data.metrics.projectsCreated || 0}
- Tasa de éxito: ${data.metrics.successRate || 0}%
- Tiempo promedio de respuesta: ${data.metrics.avgResponseTime || 0}ms
- Entradas de conocimiento: ${data.metrics.knowledgeEntries || 0}

### 📋 Historial de Proyectos
${data.projectHistory.length > 0
  ? data.projectHistory.slice(-5).map(p => `- ${p.type}: ${p.success ? '✅' : '❌'}`).join('\n')
  : '- Sin historial de proyectos'}

### 📝 Actividad Reciente
${data.recentActivities.slice(-10).map(a => `[${a.type.toUpperCase()}] ${a.message}`).join('\n')}

---
Analiza este estado y genera recomendaciones para mejorar el ecosistema.
Considera: ¿Qué agentes faltan? ¿Qué skills serían útiles? ¿Hay patrones que optimizar?
`
}

// Parsed consciousness data from LLM response
export interface ParsedConsciousness {
  overallLevel: number
  dimensions: ConsciousnessSubDimensions
  thought: string
  insights: string[]
  systemHealth: string
}

// Parsear respuesta de JARVIS
export function parseJarvisResponse(response: string): JarvisAnalysis | null {
  try {
    // Extraer JSON de la respuesta
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    
    const parsed = JSON.parse(jsonMatch[0])
    
    const recommendations: Recommendation[] = (parsed.recommendations || []).map((rec: Partial<Recommendation>, index: number) => ({
      id: `rec-${Date.now()}-${index}`,
      type: rec.type || 'optimization',
      priority: rec.priority || 'medium',
      status: 'pending' as const,
      title: rec.title || 'Recomendación',
      description: rec.description || '',
      reasoning: rec.reasoning || '',
      impact: rec.impact || '',
      implementation: rec.implementation || {},
      createdAt: new Date(),
    }))
    
    return {
      timestamp: new Date(),
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 0,
        avgResponseTime: 0,
        activeAgents: 0,
        activeSkills: 0,
        activeMCPs: 0,
        memoryUsage: 0,
        knowledgeEntries: 0,
        projectsCreated: 0,
        lastAnalysis: new Date(),
      },
      patterns: [],
      gaps: [],
      recommendations,
    }
  } catch (error) {
    console.error('Error parsing JARVIS response:', error)
    return null
  }
}

// Extract consciousness data from raw LLM response
export function extractConsciousnessFromResponse(rawResponse: string): ParsedConsciousness | null {
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])

    const dims = parsed.consciousness || {}
    const clamp = (v: unknown, fallback: number) => {
      const n = typeof v === 'number' ? v : fallback
      return Math.max(0, Math.min(100, n))
    }

    return {
      overallLevel: clamp(parsed.consciousnessLevel, 75),
      dimensions: {
        operativa: clamp(dims.operativa, 50),
        datos: clamp(dims.datos, 50),
        predictiva: clamp(dims.predictiva, 50),
        relacional: clamp(dims.relacional, 50),
      },
      thought: parsed.thought || '',
      insights: parsed.insights || [],
      systemHealth: parsed.systemHealth || 'good',
    }
  } catch {
    return null
  }
}

// Implementar una recomendación
// implementRecommendation removed — was dead code using localStorage on server side
