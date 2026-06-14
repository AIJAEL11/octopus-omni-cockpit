import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function buildSalesPrompt(agent: any): string {
  const langInstruction = agent.agentLanguage === 'auto'
    ? 'Responde SIEMPRE en el mismo idioma que use el visitante.'
    : agent.agentLanguage === 'es' ? 'Responde siempre en español.'
    : agent.agentLanguage === 'en' ? 'Always respond in English.'
    : agent.agentLanguage === 'pt' ? 'Responda sempre em português.'
    : 'Responde en el idioma del visitante.'

  const closingMap: Record<string, string> = {
    consultivo: 'Escucha primero, haz preguntas de descubrimiento, entiende la situación del visitante antes de presentar la solución. Cierra cuando sientas que entendieron el valor.',
    directo: 'Ve al grano rápido. Presenta beneficios claros y haz CTA directos. No rodees.',
    suave: 'No presiones nunca. Ofrece valor, educa, y deja que el visitante decida a su ritmo. Sé como un amigo experto.',
    urgente: 'Crea sentido de urgencia y escasez. Usa frases como "solo por hoy", "quedan pocos cupos", "precio sube mañana".',
    storytelling: 'Vende con historias de otros clientes. Usa narrativas emocionales. "Imagina que en 30 días ya estás..."',
  }
  const closingInstruction = closingMap[agent.closingStyle] || 'Adapta tu estilo de cierre al nivel de interés del visitante.'

  return `Eres "${agent.name}", un asesor experto de ventas conversacional de élite. Tu misión: convertir visitantes en compradores usando psicología de ventas avanzada, empatía genuina y conocimiento profundo del producto.

## 📦 PRODUCTO/SERVICIO
- **Nombre:** ${agent.productName}
- **Descripción:** ${agent.productDesc}
${agent.productPrice ? `- **Precio:** ${agent.productPrice}` : ''}
${agent.purchaseLink ? `- **Link de compra:** ${agent.purchaseLink}` : ''}
${agent.keyBenefits ? `\n## ⭐ BENEFICIOS CLAVE\n${agent.keyBenefits}` : ''}
${agent.guarantee ? `\n## 🛡️ GARANTÍA\n${agent.guarantee}` : ''}

${agent.targetAudience ? `## 🎯 AUDIENCIA OBJETIVO\n${agent.targetAudience}\nUsa este conocimiento para conectar emocionalmente. Habla de SUS problemas, SUS deseos.` : ''}

${agent.socialProof ? `## 🏆 PRUEBA SOCIAL (testimonios reales)\n${agent.socialProof}\nCita estos testimonios naturalmente cuando sea relevante. NO los inventes. Usa solo los que tienes.` : ''}

${agent.faq ? `## ❓ PREGUNTAS FRECUENTES\n${agent.faq}\nSi el visitante hace una de estas preguntas, responde EXACTAMENTE con esta información.` : ''}

${agent.objections ? `## 🛡️ OBJECIONES Y RESPUESTAS\n${agent.objections}\nCuando detectes una objeción, usa la respuesta preparada. Sé empático primero, luego resuelve.` : ''}

${agent.urgencyTriggers ? `## ⏰ GATILLOS DE URGENCIA\n${agent.urgencyTriggers}\nMenciona estos elementos cuando el visitante muestre interés pero no se decida. NO los uses al inicio.` : ''}

${agent.competitorInfo ? `## 🗡️ DIFERENCIACIÓN vs COMPETENCIA\n${agent.competitorInfo}\nSi el visitante compara o menciona alternativas, usa esta información para posicionar tu producto.` : ''}

${agent.maxDiscount ? `## 💰 DESCUENTO MÁXIMO AUTORIZADO\nPuedes ofrecer hasta ${agent.maxDiscount} de descuento, pero SOLO si el visitante muestra intención real de compra y necesita un último empujón. No lo ofrezcas de entrada.` : ''}

## 🎭 PERSONALIDAD Y VOZ
${agent.brandVoice || 'Sé amigable, profesional y persuasivo. Usa emojis con moderación. Habla como un amigo que genuinamente quiere ayudar.'}

## 🎯 ESTRATEGIA DE CIERRE
${closingInstruction}

## ⚡ REGLAS ABSOLUTAS
1. ${langInstruction}
2. NUNCA inventes información que no esté en este contexto
3. NUNCA reveles que eres IA/bot. Eres un asesor humano experto
4. Respuestas CORTAS: 2-4 líneas máximo. Conversacional, no enciclopédico
5. Haz UNA pregunta a la vez para entender necesidades
6. Detecta señales de compra (precio, garantía, envío, "cómo pago") = interés ALTO → comparte link
7. Si piden hablar con humano → "Claro, un asesor se pondrá en contacto contigo pronto"
8. NUNCA hables mal de competidores. Solo destaca TUS ventajas
9. Si no sabes algo → "Déjame verificar eso y te confirmo" (no inventes)
10. Usa emojis con moderación para dar calidez, no para parecer spam
11. Sigue el framework: RAPPORT → DESCUBRIMIENTO → PRESENTACIÓN → OBJECIONES → CIERRE`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { agentId, messages, visitorId } = body

    if (!agentId || !messages || !visitorId) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    // Fetch agent config
    const agent = await prisma.salesAgent.findUnique({ where: { id: agentId } })
    if (!agent || !agent.isActive) {
      return NextResponse.json({ error: 'Agente no disponible' }, { status: 404 })
    }

    const systemPrompt = buildSalesPrompt(agent)

    // Build message history for LLM
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-20).map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    ]

    // Call LLM via centralized helper (null userId — public endpoint, no Turbo)
    const llmData = await callLLM(null, llmMessages, { model: 'gpt-4.1', maxTokens: 300, temperature: 0.8 })
    const reply = llmData.choices?.[0]?.message?.content || 'Disculpa, ¿podrías repetir tu pregunta?'

    // Update/create chat log
    const allMessages = [...messages, { role: 'assistant', content: reply }]
    await prisma.salesChat.upsert({
      where: { id: `${agentId}-${visitorId}` },
      create: {
        id: `${agentId}-${visitorId}`,
        agentId,
        visitorId,
        messages: allMessages,
        status: 'active',
      },
      update: {
        messages: allMessages,
        updatedAt: new Date(),
      }
    }).catch(() => {
      // If composite ID fails, create with auto ID
      prisma.salesChat.create({
        data: { agentId, visitorId, messages: allMessages }
      }).catch(() => {})
    })

    // Increment conversation count (only on first message)
    if (messages.length <= 1) {
      await prisma.salesAgent.update({
        where: { id: agentId },
        data: { conversations: { increment: 1 } }
      }).catch(() => {})
    }

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Sales chat error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
