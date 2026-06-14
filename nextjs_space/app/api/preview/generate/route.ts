export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getUserTurboConfig } from '@/lib/turbo-llm'
import { OPENROUTER_BASE_URL } from '@/lib/turbo-config'

// Preferred model for preview generation (Claude Sonnet 4.6 = best HTML/CSS generator)
const PREVIEW_PREFERRED_MODEL = 'anthropic/claude-sonnet-4.6'

const SYSTEM_PROMPT = `Eres un diseñador web de élite mundial. Tu ÚNICA misión: generar HTML COMPLETO y CINEMATOGRÁFICO.

REGLAS CRÍTICAS:
1. Responde SOLO con <!DOCTYPE html>.....</html> — NADA más, CERO markdown, CERO explicaciones
2. NUNCA uses \`\`\`html — el primer carácter DEBE ser "<"
3. Incluye <script src="https://cdn.tailwindcss.com"></script> y Google Fonts en <head>
4. CSS de animaciones en un solo <style> compacto en <head>
5. Contenido REALISTA en español — CERO lorem ipsum
6. TODAS las secciones solicitadas DEBEN estar completas — navbar, hero, features, testimonios, CTA, footer
7. PRIORIDAD ABSOLUTA: completar el HTML hasta </html> — si necesitas ser más conciso en alguna sección, hazlo, pero NUNCA dejes el documento sin cerrar
8. Usa Tailwind classes en vez de inline styles siempre que sea posible (más compacto)
9. Imágenes: usa https://images.unsplash.com URLs reales o https://i.pravatar.cc para avatares
10. El resultado debe parecer un sitio REAL EN PRODUCCIÓN`

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { prompt } = await request.json()
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt requerido' }, { status: 400 })
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ]

    // Strategy: Try OpenRouter first (better models), fallback to Abacus AI
    let llmResponse: Response | null = null
    let engineUsed = 'abacus'

    // 1) Try user's Turbo Mode (OpenRouter)
    const turboConfig = await getUserTurboConfig(session.user.id)
    if (turboConfig.enabled && turboConfig.apiKey) {
      try {
        // Use the preferred preview model, or fall back to user's selected model
        const modelToUse = PREVIEW_PREFERRED_MODEL

        console.log(`[Preview] Using OpenRouter: ${modelToUse}`)

        const orResponse = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${turboConfig.apiKey}`,
            'HTTP-Referer': process.env.NEXTAUTH_URL || 'https://octopus.app',
            'X-Title': 'OCTOPUS Project Builder',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages,
            temperature: 0.75,
            max_tokens: 32000,
            stream: true,
          }),
        })

        if (orResponse.ok) {
          llmResponse = orResponse
          engineUsed = `openrouter/${modelToUse}`
        } else {
          const errText = await orResponse.text().catch(() => '')
          console.warn(`[Preview] OpenRouter failed (${orResponse.status}): ${errText.substring(0, 150)}, falling back to Abacus`)
        }
      } catch (orErr) {
        console.warn(`[Preview] OpenRouter error:`, orErr, '— falling back to Abacus')
      }
    }

    // 2) Fallback to Abacus AI API
    if (!llmResponse) {
      console.log('[Preview] Using Abacus AI (gpt-4.1)')
      const abacusResponse = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages,
          temperature: 0.7,
          max_tokens: 32000,
          stream: true,
        }),
      })

      if (!abacusResponse.ok) {
        const errText = await abacusResponse.text().catch(() => '')
        console.error(`[Preview] Abacus LLM Error: ${abacusResponse.status} - ${errText.substring(0, 200)}`)
        return NextResponse.json({ error: 'Error generando preview' }, { status: 502 })
      }

      llmResponse = abacusResponse
      engineUsed = 'abacus/gpt-4.1'
    }

    // Stream response (both OpenRouter and Abacus use OpenAI-compatible SSE format)
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Send engine info as first event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ engine: engineUsed })}\n\n`))

        const reader = llmResponse!.body?.getReader()
        if (!reader) { controller.close(); return }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch {}
              }
            }
          }
        } finally {
          reader.releaseLock()
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
    console.error('[Preview Generate] Error:', error)
    return NextResponse.json({ error: 'Error en el procesamiento' }, { status: 500 })
  }
}