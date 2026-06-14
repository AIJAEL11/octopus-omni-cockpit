/**
 * AUTOMATION LIST — Catálogo de plataformas de automatización web
 *
 * Reemplaza al Social Bridge: cada plataforma es una tarjeta con
 * credenciales propias y skills (BrowserTemplates) que ejecutan
 * acciones reales vía el Bridge.
 *
 * Seguridad: el auto-login construye comandos de navegador explícitos
 * (goto → type → click) con selectores conocidos por plataforma.
 * Las credenciales NUNCA pasan por un LLM.
 */

export interface LoginSelectors {
  /** CSS selector del campo usuario/email */
  username: string
  /** CSS selector del campo contraseña */
  password: string
  /** CSS selector del botón de submit */
  submit: string
  /** Si la plataforma pide el usuario y contraseña en pasos separados */
  twoStep?: boolean
}

export interface AutomationPlatform {
  id: string
  name: string
  /** Emoji representativo (sin dependencias de iconos externos) */
  emoji: string
  color: string
  url: string
  loginUrl: string
  descriptionEs: string
  descriptionEn: string
  /** Categoría para agrupar en la UI */
  group: 'publishing' | 'social' | 'content' | 'analytics'
  /** Selectores de login conocidos — null = solo abrir página de login */
  selectors: LoginSelectors | null
  /** Skills sugeridas (se ofrecen como plantillas de ai_task SIN credenciales) */
  suggestedSkillsEs: string[]
  suggestedSkillsEn: string[]
}

// Selectores genéricos: cubren la mayoría de formularios de login estándar
const GENERIC_SELECTORS: LoginSelectors = {
  username: 'input[type="email"], input[name="email"], input[name="username"], input[id*="email" i], input[id*="user" i]',
  password: 'input[type="password"]',
  submit: 'button[type="submit"], input[type="submit"]',
}

export const AUTOMATION_PLATFORMS: AutomationPlatform[] = [
  {
    id: 'publer',
    name: 'Publer',
    emoji: '📅',
    color: '#00A6A6',
    url: 'https://app.publer.io',
    loginUrl: 'https://app.publer.io/login',
    descriptionEs: 'Programa y publica en todas tus redes desde un solo lugar',
    descriptionEn: 'Schedule and publish to all your networks from one place',
    group: 'publishing',
    selectors: GENERIC_SELECTORS,
    suggestedSkillsEs: ['Publicar la última imagen generada', 'Programar publicación para mañana 9am', 'Revisar publicaciones programadas'],
    suggestedSkillsEn: ['Publish the last generated image', 'Schedule a post for tomorrow 9am', 'Review scheduled posts'],
  },
  {
    id: 'buffer',
    name: 'Buffer',
    emoji: '🗓️',
    color: '#168EEA',
    url: 'https://publish.buffer.com',
    loginUrl: 'https://login.buffer.com',
    descriptionEs: 'Cola de publicaciones y analítica social',
    descriptionEn: 'Publishing queue and social analytics',
    group: 'publishing',
    selectors: GENERIC_SELECTORS,
    suggestedSkillsEs: ['Añadir post a la cola', 'Ver analítica de la semana'],
    suggestedSkillsEn: ['Add post to queue', 'View weekly analytics'],
  },
  {
    id: 'metricool',
    name: 'Metricool',
    emoji: '📊',
    color: '#1AA7B8',
    url: 'https://app.metricool.com',
    loginUrl: 'https://app.metricool.com/login',
    descriptionEs: 'Planificación y métricas de redes sociales',
    descriptionEn: 'Social media planning and metrics',
    group: 'analytics',
    selectors: GENERIC_SELECTORS,
    suggestedSkillsEs: ['Descargar reporte mensual', 'Programar contenido de la semana'],
    suggestedSkillsEn: ['Download monthly report', 'Schedule weekly content'],
  },
  {
    id: 'hootsuite',
    name: 'Hootsuite',
    emoji: '🦉',
    color: '#FF4C46',
    url: 'https://hootsuite.com/dashboard',
    loginUrl: 'https://hootsuite.com/login',
    descriptionEs: 'Gestión social empresarial',
    descriptionEn: 'Enterprise social management',
    group: 'publishing',
    selectors: GENERIC_SELECTORS,
    suggestedSkillsEs: ['Publicar en todos los perfiles', 'Revisar menciones'],
    suggestedSkillsEn: ['Publish to all profiles', 'Check mentions'],
  },
  {
    id: 'later',
    name: 'Later',
    emoji: '⏰',
    color: '#4A90D9',
    url: 'https://app.later.com',
    loginUrl: 'https://app.later.com/login',
    descriptionEs: 'Programación visual para Instagram y más',
    descriptionEn: 'Visual scheduling for Instagram and more',
    group: 'publishing',
    selectors: GENERIC_SELECTORS,
    suggestedSkillsEs: ['Subir imagen al media library', 'Programar para el mejor horario'],
    suggestedSkillsEn: ['Upload image to media library', 'Schedule for best time'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    emoji: '💼',
    color: '#0A66C2',
    url: 'https://www.linkedin.com/feed',
    loginUrl: 'https://www.linkedin.com/login',
    descriptionEs: 'Red profesional — publica y conecta',
    descriptionEn: 'Professional network — publish and connect',
    group: 'social',
    selectors: {
      username: '#username',
      password: '#password',
      submit: 'button[type="submit"]',
    },
    suggestedSkillsEs: ['Publicar un post de texto', 'Publicar la última imagen generada', 'Revisar notificaciones'],
    suggestedSkillsEn: ['Publish a text post', 'Publish the last generated image', 'Check notifications'],
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    emoji: '🐦',
    color: '#1A1A1A',
    url: 'https://x.com/home',
    loginUrl: 'https://x.com/i/flow/login',
    descriptionEs: 'Publica tweets y hilos',
    descriptionEn: 'Publish tweets and threads',
    group: 'social',
    selectors: {
      username: 'input[autocomplete="username"]',
      password: 'input[type="password"]',
      submit: 'button[data-testid="LoginForm_Login_Button"]',
      twoStep: true,
    },
    suggestedSkillsEs: ['Publicar un tweet', 'Publicar tweet con la última imagen'],
    suggestedSkillsEn: ['Post a tweet', 'Post tweet with the last image'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    emoji: '📸',
    color: '#E1306C',
    url: 'https://www.instagram.com',
    loginUrl: 'https://www.instagram.com/accounts/login/',
    descriptionEs: 'Publica fotos, reels e historias',
    descriptionEn: 'Publish photos, reels and stories',
    group: 'social',
    selectors: {
      username: 'input[name="username"]',
      password: 'input[name="password"]',
      submit: 'button[type="submit"]',
    },
    suggestedSkillsEs: ['Publicar la última imagen generada', 'Revisar mensajes directos'],
    suggestedSkillsEn: ['Publish the last generated image', 'Check direct messages'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    emoji: '👥',
    color: '#1877F2',
    url: 'https://www.facebook.com',
    loginUrl: 'https://www.facebook.com/login',
    descriptionEs: 'Publica en tu página o perfil',
    descriptionEn: 'Publish to your page or profile',
    group: 'social',
    selectors: {
      username: '#email',
      password: '#pass',
      submit: 'button[name="login"]',
    },
    suggestedSkillsEs: ['Publicar en mi página', 'Programar publicación'],
    suggestedSkillsEn: ['Publish to my page', 'Schedule a post'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    emoji: '🎵',
    color: '#FE2C55',
    url: 'https://www.tiktok.com',
    loginUrl: 'https://www.tiktok.com/login',
    descriptionEs: 'Sube videos y revisa tendencias',
    descriptionEn: 'Upload videos and check trends',
    group: 'social',
    selectors: null, // login con QR/flujos múltiples — solo abrir página
    suggestedSkillsEs: ['Subir el último video generado', 'Buscar tendencias del día'],
    suggestedSkillsEn: ['Upload the last generated video', 'Search daily trends'],
  },
  {
    id: 'youtube',
    name: 'YouTube Studio',
    emoji: '▶️',
    color: '#FF0000',
    url: 'https://studio.youtube.com',
    loginUrl: 'https://accounts.google.com/ServiceLogin?service=youtube',
    descriptionEs: 'Gestiona tu canal y sube videos',
    descriptionEn: 'Manage your channel and upload videos',
    group: 'content',
    selectors: null, // Google login — flujo multi-paso con 2FA, solo abrir
    suggestedSkillsEs: ['Revisar analítica del canal', 'Subir video como borrador'],
    suggestedSkillsEn: ['Check channel analytics', 'Upload video as draft'],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    emoji: '📌',
    color: '#E60023',
    url: 'https://www.pinterest.com',
    loginUrl: 'https://www.pinterest.com/login/',
    descriptionEs: 'Crea pins con tus imágenes generadas',
    descriptionEn: 'Create pins with your generated images',
    group: 'social',
    selectors: {
      username: '#email',
      password: '#password',
      submit: 'button[type="submit"]',
    },
    suggestedSkillsEs: ['Crear pin con la última imagen', 'Crear tablero nuevo'],
    suggestedSkillsEn: ['Create pin with the last image', 'Create new board'],
  },
]

export function getPlatform(id: string): AutomationPlatform | undefined {
  return AUTOMATION_PLATFORMS.find(p => p.id === id)
}

/** armType usado en ArmConnection para credenciales de automatización */
export function automationArmType(platformId: string): string {
  return `automation:${platformId}`
}
