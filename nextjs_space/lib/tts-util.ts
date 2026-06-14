// TTS Utility para generar audio - OCTOPUS
// Usa Google Translate TTS (gratuito, sin API key)

// Limpiar texto de markdown/emojis para pronunciacion limpia
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/---/g, '')
    .replace(/\|[^|]+\|/g, '')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/<[^>]+>/g, '') // Quitar HTML tags
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Dividir texto en chunks de max 190 chars (limite de Google Translate TTS)
function splitIntoChunks(text: string, maxLen: number = 190): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let current = ''

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 <= maxLen) {
      current += (current ? ' ' : '') + sentence
    } else {
      if (current) chunks.push(current)
      if (sentence.length > maxLen) {
        const words = sentence.split(' ')
        let wordChunk = ''
        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= maxLen) {
            wordChunk += (wordChunk ? ' ' : '') + word
          } else {
            if (wordChunk) chunks.push(wordChunk)
            wordChunk = word
          }
        }
        if (wordChunk) current = wordChunk
      } else {
        current = sentence
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

// Generar audio MP3 usando Google Translate TTS
export async function generateTTSAudio(
  text: string,
  lang: string = 'es'
): Promise<Buffer | null> {
  const cleanText = cleanForSpeech(text).slice(0, 600)
  if (!cleanText) return null

  const chunks = splitIntoChunks(cleanText)
  const audioBuffers: Buffer[] = []

  for (const chunk of chunks) {
    const encodedText = encodeURIComponent(chunk)
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q='
      + encodedText + '&tl=' + lang + '&client=tw-ob&ttsspeed=1'

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://translate.google.com/',
        },
      })

      if (resp.ok) {
        const arrayBuffer = await resp.arrayBuffer()
        audioBuffers.push(Buffer.from(arrayBuffer))
      } else {
        console.error('[TTS-Util] Chunk error:', resp.status)
      }
    } catch (err) {
      console.error('[TTS-Util] Chunk exception:', err)
    }
  }

  if (audioBuffers.length === 0) return null

  // Concatenar todos los buffers MP3
  return Buffer.concat(audioBuffers)
}
