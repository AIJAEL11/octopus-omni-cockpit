import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// Detectar si el mensaje pide generar un video/animación
function detectVideoGenerationIntent(message: string): {
  shouldGenerate: boolean
  prompt: string
  frameCount: number
} {
  const lowerMessage = message.toLowerCase()
  
  // Patrones que indican generación de video/animación
  const videoPatterns = [
    /genera(r)?\s+(un)?\s*v[ií]deo/i,
    /crea(r)?\s+(un)?\s*v[ií]deo/i,
    /haz(me)?\s+(un)?\s*v[ií]deo/i,
    /dame\s+(un)?\s*v[ií]deo/i,
    /quiero\s+(un)?\s*v[ií]deo/i,
    /necesito\s+(un)?\s*v[ií]deo/i,
    /genera(r)?\s+(una)?\s*animaci[oó]n/i,
    /crea(r)?\s+(una)?\s*animaci[oó]n/i,
    /anima(r)?\s+/i,
    /make\s+(a)?\s*video/i,
    /create\s+(a)?\s*video/i,
    /generate\s+(a)?\s*video/i,
    /animate\s+/i,
    /animation\s+of/i,
    /gif\s+de/i,
    /gif\s+of/i,
    /secuencia\s+de/i,
    /slideshow/i,
    /clip\s+de/i,
    /corto\s+de/i,
    /en\s+movimiento/i,
    /mov[ií]endo(se)?/i,
  ]
  
  const hasVideoIntent = videoPatterns.some(pattern => pattern.test(lowerMessage))
  
  if (!hasVideoIntent) {
    return { shouldGenerate: false, prompt: '', frameCount: 0 }
  }
  
  // Limpiar el prompt
  let prompt = message
    .replace(/genera(r)?\s+(un)?\s*v[ií]deo\s+(de)?/gi, '')
    .replace(/crea(r)?\s+(un)?\s*v[ií]deo\s+(de)?/gi, '')
    .replace(/haz(me)?\s+(un)?\s*v[ií]deo\s+(de)?/gi, '')
    .replace(/dame\s+(un)?\s*v[ií]deo\s+(de)?/gi, '')
    .replace(/quiero\s+(un)?\s*v[ií]deo\s+(de)?/gi, '')
    .replace(/necesito\s+(un)?\s*v[ií]deo\s+(de)?/gi, '')
    .replace(/genera(r)?\s+(una)?\s*animaci[oó]n\s+(de)?/gi, '')
    .replace(/crea(r)?\s+(una)?\s*animaci[oó]n\s+(de)?/gi, '')
    .replace(/anima(r)?\s+/gi, '')
    .replace(/make\s+(a)?\s*video\s+(of)?/gi, '')
    .replace(/create\s+(a)?\s*video\s+(of)?/gi, '')
    .replace(/generate\s+(a)?\s*video\s+(of)?/gi, '')
    .replace(/gif\s+(de|of)/gi, '')
    .replace(/secuencia\s+de/gi, '')
    .replace(/por\s+favor/gi, '')
    .replace(/please/gi, '')
    .trim()
  
  if (prompt.length < 5) {
    prompt = message
  }
  
  // Determinar cuántos frames generar (4-6)
  const frameCount = 4
  
  return { shouldGenerate: true, prompt, frameCount }
}

// Generar descripción de frame secuencial
function generateFramePrompts(basePrompt: string, frameCount: number): string[] {
  // Crear prompts que representen una secuencia de movimiento
  const frameDescriptions = [
    'initial position, starting pose',
    'early movement, transitioning',
    'mid-action, dynamic motion',
    'near completion, climax of action',
    'final position, ending pose',
    'aftermath, settling down',
  ]
  
  const frames: string[] = []
  
  for (let i = 0; i < frameCount; i++) {
    const description = frameDescriptions[i] || frameDescriptions[frameDescriptions.length - 1]
    frames.push(
      `${basePrompt}, ${description}, frame ${i + 1} of ${frameCount} in sequence, ` +
      `cinematic quality, consistent style throughout, smooth transition, professional animation frame, ` +
      `high quality, detailed, vivid colors`
    )
  }
  
  return frames
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Plan gate: Jarvis Premium feature
    const userId = (session.user as { id?: string }).id || session.user.email || ''
    const gate = await checkPlanGate(userId, 'jarvis_premium')
    if (!gate.allowed) {
      return NextResponse.json({ error: 'plan_limit', gate }, { status: 403 })
    }

    const body = await request.json()
    const { message } = body

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    // Detectar intención de generar video
    const intent = detectVideoGenerationIntent(message)
    
    if (!intent.shouldGenerate) {
      return NextResponse.json({ shouldGenerate: false })
    }

    console.log('Generating video slideshow for:', intent.prompt)

    // Generar prompts para cada frame
    const framePrompts = generateFramePrompts(intent.prompt, intent.frameCount)
    const generatedFrames: string[] = []
    const errors: string[] = []

    // Generar cada frame secuencialmente
    for (let i = 0; i < framePrompts.length; i++) {
      try {
        console.log(`Generating frame ${i + 1}/${framePrompts.length}...`)
        
        const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'route-llm',
            messages: [
              {
                role: 'user',
                content: framePrompts[i],
              },
            ],
            modalities: ['image'],
          }),
        })

        if (!response.ok) {
          console.error(`Frame ${i + 1} generation failed:`, await response.text())
          errors.push(`Frame ${i + 1} failed`)
          continue
        }

        const data = await response.json()
        
        // Extraer URL de imagen (misma lógica que generate-image)
        let imageUrl: string | null = null
        
        if (data.choices && data.choices[0]) {
          const choice = data.choices[0]
          
          if (choice.message?.image_url) {
            imageUrl = choice.message.image_url
          } else if (choice.message?.images && choice.message.images[0]) {
            const img = choice.message.images[0]
            imageUrl = img.url || img
          } else if (choice.message?.content) {
            const content = choice.message.content
            
            if (typeof content === 'string') {
              if (content.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(content.substring(0, 100))) {
                imageUrl = `data:image/png;base64,${content}`
              } else {
                const urlMatch = content.match(/https?:\/\/[^\s\)\]"']+\.(png|jpg|jpeg|webp|gif)(\?[^\s\)\]"']*)?/i)
                if (urlMatch) {
                  imageUrl = urlMatch[0]
                }
                if (!imageUrl) {
                  const s3Match = content.match(/https?:\/\/[^\s\)\]"']+/i)
                  if (s3Match && (s3Match[0].includes('s3.') || s3Match[0].includes('cdn') || s3Match[0].includes('blob') || s3Match[0].includes('storage'))) {
                    imageUrl = s3Match[0]
                  }
                }
              }
            } else if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'image_url') {
                  imageUrl = item.image_url?.url || item.url
                } else if (item.type === 'image') {
                  const imgData = item.data || item.url || item.image_url
                  if (imgData && imgData.length > 1000 && /^[A-Za-z0-9+/=]+$/.test(imgData.substring(0, 100))) {
                    imageUrl = `data:image/png;base64,${imgData}`
                  } else {
                    imageUrl = imgData
                  }
                }
              }
            }
          }
          
          if (!imageUrl && data.data && data.data[0]) {
            const imgData = data.data[0]
            if (imgData.url) {
              imageUrl = imgData.url
            } else if (imgData.b64_json) {
              imageUrl = `data:image/png;base64,${imgData.b64_json}`
            }
          }
          
          if (!imageUrl && data.images && data.images[0]) {
            const img = data.images[0]
            imageUrl = img.url || img
          }
        }

        if (imageUrl) {
          generatedFrames.push(imageUrl)
          console.log(`Frame ${i + 1} generated successfully`)
        } else {
          errors.push(`Frame ${i + 1}: no image extracted`)
        }

      } catch (frameError) {
        console.error(`Frame ${i + 1} error:`, frameError)
        errors.push(`Frame ${i + 1}: ${frameError}`)
      }
    }

    // Si generamos al menos 2 frames, considerarlo éxito
    if (generatedFrames.length >= 2) {
      return NextResponse.json({
        shouldGenerate: true,
        frames: generatedFrames,
        prompt: intent.prompt,
        totalFrames: generatedFrames.length,
        requestedFrames: intent.frameCount,
      })
    } else {
      console.error('Not enough frames generated:', errors)
      return NextResponse.json({
        shouldGenerate: false,
        error: 'No se pudieron generar suficientes frames para el video',
        details: errors,
      })
    }

  } catch (error) {
    console.error('JARVIS Video Generation Error:', error)
    return NextResponse.json(
      { error: 'Error al generar el video', shouldGenerate: false },
      { status: 500 }
    )
  }
}
