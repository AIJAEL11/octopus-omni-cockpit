import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkPlanGate } from '@/lib/plan-gate'
import { enhanceImagePrompt, getImageDimensions, type DashboardContext } from '@/lib/jarvis-enhancer'
import { 
  isImageModification, 
  extractVisualAttributes, 
  mergeVisualAttributes,
  buildPromptFromAttributes,
  type VisualAttributes 
} from '@/lib/jarvis-memory'
import { generateSelfCorrection } from '@/lib/jarvis-intelligence'

export const dynamic = 'force-dynamic'

// Memoria visual en servidor (para la sesión)
const sessionMemory: Map<string, {
  lastPrompt: string
  lastAttributes: VisualAttributes
  imageCount: number
}> = new Map()

// Detectar si el mensaje pide generar una imagen
function detectImageGenerationIntent(message: string): {
  shouldGenerate: boolean
  prompt: string
  isModification: boolean
} {
  const lowerMessage = message.toLowerCase()
  
  // Patrones que indican generación de imagen
  const imagePatterns = [
    /genera(r)?\s+(una?\s+)?imagen/i,
    /crea(r)?\s+(una?\s+)?imagen/i,
    /dibuja(r)?\s+(una?\s+)?/i,
    /dame\s+(una?\s+)?imagen/i,
    /muestra(me)?\s+(una?\s+)?imagen/i,
    /hazme\s+(una?\s+)?imagen/i,
    /quiero\s+(una?\s+)?imagen/i,
    /necesito\s+(una?\s+)?imagen/i,
    /podr[ií]as\s+(generar|crear|dibujar|hacer)/i,
    /genera(r)?\s+un\s+gr[aá]fico/i,
    /crea(r)?\s+un\s+gr[aá]fico/i,
    /visualiza(r)?/i,
    /ilustra(r)?/i,
    /make\s+(an?\s+)?image/i,
    /create\s+(an?\s+)?image/i,
    /draw\s+/i,
    /generate\s+(an?\s+)?image/i,
    /show\s+me\s+(an?\s+)?image/i,
  ]
  
  // Detectar si es modificación de imagen previa
  const isModification = isImageModification(message)
  
  const hasImageIntent = imagePatterns.some(pattern => pattern.test(lowerMessage))
  
  if (!hasImageIntent && !isModification) {
    // También detectar peticiones implícitas con descripción de escena
    const implicitPatterns = [
      /un\s+gat[io]t?o?\s+.*?(en|sobre|con|sentad)/i,
      /una?\s+(perr[io]t?o?|coch[eo]|casa|persona|paisaje)/i,
      /foto\s+de/i,
      /imagen\s+de/i,
      /dibujo\s+de/i,
      /ilustraci[oó]n\s+de/i,
    ]
    
    const hasImplicitIntent = implicitPatterns.some(pattern => pattern.test(lowerMessage))
    
    if (!hasImplicitIntent) {
      return { shouldGenerate: false, prompt: '', isModification: false }
    }
  }
  
  // Limpiar el prompt extrayendo la descripción de la imagen
  let prompt = message
    .replace(/genera(r)?\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/crea(r)?\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/dibuja(r)?\s+/gi, '')
    .replace(/dame\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/muestra(me)?\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/hazme\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/quiero\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/necesito\s+(una?\s+)?imagen\s+(de)?/gi, '')
    .replace(/podr[ií]as\s+(generar|crear|dibujar|hacer)\s+(una?\s+)?/gi, '')
    .replace(/visualiza(r)?\s+/gi, '')
    .replace(/ilustra(r)?\s+/gi, '')
    .replace(/por\s+favor/gi, '')
    .replace(/please/gi, '')
    .trim()
  
  // Si el prompt quedó vacío o muy corto, usar el mensaje original
  if (prompt.length < 5) {
    prompt = message
  }
  
  return { shouldGenerate: true, prompt, isModification }
}

// Llamar al API con retry y self-correction
async function callImageAPI(
  prompt: string,
  aspectRatio: string,
  attemptNumber: number = 0
): Promise<{
  success: boolean
  imageUrl?: string
  error?: string
  correctedPrompt?: string
}> {
  const dimensions = getImageDimensions(aspectRatio)
  
  try {
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
            content: prompt,
          },
        ],
        modalities: ['image'],
        image_config: {
          width: dimensions.width,
          height: dimensions.height
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Image API error:', errorText)
      
      // Intentar auto-corrección
      const correction = generateSelfCorrection(prompt, errorText, attemptNumber)
      if (correction) {
        console.log(`Self-correction attempt ${correction.attemptNumber}: ${correction.correctedPrompt}`)
        return callImageAPI(correction.correctedPrompt, aspectRatio, correction.attemptNumber)
      }
      
      return { success: false, error: errorText }
    }

    const data = await response.json()
    let imageUrl: string | null = null
    
    // Extraer imagen de la respuesta (mismo código de extracción)
    if (data.choices && data.choices[0]) {
      const choice = data.choices[0]
      
      if (choice.message?.image_url) {
        // image_url puede ser string directo o un objeto anidado
        const rawImgUrl = choice.message.image_url
        if (typeof rawImgUrl === 'string') {
          imageUrl = rawImgUrl
        } else if (rawImgUrl?.url) {
          imageUrl = rawImgUrl.url
        } else if (rawImgUrl?.image_url?.url) {
          imageUrl = rawImgUrl.image_url.url
        } else if (rawImgUrl?.image_url && typeof rawImgUrl.image_url === 'string') {
          imageUrl = rawImgUrl.image_url
        }
      } else if (choice.message?.images && choice.message.images[0]) {
        const img = choice.message.images[0]
        imageUrl = typeof img === 'string' ? img : (img.url || img)
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
    
    if (!imageUrl && attemptNumber < 2) {
      // Reintentar con prompt simplificado
      const correction = generateSelfCorrection(prompt, 'no_image_returned', attemptNumber)
      if (correction) {
        return callImageAPI(correction.correctedPrompt, aspectRatio, correction.attemptNumber)
      }
    }

    return { 
      success: !!imageUrl, 
      imageUrl: imageUrl || undefined,
      error: imageUrl ? undefined : 'No se pudo extraer la imagen'
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    
    // Intentar auto-corrección para errores de red
    const correction = generateSelfCorrection(prompt, errorMsg, attemptNumber)
    if (correction) {
      return callImageAPI(correction.correctedPrompt, aspectRatio, correction.attemptNumber)
    }
    
    return { success: false, error: errorMsg }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { message, dashboardContext, visualMemory: clientMemory } = body

    if (!message) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    const userId = session.user.id || session.user.email || 'anonymous'

    // Plan gate: Jarvis Premium feature
    const gate = await checkPlanGate(userId, 'jarvis_premium')
    if (!gate.allowed) {
      return NextResponse.json({ error: 'plan_limit', gate }, { status: 403 })
    }

    // Detectar intención de generar imagen
    const intent = detectImageGenerationIntent(message)
    
    if (!intent.shouldGenerate) {
      return NextResponse.json({ shouldGenerate: false })
    }

    // Obtener memoria de sesión
    const memory = sessionMemory.get(userId) || {
      lastPrompt: '',
      lastAttributes: {} as VisualAttributes,
      imageCount: 0
    }

    let finalPrompt: string
    let visualAttributes: VisualAttributes
    
    // 1. MEMORIA VISUAL: Si es modificación, combinar con atributos previos
    if (intent.isModification && memory.lastAttributes?.subject) {
      visualAttributes = mergeVisualAttributes(memory.lastAttributes, intent.prompt)
      finalPrompt = buildPromptFromAttributes(visualAttributes)
      console.log('Visual continuity: Merging with previous attributes')
    } else {
      // 2. PROMPT ENHANCER: Mejorar prompt automáticamente
      const context: DashboardContext = dashboardContext || {}
      const enhanced = enhanceImagePrompt(intent.prompt, context)
      
      finalPrompt = enhanced.enhancedPrompt
      visualAttributes = extractVisualAttributes(intent.prompt)
      
      console.log('Prompt Enhancement:', {
        original: intent.prompt,
        enhanced: enhanced.enhancedPrompt,
        category: enhanced.detectedCategory,
        aspectRatio: enhanced.aspectRatio
      })
    }

    // 3. ASPECT RATIO INTELIGENTE
    const enhanced = enhanceImagePrompt(intent.prompt, dashboardContext || {})
    const aspectRatio = enhanced.aspectRatio

    // 4. LLAMAR API CON SELF-CORRECTION
    console.log('Generating image with prompt:', finalPrompt.substring(0, 100) + '...')
    const result = await callImageAPI(finalPrompt, aspectRatio)

    if (!result.success || !result.imageUrl) {
      console.error('Image generation failed:', result.error)
      return NextResponse.json({
        shouldGenerate: true,
        error: result.error || 'No se pudo generar la imagen',
        imageUrl: null
      })
    }

    // 5. GUARDAR EN MEMORIA VISUAL para continuidad
    sessionMemory.set(userId, {
      lastPrompt: finalPrompt,
      lastAttributes: visualAttributes,
      imageCount: memory.imageCount + 1
    })

    // Construir respuesta mejorada con metadata
    const enhancementInfo = intent.isModification 
      ? '✨ Imagen modificada basada en la anterior'
      : `✨ Prompt mejorado automáticamente (${enhanced.detectedCategory}, ${aspectRatio})`;

    return NextResponse.json({
      shouldGenerate: true,
      imageUrl: result.imageUrl,
      textResponse: `¡Aquí tienes tu imagen! 🎨\n\n${enhancementInfo}`,
      prompt: intent.prompt,
      enhancedPrompt: finalPrompt,
      metadata: {
        category: enhanced.detectedCategory,
        aspectRatio,
        isModification: intent.isModification,
        visualAttributes,
        inferredParams: enhanced.inferredParams
      }
    })

  } catch (error) {
    console.error('JARVIS Image Generation Error:', error)
    return NextResponse.json(
      { error: 'Error al generar la imagen', shouldGenerate: false },
      { status: 500 }
    )
  }
}
