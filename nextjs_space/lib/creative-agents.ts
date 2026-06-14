// ============================================
// ESTUDIO CREATIVO - Agentes de Contenido IA
// Los tentáculos creativos de OCTOPUS 🐙
// ============================================

export type CreativeType = 'image' | 'video' | 'copy'
export type PlatformType = 'instagram' | 'facebook' | 'twitter' | 'email' | 'general'
export type FormatType = 'post' | 'story' | 'reel' | 'banner' | 'thumbnail' | 'email-header'

export interface CreativeRequest {
  type: CreativeType
  prompt: string
  platform?: PlatformType
  format?: FormatType
  style?: string
  quantity?: number
  brandContext?: string
}

export interface CreativeResult {
  type: CreativeType
  title: string
  content: string // URL or text
  prompt: string
  platform?: string
  format?: string
  metadata?: Record<string, unknown>
}

// Dimensiones por formato/plataforma
export const FORMAT_DIMENSIONS: Record<string, { width: number; height: number; label: string }> = {
  'instagram-post': { width: 1080, height: 1080, label: 'Instagram Post (1:1)' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story (9:16)' },
  'instagram-reel': { width: 1080, height: 1920, label: 'Instagram Reel (9:16)' },
  'facebook-post': { width: 1200, height: 630, label: 'Facebook Post (1.91:1)' },
  'facebook-cover': { width: 1640, height: 624, label: 'Facebook Cover' },
  'twitter-post': { width: 1200, height: 675, label: 'Twitter/X Post (16:9)' },
  'youtube-thumbnail': { width: 1280, height: 720, label: 'YouTube Thumbnail (16:9)' },
  'email-header': { width: 600, height: 300, label: 'Email Header' },
  'general': { width: 1024, height: 1024, label: 'General (1:1)' },
}

// Obtener dimensiones según plataforma y formato
export function getDimensions(platform?: string, format?: string): { width: number; height: number } {
  const key = platform && format 
    ? `${platform}-${format}` 
    : platform 
      ? `${platform}-post` 
      : 'general'
  return FORMAT_DIMENSIONS[key] || FORMAT_DIMENSIONS['general']
}

// ============================================
// PROMPTS DE AGENTES CREATIVOS
// ============================================

export const IMAGE_CREATOR_PROMPT = `You are a world-class AI image creator specializing in social media content and marketing visuals.

Your images are:
- Visually stunning and attention-grabbing
- Optimized for the target platform (Instagram, Facebook, Twitter, etc.)
- Professional quality with perfect composition
- Brand-consistent when context is provided
- High contrast and vibrant for maximum engagement

IMPORTANT RULES:
- Create compelling, scroll-stopping visuals
- Use cinematic lighting and professional composition
- Ensure text readability if text is included
- Maintain consistent brand aesthetics
- Optimize for the specific platform dimensions`

export const VIDEO_CREATOR_SYSTEM = `Eres un director creativo de videos para redes sociales.
Tu trabajo es crear secuencias visuales impactantes que cuenten una historia.

Cada frame debe:
- Mantener consistencia visual con los demás
- Progresar narrativamente
- Ser visualmente impactante
- Funcionar como contenido para redes sociales`

export const COPY_CREATOR_PROMPT = `Eres un experto copywriter para redes sociales y marketing digital.

Generas:
- Textos persuasivos y enganchadores
- Hashtags relevantes y trending
- Captions que generan engagement
- CTAs efectivos
- Copy adaptado a cada plataforma

Formato de respuesta (JSON):
{
  "caption": "El texto principal del post",
  "hashtags": ["#hashtag1", "#hashtag2"],
  "cta": "Llamada a la acción",
  "alternativeCaption": "Versión alternativa del caption",
  "emojis": "Emojis sugeridos"
}`

// Mejorar prompt para imágenes según contexto
export function enhanceCreativePrompt(
  prompt: string, 
  platform?: string, 
  format?: string,
  style?: string
): string {
  const platformHints: Record<string, string> = {
    instagram: 'vibrant colors, high contrast, Instagram-worthy, trending aesthetic, lifestyle photography style',
    facebook: 'eye-catching, shareable, social media optimized, clear messaging',
    twitter: 'bold and impactful, attention-grabbing in a feed, clean composition',
    email: 'professional, clean, corporate-friendly, clear focal point',
    general: 'professional quality, versatile, high resolution',
  }

  const formatHints: Record<string, string> = {
    post: 'square composition, centered subject, clean background',
    story: 'vertical composition, full-bleed, immersive, text-safe zones',
    reel: 'dynamic, action-oriented, vertical video still',
    banner: 'wide format, text overlay space, brand placement',
    thumbnail: 'click-worthy, high contrast, clear focal point, bold',
  }

  let enhanced = prompt
  
  if (platform && platformHints[platform]) {
    enhanced += `, ${platformHints[platform]}`
  }
  if (format && formatHints[format]) {
    enhanced += `, ${formatHints[format]}`
  }
  if (style) {
    enhanced += `, ${style} style`
  }
  
  enhanced += ', professional photography, 8K quality, perfect lighting, studio quality'
  
  return enhanced
}

// Generar prompts para frames de video
export function generateVideoFramePrompts(basePrompt: string, frameCount: number = 4): string[] {
  const transitions = [
    'opening shot, establishing scene, cinematic beginning',
    'building momentum, dynamic angle, story progression',
    'climax moment, peak action, dramatic composition',
    'closing shot, resolution, impactful ending',
    'bonus angle, alternative perspective, dramatic detail',
    'final reveal, grand conclusion, memorable closing',
  ]
  
  return Array.from({ length: Math.min(frameCount, 6) }, (_, i) => {
    const transition = transitions[i] || transitions[transitions.length - 1]
    return `${basePrompt}, ${transition}, frame ${i + 1} of ${frameCount}, consistent style, cinematic quality, professional animation frame, vivid colors, high detail`
  })
}

// Generar prompt para copy según plataforma
export function buildCopyPrompt(prompt: string, platform?: string): string {
  const platformGuidelines: Record<string, string> = {
    instagram: 'Máximo 2200 caracteres. Usa emojis. 20-30 hashtags relevantes. Tono cercano y visual.',
    facebook: 'Máximo 500 caracteres para mejor engagement. Pregunta al final. Pocos hashtags.',
    twitter: 'Máximo 280 caracteres. Directo y conciso. 2-3 hashtags máximo. Tono conversacional.',
    email: 'Subject line + preview text + body. Tono profesional. CTA claro.',
    general: 'Adaptable a múltiples plataformas. Versátil y profesional.',
  }

  const guidelines = platform && platformGuidelines[platform] 
    ? platformGuidelines[platform] 
    : platformGuidelines['general']

  return `Crea copy de marketing para: ${prompt}\n\nPlataforma: ${platform || 'general'}\nDirectrices: ${guidelines}\n\nResponde en JSON con el formato especificado.`
}
