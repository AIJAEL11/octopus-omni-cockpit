export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ELITE_CREATIVE_DIRECTOR_SYSTEM } from '@/lib/elite-creative-director'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { topic, style, language, duration } = await request.json()

    const styleInstructions: Record<string, string> = {
      'meme': 'Estilo MEME viral: frases cortas y punchy, humor relatable, expresiones exageradas tipo "POV: cuando descubres...", "Ese momento cuando...", punchlines rápidos. Texto grande y legible. Máximo 2-3 frases cortas.',
      'profesional': 'Estilo profesional pero cercano: como un colega recomendando algo genuinamente. Datos concretos, beneficios claros, tono confiable. 3-4 frases bien estructuradas.',
      'divertido': 'Estilo divertido y energético: humor ligero, comparaciones graciosas, entusiasmo contagioso. Como un amigo que descubrió algo genial. 3-4 frases con ritmo.',
      'cinematic': 'Estilo cinemático épico: narración tipo documental, frases poderosas y dramáticas, pausa estratégica. Voz de narrador. 2-3 frases impactantes.',
      'testimonial': 'Estilo testimonial real: como si fuera un usuario contando su experiencia. Primera persona, problema → solución → resultado. Auténtico y creíble. 3-4 frases.',
      'viral': 'Estilo viral hook-first: empieza con un gancho imposible de ignorar ("Esto cambió mi vida", "Nadie te dice esto pero..."), luego entrega valor rápido. 3-4 frases con gancho fuerte.',
      'motivacional': 'Estilo motivacional inspirador: frases que empoderan, visión de futuro, call to action emocional. Como un coach. 2-3 frases poderosas.',
      'educativo': 'Estilo educativo tipo "¿Sabías que...?": dato interesante, explicación rápida, beneficio concreto. Informativo pero dinámico. 3-4 frases.',
    }

    const styleGuide = styleInstructions[style || 'profesional'] || styleInstructions['profesional']
    const topicContext = topic
      ? `El tema/producto es: "${topic}"`
      : `El tema es OCTOPUS — una plataforma AI todo-en-uno para negocios (campañas, contenido, leads, CRM, creativos). Pero NO repitas siempre lo mismo. Sé creativo con el ángulo: un día habla del problema que resuelve, otro de un beneficio específico, otro de una historia, otro de un dato sorprendente.`

    const prompt = `Genera un guión corto para un video UGC (User Generated Content) de ${duration || 10} segundos.

${topicContext}

ESTILO: ${styleGuide}

IDIOMA: ${language === 'en' ? 'Inglés' : 'Español'}

REGLAS:
- El texto será superpuesto en video, así que debe ser CORTO y LEGIBLE
- Cada frase debe poder mostrarse 2-3 segundos en pantalla
- NUNCA uses frases genéricas como "¡Hola! Estoy emocionado de contarte sobre..."
- Empieza fuerte — el primer segundo debe captar atención
- Para estilo meme: frases MUY cortas, impactantes, con humor
- Para otros estilos: frases concisas con ritmo visual
- IMPORTANTE: Sé DIFERENTE y CREATIVO cada vez. No repitas estructuras ni frases anteriores.
- Las palabras "OCTOPUS" se pronuncian "Ahk-tuh-pus" y "Omni Cockpit" se pronuncia "Ahm-nee Cock-pit" — usa estas pronunciaciones fonéticas EN LUGAR de la escritura normal.

Responde SOLO con el guión (las frases separadas por punto). Nada más. Sin explicaciones, sin títulos, sin comillas.`

    const apiKey = process.env.ABACUSAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const llmRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: `${ELITE_CREATIVE_DIRECTOR_SYSTEM}

═══════════════════════════════════════════════════════════
UGC SCRIPT WRITER — SHORT-FORM COPY APPLICATION
═══════════════════════════════════════════════════════════

You are now writing a UGC video SCRIPT (spoken/on-screen copy, not visual prompts). Apply the Elite Creative Director principles to WORDS:

- HOOK (first line, 0-2s): Must stop the scroll. No weak openers like "¡Hola!", "Estoy emocionado", "Today I want to tell you". Use curiosity gaps, bold claims, or counter-intuitive statements.
- CONTRAST: Problem → Solution, Before → After, Generic → Specific. Payoff must be earned within 3-5 seconds max for retention.
- STATUS & FUTURE tone: Speak like the viewer is about to level up. Never defensive, never apologetic, never cringe.
- RHYTHM: Each line = a beat. Short. Punchy. Visual. Quotable.
- DO NOT repeat the same structure twice. Vary the angle each call.
- SILENT AUTO-CHECK before output: "Would this stop the scroll on TikTok? Does this sound like a top creator or a boring ad?" → rewrite until elite.

Output: only the script text. No explanations, no labels, no quotes.` },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.9, // High creativity
      }),
    })

    if (!llmRes.ok) {
      console.error('[UGC Script] LLM error:', llmRes.status)
      return NextResponse.json({ error: 'Error generating script' }, { status: 500 })
    }

    const llmData = await llmRes.json()
    const script = llmData.choices?.[0]?.message?.content?.trim() || ''

    // Extract a topic label from the first sentence
    const firstSentence = script.split(/[.!?]/)[0]?.trim() || ''
    const topicLabel = firstSentence.length > 60 ? firstSentence.substring(0, 57) + '...' : firstSentence

    return NextResponse.json({
      script,
      topicLabel: topic || topicLabel,
      style: style || 'profesional',
    })
  } catch (error) {
    console.error('[UGC Script] Error:', error)
    return NextResponse.json({ error: 'Error generating script' }, { status: 500 })
  }
}
