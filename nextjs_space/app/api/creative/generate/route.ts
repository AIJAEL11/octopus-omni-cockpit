import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'
import {
  enhanceCreativePrompt,
  getDimensions,
  generateVideoFramePrompts,
  buildCopyPrompt,
  COPY_CREATOR_PROMPT,
  IMAGE_CREATOR_PROMPT,
} from '@/lib/creative-agents'
import { uploadBufferToS3Public } from '@/lib/s3'
import { decryptApiKey } from '@/lib/crypto'
import { getImageModel, DEFAULT_IMAGE_MODEL_ID } from '@/lib/image-models'

export const dynamic = 'force-dynamic'
// Permitir ejecución larga (modelos como GPT-5.4 Image 2 pueden tardar 60-90s)
export const maxDuration = 300

// Extraer URL de imagen de respuesta del LLM — robusto contra múltiples formatos
function extractImageUrl(data: Record<string, unknown>): string | null {
  console.log('[extractImageUrl] Raw response keys:', JSON.stringify(Object.keys(data)))
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = data.choices as any[] | undefined
  if (choices && choices[0]) {
    const choice = choices[0]
    const msg = choice.message
    
    // Log detallado del mensaje completo
    console.log('[extractImageUrl] choice keys:', JSON.stringify(Object.keys(choice)))
    if (msg) {
      console.log('[extractImageUrl] message keys:', JSON.stringify(Object.keys(msg)))
      console.log('[extractImageUrl] message.content type:', typeof msg.content)
      if (typeof msg.content === 'string') {
        console.log('[extractImageUrl] content preview (500 chars):', msg.content.substring(0, 500))
      } else if (msg.content) {
        console.log('[extractImageUrl] content value:', JSON.stringify(msg.content).substring(0, 500))
      }
    } else {
      console.log('[extractImageUrl] No message in choice, full choice:', JSON.stringify(choice).substring(0, 500))
    }
    
    if (!msg) return null

    // Caso: message.image_url directo (string)
    if (typeof msg.image_url === 'string') return msg.image_url
    // Caso: message.image_url como objeto { url: "..." }
    if (msg.image_url && typeof msg.image_url === 'object') {
      const imgUrl = (msg.image_url as { url?: string }).url
      if (imgUrl) return imgUrl
    }
    
    // Caso: message.images array (formato RouteLLM confirmado)
    // Estructura: images: [{ type: "image_url", image_url: { url: "data:image/png;base64,..." } }]
    if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
      const img = msg.images[0]
      if (typeof img === 'string') return img
      if (img && typeof img === 'object') {
        // { image_url: { url: "..." } }
        if (img.image_url) {
          if (typeof img.image_url === 'string') return img.image_url
          if (typeof img.image_url === 'object' && img.image_url.url) return img.image_url.url
        }
        // { url: "..." }
        if (typeof img.url === 'string') return img.url
        // { data: "base64..." } o { b64_json: "..." }
        if (typeof img.data === 'string') return img.data.length > 1000 ? `data:image/png;base64,${img.data}` : img.data
        if (typeof img.b64_json === 'string') return `data:image/png;base64,${img.b64_json}`
      }
    }
    
    const content = msg.content
    
    // Caso: content es un solo objeto { type: "image_url", image_url: { url: "..." } }
    if (content && typeof content === 'object' && !Array.isArray(content)) {
      const obj = content as Record<string, unknown>
      if (obj.type === 'image_url' && obj.image_url) {
        const url = (obj.image_url as { url?: string }).url
        if (url) return url
      }
      // Cualquier objeto con propiedad url
      if (typeof (obj as { url?: string }).url === 'string') return (obj as { url: string }).url
      if (obj.type === 'image') {
        const imgData = (obj.data || obj.url) as string
        if (typeof imgData === 'string') return imgData.length > 1000 ? `data:image/png;base64,${imgData}` : imgData
      }
    }
    
    // Caso: content es string — buscar URL o base64
    if (typeof content === 'string') {
      // URL directa de imagen
      const anyUrl = content.match(/https?:\/\/[^\s\)\]"'<>]+/i)
      if (anyUrl) return anyUrl[0]
      // Base64
      if (content.length > 1000 && /^[A-Za-z0-9+/=\n]+$/.test(content.substring(0, 200).replace(/\s/g, ''))) {
        return `data:image/png;base64,${content.replace(/\s/g, '')}`
      }
    }
    
    // Caso: content es array de objetos
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== 'object') continue
        if (item.type === 'image_url') {
          const imgUrlObj = item.image_url
          if (typeof imgUrlObj === 'string') return imgUrlObj
          if (imgUrlObj && typeof imgUrlObj === 'object') return imgUrlObj.url || null
        }
        if (item.type === 'image') {
          const imgData = (item.data || item.url) as string
          if (typeof imgData === 'string') {
            return imgData.length > 1000 ? `data:image/png;base64,${imgData}` : imgData
          }
        }
        // Cualquier item con url
        if (typeof item.url === 'string') return item.url
      }
    }
  }
  
  // Fallback: data.data[] (formato DALL-E)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topData = (data.data as any[]) || []
  if (topData[0]) {
    if (topData[0].url) return topData[0].url
    if (topData[0].b64_json) return `data:image/png;base64,${topData[0].b64_json}`
  }
  
  // Fallback: data.images[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topImages = (data.images as any[]) || []
  if (topImages[0]?.url) return topImages[0].url
  
  // Último recurso: serializar todo y buscar cualquier URL
  const fullStr = JSON.stringify(data)
  const urlInJson = fullStr.match(/https?:\/\/[^\s\)\]"'\\<>]+/i)
  if (urlInJson) {
    console.log('[extractImageUrl] Found URL via full JSON scan:', urlInJson[0])
    return urlInJson[0]
  }
  
  console.error('[extractImageUrl] FAILED. Full response (1000 chars):', fullStr.substring(0, 1000))
  return null
}

// Determinar aspect ratio según format / orientation
function pickAspectRatio(format?: string, orientation?: string): string {
  if (orientation === 'vertical') return '9:16'
  if (orientation === 'horizontal') return '16:9'
  if (format === 'story' || format === 'reel' || format === 'vertical') return '9:16'
  if (format === 'cover' || format === 'landscape' || format === 'banner' || format === 'horizontal') return '16:9'
  return '1:1' // post / square / default
}

// Generar una imagen — multi-modelo con fallback RouteLLM
// Si imageModel se provee y el usuario tiene clave turbo_*, usa OpenRouter.
// De lo contrario, usa RouteLLM (default — no requiere clave del usuario).
async function generateImage(
  prompt: string,
  platform?: string,
  format?: string,
  style?: string,
  imageModel?: string | null,
  orientation?: string,
  userId?: string
): Promise<{ url: string; enhancedPrompt: string; modelUsed: string }> {
  const enhanced = enhanceCreativePrompt(prompt, platform, format, style)

  // Determinar si usar OpenRouter o RouteLLM
  const normalizedModel = imageModel && imageModel !== 'default' && imageModel !== 'auto'
    ? imageModel
    : null
  const useOpenRouter = !!normalizedModel

  // Buscar clave turbo_* del usuario (si hay userId)
  const apiKeyRecord = useOpenRouter && userId
    ? await prisma.apiKey.findFirst({
        where: { userId, serviceType: { startsWith: 'turbo_' }, status: 'active' },
      })
    : null

  const actuallyUseOpenRouter = useOpenRouter && !!apiKeyRecord

  let apiUrl: string
  let apiHeaders: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let apiBody: Record<string, any>
  let modelLabel: string

  if (actuallyUseOpenRouter && normalizedModel) {
    // Ruta OpenRouter — usa el modelo seleccionado
    const modelMeta = getImageModel(normalizedModel)
    const kind = modelMeta?.kind ?? 'chat-image'
    const supportsImageConfig = (modelMeta?.supportsAspectRatio ?? false) || (modelMeta?.supportsImageSize ?? false)
    modelLabel = modelMeta?.emoji ? `${modelMeta.emoji} ${normalizedModel}` : normalizedModel

    // Las keys turbo_* se guardan RAW (sin encriptar) en DB, consistente con
    // /api/settings/turbo. Limpiar cualquier whitespace accidental.
    const rawKey = apiKeyRecord!.apiKey.trim()
    apiUrl = 'https://openrouter.ai/api/v1/chat/completions'
    apiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${rawKey}`,
      'HTTP-Referer': 'https://octopus.app',
      'X-Title': 'OCTOPUS Chat',
    }

    apiBody = {
      model: normalizedModel,
      messages: [{ role: 'user', content: enhanced }],
      // chat-image models (Gemini, GPT-5.4 Image 2) devuelven texto+imagen;
      // image-only models (FLUX, Riverflow, Seedream) devuelven sólo imagen.
      modalities: kind === 'chat-image' ? ['image', 'text'] : ['image'],
    }

    if (supportsImageConfig) {
      apiBody.image_config = {
        aspect_ratio: pickAspectRatio(format, orientation),
      }
    }

    // Actualizar uso de la key (fire-and-forget)
    prisma.apiKey.update({
      where: { id: apiKeyRecord!.id },
      data: { lastUsed: new Date(), usageCount: { increment: 1 } },
    }).catch(() => {})
  } else {
    // Fallback: RouteLLM (default — gratis, siempre disponible)
    modelLabel = 'route-llm'
    apiUrl = 'https://routellm.abacus.ai/v1/chat/completions'
    apiHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
    }
    apiBody = {
      model: 'route-llm',
      messages: [{ role: 'user', content: enhanced }],
      modalities: ['image'],
    }
  }

  console.log(`[generateImage] Using model: ${modelLabel} — endpoint: ${apiUrl}`)

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: apiHeaders,
    body: JSON.stringify(apiBody),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body')
    console.error(`[generateImage] API error (${modelLabel}):`, response.status, errorBody.substring(0, 500))

    // Si falla OpenRouter, intentar fallback silencioso a RouteLLM
    if (actuallyUseOpenRouter) {
      console.log(`[generateImage] OpenRouter failed → fallback silencioso a RouteLLM`)
      const fallbackResponse = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'route-llm',
          messages: [{ role: 'user', content: enhanced }],
          modalities: ['image'],
        }),
      })

      if (!fallbackResponse.ok) {
        throw new Error(`Error al generar imagen. Intenta con otro prompt.`)
      }

      const fallbackData = await fallbackResponse.json()
      const fallbackUrl = extractImageUrl(fallbackData)
      if (!fallbackUrl) throw new Error('No se pudo extraer la imagen generada')
      const fallbackFinal = await persistIfDataUri(fallbackUrl)
      return { url: fallbackFinal, enhancedPrompt: enhanced, modelUsed: 'route-llm (fallback)' }
    }

    throw new Error(`Error al generar imagen. Intenta con otro prompt.`)
  }

  const data = await response.json()
  const imageUrl = extractImageUrl(data)

  if (!imageUrl) {
    throw new Error('No se pudo extraer la imagen generada')
  }

  // Si es base64 data URI (algunos modelos lo devuelven así), subirlo a S3
  // para evitar guardar multi-megabyte strings en la DB y achicar el payload HTTP.
  const finalUrl = await persistIfDataUri(imageUrl)
  console.log(`[generateImage] ✅ Imagen lista (${modelLabel}) — URL len: ${finalUrl.length}`)

  return { url: finalUrl, enhancedPrompt: enhanced, modelUsed: modelLabel }
}

// Si la URL es un data URI base64, subirla a S3 y devolver la URL pública.
// Si ya es una URL http(s), devolverla tal cual.
async function persistIfDataUri(url: string): Promise<string> {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const match = url.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return url // dejar que upstream lo maneje
  try {
    const ext = match[1]
    const base64Data = match[2]
    const buffer = Buffer.from(base64Data, 'base64')
    const fileName = `chat-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { publicUrl } = await uploadBufferToS3Public(buffer, fileName, `image/${ext}`)
    console.log(`[persistIfDataUri] base64 (${buffer.length} bytes) → S3: ${publicUrl}`)
    return publicUrl
  } catch (err) {
    console.error('[persistIfDataUri] S3 upload failed, devolviendo data URI original:', err)
    return url
  }
}

// Subir base64 data URI a S3 como archivo público
async function uploadBase64FrameToS3(dataUri: string, index: number): Promise<string> {
  // Extraer el base64 del data URI
  const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) {
    // Si no es data URI, podría ser una URL directa — usarla tal cual
    if (dataUri.startsWith('http')) return dataUri
    throw new Error(`Frame ${index}: formato de imagen no reconocido`)
  }
  const ext = match[1] // png, jpeg, etc
  const base64Data = match[2]
  const buffer = Buffer.from(base64Data, 'base64')
  const fileName = `video-frame-${index}-${Date.now()}.${ext}`
  const { publicUrl } = await uploadBufferToS3Public(buffer, fileName, `image/${ext}`)
  console.log(`[uploadFrame] Frame ${index} subido a S3: ${publicUrl}`)
  return publicUrl
}

// Llamar FFmpeg API (async con polling)
async function callFfmpegApi(
  frameUrls: string[],
  width: number,
  height: number
): Promise<string> {
  const apiKey = process.env.ABACUSAI_API_KEY
  if (!apiKey) throw new Error('ABACUSAI_API_KEY no configurada')

  // Construir input_files map
  const inputFiles: Record<string, string> = {}
  frameUrls.forEach((url, i) => {
    inputFiles[`in_${i + 1}`] = url
  })

  const n = frameUrls.length
  const secPerFrame = 3

  // Construir comando FFmpeg simple y limpio:
  // 1. Cada frame como input con -loop 1 -t N
  // 2. Scale forzado a resolución exacta (sin expresiones con paréntesis)
  // 3. Concat simple (sin xfade que puede no estar soportado)
  // 4. Sin comillas dobles ni flag -y
  const inputArgs = frameUrls.map((_, i) => `-loop 1 -t ${secPerFrame} -i {{in_${i + 1}}}`).join(' ')
  
  // Filter: scale cada stream + concat
  const scaleFilters = frameUrls.map((_, i) => 
    `[${i}:v]scale=${width}:${height},setsar=1[v${i}]`
  ).join(';')
  const concatInputs = frameUrls.map((_, i) => `[v${i}]`).join('')
  const filterComplex = `${scaleFilters};${concatInputs}concat=n=${n}:v=1:a=0[out]`

  const ffmpegCommand = `${inputArgs} -filter_complex ${filterComplex} -map [out] -c:v libx264 -pix_fmt yuv420p {{out_1}}`

  const outputFiles: Record<string, string> = { out_1: 'video.mp4' }

  console.log('[FFmpeg] Comando:', ffmpegCommand)
  console.log('[FFmpeg] Input files:', JSON.stringify(inputFiles))

  // Crear request
  const createRes = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: apiKey,
      ffmpeg_command: ffmpegCommand,
      input_files: inputFiles,
      output_files: outputFiles,
    }),
  })

  if (!createRes.ok) {
    const errBody = await createRes.text().catch(() => '')
    console.error('[FFmpeg] Error al crear request:', createRes.status, errBody)
    throw new Error(`FFmpeg API error: ${createRes.status}`)
  }

  const createData = await createRes.json()
  console.log('[FFmpeg] Create response:', JSON.stringify(createData).substring(0, 500))
  const requestId = createData.request_id
  if (!requestId) {
    console.error('[FFmpeg] No request_id en respuesta:', JSON.stringify(createData))
    throw new Error('FFmpeg no devolvió request_id')
  }

  console.log('[FFmpeg] Request ID:', requestId)

  // Polling por resultado
  const maxAttempts = 120
  const pollInterval = 2000
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollInterval))
    
    const statusRes = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: requestId,
        deployment_token: apiKey,
      }),
    })

    // Parsear respuesta — puede ser 200 o 400 con JSON válido
    let statusData: Record<string, unknown> | null = null
    const rawBody = await statusRes.text().catch(() => '')
    
    try {
      statusData = JSON.parse(rawBody)
    } catch {
      // Body no es JSON
    }

    if (!statusRes.ok && !statusData) {
      console.warn(`[FFmpeg] Poll ${attempt + 1} error: ${statusRes.status} body: ${rawBody.substring(0, 300)}`)
      if (attempt > 4) {
        throw new Error(`FFmpeg polling error: ${rawBody.substring(0, 200)}`)
      }
      continue
    }

    // Si tenemos JSON, revisar el status del job
    const jobStatus = (statusData as Record<string, unknown>)?.status as string || 'UNKNOWN'
    console.log(`[FFmpeg] Poll ${attempt + 1}: HTTP=${statusRes.status} status=${jobStatus}`)

    if (jobStatus === 'SUCCESS') {
      const result = statusData as Record<string, unknown>
      const resultObj = result?.result as Record<string, unknown> | undefined
      const nestedResult = resultObj?.result as Record<string, string> | undefined
      const outputUrl = nestedResult?.out_1
        || (resultObj as Record<string, string> | undefined)?.out_1
      if (outputUrl) {
        console.log('[FFmpeg] Video listo:', outputUrl)
        return outputUrl
      }
      // Fallback: buscar URL en toda la respuesta
      const allStr = JSON.stringify(statusData)
      console.log('[FFmpeg] SUCCESS response (500 chars):', allStr.substring(0, 500))
      const urlMatch = allStr.match(/https?:\/\/[^\s"'\\]+\.mp4[^\s"'\\]*/i)
        || allStr.match(/https?:\/\/[^\s"'\\]+/i)
      if (urlMatch) {
        console.log('[FFmpeg] Video URL via scan:', urlMatch[0])
        return urlMatch[0]
      }
      throw new Error('FFmpeg completó pero no devolvió URL del video')
    }

    if (jobStatus === 'FAILED') {
      const resultObj = (statusData as Record<string, unknown>)?.result as Record<string, unknown> | undefined
      const errorMsg = (resultObj?.error as string) 
        || (statusData as Record<string, unknown>)?.error as string 
        || 'error desconocido'
      console.error('[FFmpeg] Falló:', rawBody.substring(0, 500))
      throw new Error(`FFmpeg falló: ${errorMsg}`)
    }
    
    // PROCESSING — seguir esperando
  }

  throw new Error('FFmpeg timeout — el video tardó demasiado en procesarse')
}

// Generar video real MP4 con FFmpeg
async function generateVideo(
  prompt: string,
  frameCount: number = 4
): Promise<{ videoUrl: string; thumbnail: string; frames: string[]; enhancedPrompt: string }> {
  const framePrompts = generateVideoFramePrompts(prompt, frameCount)
  const frames: string[] = []

  // Paso 1: Generar frames con IA
  for (let i = 0; i < framePrompts.length; i++) {
    try {
      const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'route-llm',
          messages: [{ role: 'user', content: framePrompts[i] }],
          modalities: ['image'],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const url = extractImageUrl(data)
        if (url) frames.push(url)
      }
    } catch (err) {
      console.error(`Frame ${i + 1} error:`, err)
    }
  }

  if (frames.length < 2) {
    throw new Error('No se pudieron generar suficientes frames para el video')
  }

  // Guardar thumbnail (primer frame como base64)
  const thumbnail = frames[0]

  // Paso 2: Subir frames a S3 como archivos públicos
  console.log(`[generateVideo] Subiendo ${frames.length} frames a S3...`)
  const publicFrameUrls: string[] = []
  for (let i = 0; i < frames.length; i++) {
    const publicUrl = await uploadBase64FrameToS3(frames[i], i)
    publicFrameUrls.push(publicUrl)
  }

  // Paso 3: Combinar con FFmpeg en video MP4
  // Usar resolución 1080x1920 para Reel vertical
  console.log('[generateVideo] Llamando FFmpeg API para crear MP4...')
  const videoUrl = await callFfmpegApi(publicFrameUrls, 1080, 1920)

  return { videoUrl, thumbnail, frames, enhancedPrompt: prompt }
}

// ═══════════════════════════════════════════════════════════════════
// Generar video con IA real — fal.ai Kling 2.6 Pro (text-to-video)
// ═══════════════════════════════════════════════════════════════════
// Mapeo de modelos de video a endpoints fal.ai
const VIDEO_MODEL_ENDPOINTS: Record<string, { endpoint: string; label: string; supportsDuration?: boolean; defaultDuration?: string; supportsAudio?: boolean }> = {
  'kling-2.6-pro': { endpoint: 'fal-ai/kling-video/v2.6/pro/text-to-video', label: 'Kling 2.6 Pro' },
  'kling-v3-pro': { endpoint: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling V3 Pro' },
  'kling-o3-pro': { endpoint: 'fal-ai/kling-video/o3/pro/text-to-video', label: 'Kling O3 Pro' },
  'kling-3-pro': { endpoint: 'fal-ai/kling-video/v3/pro/text-to-video', label: 'Kling 3.0 Pro', supportsAudio: true },
  'hailuo-2.3': { endpoint: 'fal-ai/minimax-video/video-01-live/text-to-video', label: 'Hailuo 2.3', defaultDuration: '6' },
  'wan-2.7': { endpoint: 'fal-ai/wan/v2.7/text-to-video', label: 'Wan 2.7', defaultDuration: '5' },
  'seedance-2': { endpoint: 'fal-ai/seedance/v2/text-to-video', label: 'Seedance 2', supportsAudio: true },
  'veo-3.1': { endpoint: 'fal-ai/veo3/text-to-video', label: 'Veo 3.1 (Google)', supportsAudio: true, defaultDuration: '5' },
  'veo-3.1-fast': { endpoint: 'fal-ai/veo3/fast/text-to-video', label: 'Veo 3.1 Fast', defaultDuration: '5' },
}

async function generateVideoAI(
  prompt: string,
  format?: string,
  userId?: string,
  videoModel?: string
): Promise<{ videoUrl: string; thumbnail: string; enhancedPrompt: string; modelUsed: string }> {
  // 1. Obtener API key del usuario desde BD, fallback a .env
  let falKey: string | null = null
  let keySource = 'env'

  if (userId) {
    try {
      const userApiKey = await prisma.apiKey.findFirst({
        where: { userId, serviceType: 'falai', status: 'active' },
      })
      if (userApiKey) {
        falKey = decryptApiKey(userApiKey.apiKey)
        keySource = 'user'
        // Actualizar lastUsed y usageCount
        await prisma.apiKey.update({
          where: { id: userApiKey.id },
          data: { lastUsed: new Date(), usageCount: { increment: 1 } },
        }).catch(() => {})
      }
    } catch (e) {
      console.warn('[generateVideoAI] Error buscando key del usuario:', e)
    }
  }

  // Fallback a key del servidor
  if (!falKey) {
    falKey = process.env.FAL_KEY || null
    keySource = 'env'
  }

  if (!falKey) {
    throw new Error(
      'No tienes una API key de fal.ai configurada. Ve a API Hub para agregar tu key de fal.ai.'
    )
  }

  // 2. Resolver modelo y endpoint
  const modelId = videoModel && VIDEO_MODEL_ENDPOINTS[videoModel] ? videoModel : 'kling-2.6-pro'
  const modelConfig = VIDEO_MODEL_ENDPOINTS[modelId]
  const endpoint = modelConfig.endpoint
  const modelLabel = modelConfig.label

  // 3. Mapear formato a aspect_ratio
  const aspectMap: Record<string, string> = {
    reel: '9:16',
    story: '9:16',
    square: '1:1',
    post: '1:1',
    banner: '16:9',
    cover: '16:9',
  }
  const aspectRatio = aspectMap[format || 'reel'] || '16:9'

  // 4. Enriquecer prompt
  const enhancedPrompt = `Cinematic high-quality video: ${prompt}. Smooth camera movement, professional lighting, vivid colors, 4K quality.`

  console.log(`[generateVideoAI] Submitting to ${modelLabel} — aspect: ${aspectRatio} — key: ${keySource}`)

  // 5. Enviar a la cola de fal.ai
  const submitRes = await fetch(
    `https://queue.fal.run/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falKey}`,
      },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        duration: modelConfig.defaultDuration || '5',
        aspect_ratio: aspectRatio,
        negative_prompt: 'blur, distort, low quality, watermark, text overlay',
        cfg_scale: 0.5,
        ...(modelConfig.supportsAudio ? { generate_audio: true } : { generate_audio: false }),
      }),
    }
  )

  if (!submitRes.ok) {
    const errBody = await submitRes.text().catch(() => 'unknown')
    console.error('[generateVideoAI] Submit failed:', submitRes.status, errBody)
    if (submitRes.status === 401 || submitRes.status === 403) {
      throw new Error('Tu API key de fal.ai no es válida o ha expirado. Revisa tu configuración en API Hub.')
    }
    throw new Error(`Error al enviar video a fal.ai (${submitRes.status})`)
  }

  const submitData = await submitRes.json()
  const { request_id, status_url, response_url } = submitData as {
    request_id: string
    status_url: string
    response_url: string
  }
  console.log(`[generateVideoAI] Queued — request_id: ${request_id}`)

  // 6. Polling del status (video gen toma 3-6 min)
  const MAX_POLLS = 90 // 90 × 5s = 7.5 min máximo
  const POLL_INTERVAL = 5000
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL))

    try {
      const statusRes = await fetch(status_url, {
        headers: { 'Authorization': `Key ${falKey}` },
      })

      if (!statusRes.ok) {
        console.warn(`[generateVideoAI] Status poll ${i + 1} HTTP ${statusRes.status}`)
        continue
      }

      const statusData = await statusRes.json() as { status: string; error?: string }
      console.log(`[generateVideoAI] Poll ${i + 1}/${MAX_POLLS}: ${statusData.status}`)

      if (statusData.status === 'COMPLETED') break
      if (statusData.status === 'FAILED') {
        throw new Error(`fal.ai video falló: ${statusData.error || 'error desconocido'}`)
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('fal.ai video falló')) throw err
      console.warn(`[generateVideoAI] Poll error (continuing):`, err)
    }
  }

  // 7. Obtener resultado
  console.log('[generateVideoAI] Fetching result...')
  const resultRes = await fetch(response_url, {
    headers: { 'Authorization': `Key ${falKey}` },
  })

  if (!resultRes.ok) {
    const errBody = await resultRes.text().catch(() => 'unknown')
    console.error('[generateVideoAI] Result fetch failed:', resultRes.status, errBody)
    throw new Error('No se pudo obtener el video generado de fal.ai')
  }

  const resultData = await resultRes.json() as { video?: { url?: string } }
  const videoUrl = resultData?.video?.url
  if (!videoUrl) {
    console.error('[generateVideoAI] No video URL in response:', JSON.stringify(resultData).substring(0, 500))
    throw new Error('fal.ai no devolvió URL de video')
  }

  console.log(`[generateVideoAI] ✅ Video generado con ${modelLabel}: ${videoUrl.substring(0, 80)}...`)

  // 8. Generar thumbnail
  let thumbnail = ''
  try {
    const imgResult = await generateImage(prompt, undefined, format, undefined)
    thumbnail = imgResult.url
  } catch {
    console.warn('[generateVideoAI] No se pudo generar thumbnail, usando vacío')
    thumbnail = ''
  }

  return { videoUrl, thumbnail, enhancedPrompt, modelUsed: modelLabel }
}

// Generar copy/texto
async function generateCopy(
  prompt: string,
  platform?: string
): Promise<{ text: string; metadata: Record<string, unknown> }> {
  const copyPrompt = buildCopyPrompt(prompt, platform)
  
  const response = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: COPY_CREATOR_PROMPT },
        { role: 'user', content: copyPrompt },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error(`Copy API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // Intentar parsear JSON del copy
  let metadata: Record<string, unknown> = {}
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      metadata = JSON.parse(jsonMatch[0])
    }
  } catch {
    // Si no es JSON, usar como texto plano
  }

  return { text: content, metadata }
}

// POST - Generar contenido creativo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { type, prompt, platform, format, style, title, videoMode, videoModel, projectId, imageModel, orientation } = body

    if (!type || !prompt) {
      return NextResponse.json({ error: 'type y prompt son requeridos' }, { status: 400 })
    }

    // Plan gate — check monthly creative asset limit
    const gate = await checkPlanGate(session.user.id, 'creative')
    if (!gate.allowed) {
      return NextResponse.json({
        error: 'plan_limit',
        message: `Límite de creaciones este mes alcanzado (${gate.current}/${gate.limit})`,
        gate,
      }, { status: 403 })
    }

    const autoTitle = title || prompt.slice(0, 60) + (prompt.length > 60 ? '...' : '')

    if (type === 'image') {
      const result = await generateImage(
        prompt,
        platform,
        format,
        style,
        imageModel || null,
        orientation,
        session.user.id
      )

      const asset = await prisma.creativeAsset.create({
        data: {
          userId: session.user.id,
          type: 'image',
          title: autoTitle,
          prompt,
          content: result.url,
          platform: platform || 'general',
          format: format || 'post',
          status: 'ready',
          metadata: JSON.stringify({
            enhancedPrompt: result.enhancedPrompt,
            dimensions: getDimensions(platform, format),
            style,
            modelUsed: result.modelUsed,
            modelRequested: imageModel || 'default',
          }),
          ...(projectId ? { projectId } : {}),
        },
      })

      return NextResponse.json({
        success: true,
        asset: {
          id: asset.id,
          type: asset.type,
          title: asset.title,
          content: asset.content,
          platform: asset.platform,
          format: asset.format,
          createdAt: asset.createdAt,
          modelUsed: result.modelUsed,
        },
      })
    }

    if (type === 'video') {
      // videoMode: "ai" = Kling 2.6 Pro via fal.ai, "slideshow" (default) = FFmpeg slideshow
      const useAI = videoMode === 'ai'

      if (useAI) {
        // ── Video IA con Kling (modelo seleccionado por usuario) ──
        const result = await generateVideoAI(prompt, format, session.user.id, videoModel)

        const asset = await prisma.creativeAsset.create({
          data: {
            userId: session.user.id,
            type: 'video',
            title: autoTitle,
            prompt,
            content: result.videoUrl,
            thumbnail: result.thumbnail || undefined,
            platform: platform || 'general',
            format: format || 'reel',
            status: 'ready',
            metadata: JSON.stringify({
              isRealVideo: true,
              videoMode: 'ai',
              model: videoModel || 'kling-2.6-pro',
              modelLabel: result.modelUsed,
              enhancedPrompt: result.enhancedPrompt,
            }),
            ...(projectId ? { projectId } : {}),
          },
        })

        return NextResponse.json({
          success: true,
          asset: {
            id: asset.id,
            type: asset.type,
            title: asset.title,
            content: asset.content,
            thumbnail: asset.thumbnail,
            platform: asset.platform,
            createdAt: asset.createdAt,
            isRealVideo: true,
            videoMode: 'ai',
          },
        })
      } else {
        // ── Slideshow con FFmpeg (gratis) ──
        const result = await generateVideo(prompt)

        const asset = await prisma.creativeAsset.create({
          data: {
            userId: session.user.id,
            type: 'video',
            title: autoTitle,
            prompt,
            content: result.videoUrl,
            thumbnail: result.thumbnail,
            platform: platform || 'general',
            format: 'reel',
            status: 'ready',
            metadata: JSON.stringify({
              frameCount: result.frames.length,
              isRealVideo: true,
              videoMode: 'slideshow',
            }),
            ...(projectId ? { projectId } : {}),
          },
        })

        return NextResponse.json({
          success: true,
          asset: {
            id: asset.id,
            type: asset.type,
            title: asset.title,
            content: asset.content,
            thumbnail: asset.thumbnail,
            platform: asset.platform,
            createdAt: asset.createdAt,
            isRealVideo: true,
            videoMode: 'slideshow',
          },
        })
      }
    }

    if (type === 'copy') {
      const result = await generateCopy(prompt, platform)
      
      const asset = await prisma.creativeAsset.create({
        data: {
          userId: session.user.id,
          type: 'copy',
          title: autoTitle,
          prompt,
          content: result.text,
          platform: platform || 'general',
          status: 'ready',
          metadata: JSON.stringify(result.metadata),
          tags: (result.metadata.hashtags as string[] || []).join(','),
          ...(projectId ? { projectId } : {}),
        },
      })

      return NextResponse.json({
        success: true,
        asset: {
          id: asset.id,
          type: asset.type,
          title: asset.title,
          content: asset.content,
          platform: asset.platform,
          createdAt: asset.createdAt,
          metadata: result.metadata,
        },
      })
    }

    return NextResponse.json({ error: 'Tipo no soportado' }, { status: 400 })

  } catch (error) {
    console.error('Creative generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar contenido' },
      { status: 500 }
    )
  }
}
