/**
 * JARVIS Conversation Summarizer
 * Compresión inteligente de conversaciones largas
 * 
 * Cuando el historial supera un umbral, los mensajes más antiguos se
 * comprimen en un resumen ejecutivo, preservando los mensajes recientes
 * intactos para mantener coherencia conversacional.
 */

export const SUMMARY_CONFIG = {
  /** Umbral de mensajes para activar la compresión (was 30 — reduced for better context focus) */
  compressionThreshold: 20,
  /** Mensajes recientes que se mantienen intactos (sin comprimir) (was 20 — reduced to give LLM more headroom) */
  recentKeep: 14,
  /** Máximo de tokens para el resumen generado */
  maxSummaryTokens: 1500,
}

interface ChatMessage {
  role: string
  content: string
}

interface SummarizedHistory {
  /** Resumen comprimido de la conversación antigua (null si no se comprimió) */
  summary: string | null
  /** Mensajes recientes preservados intactos */
  recentMessages: ChatMessage[]
  /** Estadísticas de la compresión */
  stats: {
    originalCount: number
    compressedCount: number
    recentCount: number
    compressionApplied: boolean
  }
}

/**
 * Genera un resumen comprimido de mensajes antiguos usando el LLM
 */
async function generateSummary(oldMessages: ChatMessage[]): Promise<string> {
  // Construir el texto a resumir con marcadores de rol
  const conversationText = oldMessages
    .map(m => `[${m.role === 'user' ? 'USUARIO' : 'OCTOPUS'}]: ${m.content.substring(0, 500)}`)
    .join('\n')
    .substring(0, 12000) // Max ~3K tokens de input

  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Eres un experto en compresión de conversaciones. Tu tarea es crear un RESUMEN EJECUTIVO ultra-compacto de la conversación proporcionada.

REGLAS:
- Preserva TODOS los hechos clave, decisiones, datos específicos (nombres, números, URLs, configuraciones)
- Preserva el CONTEXTO emocional y las preferencias del usuario
- Preserva cualquier tarea pendiente o en progreso
- 🚨 CRÍTICO: Si hubo un BORRADOR DE EMAIL (destinatario, asunto, cuerpo), preserva TODOS los detalles exactos (to, subject, body) ya que el usuario puede pedir enviarlo después
- Preserva nombres de personas, empresas, proyectos mencionados
- Usa formato compacto con bullets
- Máximo 400 palabras
- Escribe en el mismo idioma que la conversación (español por defecto)
- NO incluyas saludos ni metadatos, solo información útil

Formato:
📋 RESUMEN DE CONVERSACIÓN ANTERIOR:
• [Tema principal discutido]
• [Decisiones tomadas]
• [Datos específicos mencionados]
• [Preferencias del usuario]
• [Tareas pendientes si las hay]`
          },
          {
            role: 'user',
            content: `Resume esta conversación preservando toda la información crítica:\n\n${conversationText}`
          }
        ],
        temperature: 0.2,
        max_tokens: SUMMARY_CONFIG.maxSummaryTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      console.error(`[Summarizer] LLM error: ${response.status}`)
      return buildFallbackSummary(oldMessages)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content

    if (!summary) {
      return buildFallbackSummary(oldMessages)
    }

    return summary
  } catch (err) {
    console.error('[Summarizer] Error generating summary:', err instanceof Error ? err.message : err)
    return buildFallbackSummary(oldMessages)
  }
}

/**
 * Resumen de fallback sin LLM (extracción heurística)
 */
function buildFallbackSummary(messages: ChatMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user')
  const topics = userMessages
    .map(m => m.content.substring(0, 120))
    .slice(0, 10)
    .join(' | ')

  return `📋 RESUMEN DE CONVERSACIÓN ANTERIOR (${messages.length} mensajes):\n• Temas discutidos: ${topics.substring(0, 600)}`
}

/**
 * Comprime inteligentemente el historial de conversación.
 * Si el historial es corto, lo devuelve intacto.
 * Si es largo, comprime los mensajes antiguos en un resumen.
 */
export async function compressConversationHistory(
  history: ChatMessage[]
): Promise<SummarizedHistory> {
  const totalMessages = history.length

  // Si no supera el umbral, no comprimir
  if (totalMessages <= SUMMARY_CONFIG.compressionThreshold) {
    return {
      summary: null,
      recentMessages: history,
      stats: {
        originalCount: totalMessages,
        compressedCount: 0,
        recentCount: totalMessages,
        compressionApplied: false,
      },
    }
  }

  // Dividir: mensajes antiguos vs recientes
  const splitIndex = totalMessages - SUMMARY_CONFIG.recentKeep
  const oldMessages = history.slice(0, splitIndex)
  const recentMessages = history.slice(splitIndex)

  console.log(`[Summarizer] Compressing ${oldMessages.length} old messages, keeping ${recentMessages.length} recent`)

  // Generar resumen de mensajes antiguos
  const summary = await generateSummary(oldMessages)

  console.log(`[Summarizer] Summary generated: ${summary.length} chars (~${Math.ceil(summary.length / 4)} tokens)`)

  return {
    summary,
    recentMessages,
    stats: {
      originalCount: totalMessages,
      compressedCount: oldMessages.length,
      recentCount: recentMessages.length,
      compressionApplied: true,
    },
  }
}
