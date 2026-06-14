import { callLLMStream } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { uploadBufferToS3Public } from '@/lib/s3'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// YouTube URL patterns
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/

function extractYouTubeId(url: string): string | null {
  const match = url.match(YOUTUBE_REGEX)
  return match ? match[1] : null
}

/**
 * Extrae frames de un video usando FFmpeg API
 */
async function extractFramesWithFFmpeg(videoUrl: string, numFrames: number = 4): Promise<string[]> {
  const outputFiles: Record<string, string> = {}
  // Crear placeholders para cada frame
  for (let i = 1; i <= numFrames; i++) {
    outputFiles[`out_${i}`] = `frame_${i}.jpg`
  }

  // Comando FFmpeg: extraer frames distribuidos uniformemente
  // Usamos select filter para obtener frames en intervalos regulares
  // Para 4 frames de un video: extraemos al 10%, 30%, 55%, 80% del video
  const ffmpegCommand = `-i {{in_1}} -vf "select='eq(n\\,0)+eq(n\\,30)+eq(n\\,90)+eq(n\\,150)',scale=640:-1" -vsync vfr -q:v 3 -frames:v ${numFrames} {{out_1}}`

  // Alternativa más robusta: extraer un frame cada N segundos
  // Para un video de ~30s, extraer 1 frame cada 8 segundos da ~4 frames
  const ffmpegCommandSimple = `-i {{in_1}} -vf "fps=1/8,scale=640:-1" -q:v 3 -frames:v ${numFrames} {{out_1}}`

  // Usamos una estrategia de thumbnail strip: extraer 4 frames como archivos separados
  // FFmpeg con thumbnail filter selecciona los frames más representativos
  const ffmpegCommandThumbs = `-i {{in_1}} -vf "thumbnail=100,scale=640:-1" -frames:v 1 -q:v 2 {{out_1}}`

  console.log('[Video Analysis] Extracting frames with FFmpeg...')

  try {
    // Estrategia: Extraer 4 frames individuales a diferentes timestamps
    const frameUrls: string[] = []
    
    // Extraer frame 1: al segundo 1
    const frame1 = await runFFmpegSingle(videoUrl, '-i {{in_1}} -ss 1 -frames:v 1 -vf scale=640:-1 -q:v 2 {{out_1}}', 'frame_1.jpg')
    if (frame1) frameUrls.push(frame1)

    // Extraer frame 2: al segundo 5
    const frame2 = await runFFmpegSingle(videoUrl, '-i {{in_1}} -ss 5 -frames:v 1 -vf scale=640:-1 -q:v 2 {{out_1}}', 'frame_2.jpg')
    if (frame2) frameUrls.push(frame2)

    // Extraer frame 3: al segundo 10
    const frame3 = await runFFmpegSingle(videoUrl, '-i {{in_1}} -ss 10 -frames:v 1 -vf scale=640:-1 -q:v 2 {{out_1}}', 'frame_3.jpg')
    if (frame3) frameUrls.push(frame3)

    // Extraer frame 4: al segundo 20
    const frame4 = await runFFmpegSingle(videoUrl, '-i {{in_1}} -ss 20 -frames:v 1 -vf scale=640:-1 -q:v 2 {{out_1}}', 'frame_4.jpg')
    if (frame4) frameUrls.push(frame4)

    // Si no obtuvimos frames suficientes, intentar con thumbnail
    if (frameUrls.length === 0) {
      const thumb = await runFFmpegSingle(videoUrl, '-i {{in_1}} -vf "thumbnail,scale=640:-1" -frames:v 1 -q:v 2 {{out_1}}', 'thumb.jpg')
      if (thumb) frameUrls.push(thumb)
    }

    return frameUrls
  } catch (err) {
    console.error('[Video Analysis] FFmpeg extraction error:', err)
    return []
  }
}

/**
 * Ejecuta un comando FFmpeg individual y retorna la URL del output
 */
async function runFFmpegSingle(inputUrl: string, command: string, outputName: string): Promise<string | null> {
  try {
    const createResponse = await fetch('https://apps.abacus.ai/api/createRunFfmpegCommandRequest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        input_files: { in_1: inputUrl },
        output_files: { out_1: outputName },
        ffmpeg_command: command,
        max_command_run_seconds: 60,
      }),
    })

    if (!createResponse.ok) {
      console.error('[FFmpeg] Create request failed:', await createResponse.text())
      return null
    }

    const { request_id } = await createResponse.json()
    if (!request_id) return null

    // Poll for completion (max 60 seconds)
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1500))

      const statusResp = await fetch('https://apps.abacus.ai/api/getRunFfmpegCommandStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      })

      const statusResult = await statusResp.json()
      const status = statusResult?.status || 'FAILED'

      if (status === 'SUCCESS' && statusResult?.result?.result?.out_1) {
        return statusResult.result.result.out_1
      }
      if (status === 'FAILED') {
        console.warn(`[FFmpeg] Command failed for ${outputName}`)
        return null
      }
    }
    return null
  } catch (err) {
    console.error(`[FFmpeg] Error for ${outputName}:`, err)
    return null
  }
}

/**
 * Analiza frames extraídos usando LLM con visión (Turbo Mode + Abacus AI fallback)
 */
async function analyzeFramesWithLLM(
  frameUrls: string[],
  userPrompt: string,
  videoSource: string,
  userId: string
): Promise<ReadableStream> {
  const imageContent = frameUrls.map((url) => ({
    type: 'image_url' as const,
    image_url: { url, detail: 'low' as const },
  }))

  const isYouTube = videoSource.startsWith('YouTube')

  const systemContent = isYouTube
    ? `Eres OCTOPUS 🐙, un asistente de inteligencia artificial con capacidad de análisis visual.
Se te proporcionan thumbnails de un video de YouTube junto con su metadata (título, autor).
USA LA METADATA (título y autor) como fuente PRINCIPAL de información sobre el contenido del video.
Los thumbnails te dan contexto visual adicional pero NO son suficientes por sí solos para describir el contenido completo.
Combina la información del título, autor y lo que ves en los thumbnails para dar una respuesta precisa y útil.
NUNCA digas que solo puedes ver thumbnails — integra toda la información de forma natural.
Responde en español de forma detallada y útil.
Si el usuario hace una pregunta específica, enfócate en responderla.`
    : `Eres OCTOPUS 🐙, un asistente de inteligencia artificial con capacidad de análisis visual de video.
Se te proporcionan frames extraídos de un video subido por el usuario.
Analiza las imágenes como una secuencia temporal — el frame 1 es el inicio y el último es hacia el final.
Describe lo que ves, identifica patrones, cambios entre frames, personas, objetos, texto, marcas, etc.
Responde en español de forma detallada y útil.
Si el usuario hace una pregunta específica sobre el video, enfócate en responderla.`

  const messages = [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt || '¿De qué trata este video? Analiza su contenido.' },
        ...imageContent,
      ],
    },
  ]

  // Use callLLMStream for Turbo Mode support
  const response = await callLLMStream(userId, messages, { model: 'gpt-4.1', maxTokens: 4000 })

  if (!response.ok || !response.body) {
    throw new Error('LLM analysis failed')
  }

  return response.body
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { videoBase64, videoName, videoMime, youtubeUrl, message } = body

    let videoPublicUrl: string | null = null
    let videoSource = ''
    let youtubeId: string | null = null

    // === RUTA 1: YouTube URL ===
    if (youtubeUrl) {
      youtubeId = extractYouTubeId(youtubeUrl)
      if (!youtubeId) {
        return NextResponse.json({ error: 'URL de YouTube inválida' }, { status: 400 })
      }
      videoSource = `YouTube: ${youtubeUrl}`
      console.log(`[Video Analysis] YouTube video detected: ${youtubeId}`)

      // 1) Obtener metadata real del video (título, autor)
      let videoTitle = ''
      let videoAuthor = ''
      try {
        const oembedUrl = 'https://i.ytimg.com/vi/vx5dSS3BBOk/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCN6USVmYBTv6Y-EmMYsdqZoimykQ' + youtubeId + '&format=json'
        const oembedResp = await fetch(oembedUrl)
        if (oembedResp.ok) {
          const oembed = await oembedResp.json()
          videoTitle = oembed.title || ''
          videoAuthor = oembed.author_name || ''
        }
      } catch (e) { console.warn('[Video Analysis] oEmbed fetch failed:', e) }

      // Fallback: noembed
      if (!videoTitle) {
        try {
          const noembedUrl = 'https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + youtubeId
          const noembedResp = await fetch(noembedUrl)
          if (noembedResp.ok) {
            const noembed = await noembedResp.json()
            videoTitle = noembed.title || ''
            videoAuthor = noembed.author_name || ''
          }
        } catch { /* skip */ }
      }

      console.log('[Video Analysis] YouTube metadata - Title: "' + videoTitle + '", Author: "' + videoAuthor + '"')

      // 2) Obtener thumbnails REALES del video usando el youtubeId correcto
      const thumbCandidates = [
        'https://i.ytimg.com/vi/qomLSfhmZI8/maxresdefault.jpg' + youtubeId + '/maxresdefault.jpg',
        'https://i.ytimg.com/vi/2ybiC9EF-oc/sddefault.jpg' + youtubeId + '/sddefault.jpg',
        'https://i.ytimg.com/vi/EP_lJSr90jE/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCgy0LBXIoyjKH0PpOW-HGIBeOzGA' + youtubeId + '/hqdefault.jpg',
        'https://i.ytimg.com/vi/2ybiC9EF-oc/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCDeH2BcYKRPKKt3YI9-qBecZmXnQ' + youtubeId + '/mqdefault.jpg',
        'https://i.ytimg.com/vi/xxLjUeVPYYk/maxresdefault.jpg' + youtubeId + '/0.jpg',
        'https://i.ytimg.com/vi/vx5dSS3BBOk/maxresdefault.jpg' + youtubeId + '/1.jpg',
        'https://i.ytimg.com/vi/WzDmoTydaEk/maxresdefault.jpg' + youtubeId + '/2.jpg',
        'https://i.ytimg.com/vi/iK5ld5XQeGY/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBZhwq4L14xaq78JzxwplyaFmB_qw' + youtubeId + '/3.jpg',
      ]

      // Verificar cuáles thumbnails existen (los de YouTube pueden variar)
      const validThumbs: string[] = []
      for (const url of thumbCandidates) {
        try {
          const resp = await fetch(url, { method: 'HEAD' })
          // YouTube returns 200 for placeholders too, check content-length
          const contentLength = parseInt(resp.headers.get('content-length') || '0')
          if (resp.ok && contentLength > 1000) { // > 1KB means real image
            validThumbs.push(url)
            if (validThumbs.length >= 4) break
          }
        } catch { /* skip */ }
      }

      if (validThumbs.length === 0) {
        return NextResponse.json({ error: 'No se pudieron obtener thumbnails del video de YouTube' }, { status: 400 })
      }

      console.log(`[Video Analysis] Found ${validThumbs.length} valid thumbnails`)

      // 3) Construir contexto enriquecido con metadata + thumbnails
      const metadataContext = [
        videoTitle && `**Título del video:** "${videoTitle}"`,
        videoAuthor && `**Canal/Autor:** ${videoAuthor}`,
      ].filter(Boolean).join('\n')

      // Usar thumbnails + metadata para análisis
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const headerParts = [`🎬 **Analizando video de YouTube**`]
            if (videoTitle) headerParts.push(`📺 "${videoTitle}"`)
            if (videoAuthor) headerParts.push(`👤 ${videoAuthor}`)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: headerParts.join('\n') + '\n\n' })}\n\n`))

            // Enviar al LLM con metadata como contexto adicional
            const enrichedPrompt = [
              metadataContext,
              message || '¿De qué trata este video? Analiza su contenido en detalle.',
            ].filter(Boolean).join('\n\n')

            const llmStream = await analyzeFramesWithLLM(validThumbs, enrichedPrompt, videoSource, session.user.id)
            const reader = llmStream.getReader()
            const decoder = new TextDecoder()

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') continue
                  try {
                    const parsed = JSON.parse(data)
                    const token = parsed.choices?.[0]?.delta?.content || ''
                    if (token) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: token })}\n\n`))
                    }
                  } catch { /* skip */ }
                }
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `\n\n---\n🔗 [Ver en YouTube](https://youtube.com/watch?v=${youtubeId})` })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (err) {
            console.error('[Video Analysis] Stream error:', err)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n⚠️ Error analizando el video.' })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } finally {
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // === RUTA 2: Video subido (base64) ===
    if (videoBase64 && videoName) {
      console.log(`[Video Analysis] Processing uploaded video: ${videoName}`)

      // Subir a S3 para obtener URL pública
      const cleanBase64 = videoBase64.includes(',') ? videoBase64.split(',')[1] : videoBase64
      const buffer = Buffer.from(cleanBase64, 'base64')

      // Límite de 50MB para videos
      if (buffer.length > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'El video es demasiado grande. Máximo 50MB.' }, { status: 400 })
      }

      const { publicUrl } = await uploadBufferToS3Public(
        buffer,
        `video-${Date.now()}-${videoName}`,
        videoMime || 'video/mp4'
      )
      videoPublicUrl = publicUrl
      videoSource = `Video subido: ${videoName}`
      console.log(`[Video Analysis] Video uploaded to S3: ${publicUrl}`)

      // Extraer frames con FFmpeg
      const frameUrls = await extractFramesWithFFmpeg(publicUrl, 4)
      console.log(`[Video Analysis] Extracted ${frameUrls.length} frames`)

      if (frameUrls.length === 0) {
        return NextResponse.json({ error: 'No se pudieron extraer frames del video. Intenta con un formato diferente.' }, { status: 400 })
      }

      // Analizar frames con LLM
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `🎬 **Analizando video** "${videoName}" (${frameUrls.length} frames extraídos)\n\n` })}\n\n`))

            const llmStream = await analyzeFramesWithLLM(frameUrls, message || '', videoSource, session.user.id)
            const reader = llmStream.getReader()
            const decoder = new TextDecoder()

            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') continue
                  try {
                    const parsed = JSON.parse(data)
                    const token = parsed.choices?.[0]?.delta?.content || ''
                    if (token) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: token })}\n\n`))
                    }
                  } catch { /* skip */ }
                }
              }
            }

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (err) {
            console.error('[Video Analysis] Stream error:', err)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: '\n\n⚠️ Error analizando el video.' })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } finally {
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    return NextResponse.json({ error: 'Se requiere un video (base64) o URL de YouTube' }, { status: 400 })
  } catch (error) {
    console.error('[Video Analysis] Error:', error)
    return NextResponse.json({ error: 'Error procesando video' }, { status: 500 })
  }
}