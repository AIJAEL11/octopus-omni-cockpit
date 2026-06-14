import { NextRequest, NextResponse } from 'next/server'
import { callLLMStream } from '@/lib/turbo-llm'

export const dynamic = 'force-dynamic'

// Voice Agent Chat API — public endpoint for embedded widget
export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt, model, temperature, agentName, language } = await req.json()

    if (!messages || !systemPrompt) {
      return NextResponse.json({ error: 'messages y systemPrompt son requeridos' }, { status: 400 })
    }

    // Voice response rules — respect agent language
    const lang = language || 'es'
    const voiceRules = lang === 'es'
      ? `\n\n## REGLAS DE RESPUESTA DE VOZ\n- Responde de forma CONCISA y natural — máximo 2-3 oraciones por turno\n- Usa un tono conversacional como si estuvieras hablando por teléfono\n- NO uses markdown, bullets, ni formateo — solo texto plano hablado\n- NO uses emojis\n- Si necesitas explicar algo largo, divídelo en partes y pregunta si quieren más detalles\n- Sé cálido, profesional y directo\n- Siempre busca avanzar la conversación hacia el objetivo del agente\n- SIEMPRE responde en ESPAÑOL`
      : lang === 'pt'
      ? `\n\n## REGRAS DE RESPOSTA DE VOZ\n- Responda de forma CONCISA e natural — máximo 2-3 frases por turno\n- Use um tom conversacional como se estivesse falando ao telefone\n- NÃO use markdown, bullets ou formatação — apenas texto falado\n- NÃO use emojis\n- Se precisar explicar algo longo, divida em partes e pergunte se querem mais detalhes\n- Seja caloroso, profissional e direto\n- Sempre busque avançar a conversa em direção ao objetivo do agente\n- SEMPRE responda em PORTUGUÊS`
      : lang === 'fr'
      ? `\n\n## RÈGLES DE RÉPONSE VOCALE\n- Répondez de manière CONCISE et naturelle — maximum 2-3 phrases par tour\n- Utilisez un ton conversationnel comme si vous parliez au téléphone\n- N'utilisez PAS de markdown, puces ou formatage — uniquement du texte parlé\n- N'utilisez PAS d'emojis\n- Si vous devez expliquer quelque chose de long, divisez-le en parties et demandez s'ils veulent plus de détails\n- Soyez chaleureux, professionnel et direct\n- Cherchez toujours à faire avancer la conversation vers l'objectif de l'agent\n- Répondez TOUJOURS en FRANÇAIS`
      : `\n\n## VOICE RESPONSE RULES\n- Respond CONCISELY and naturally — max 2-3 sentences per turn\n- Use a conversational tone as if speaking on the phone\n- Do NOT use markdown, bullets, or formatting — only plain spoken text\n- Do NOT use emojis\n- If you need to explain something long, break it into parts and ask if they want more details\n- Be warm, professional, and direct\n- Always aim to advance the conversation toward the agent's goal\n- ALWAYS respond in ENGLISH`

    const voiceSystemPrompt = `${systemPrompt}${voiceRules}`

    const fullMessages = [
      { role: 'system', content: voiceSystemPrompt },
      ...messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    // Use streaming
    const response = await callLLMStream(null, fullMessages, {
      model: model || 'gpt-4.1',
      temperature: temperature ?? 0.7,
      maxTokens: 500, // Short responses for voice
    })

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[voice-agent/chat] Error:', error)
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 })
  }
}
