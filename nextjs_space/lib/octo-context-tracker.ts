/**
 * Proactive Context Tracker for ASK Octo AI
 * Tracks user behavior and detects confusion/inactivity
 */

export interface UserContext {
  currentPage: string
  currentModule: string
  lastAction: string
  lastActionTime: number
  actionsInSession: number
  errorsDetected: number
  idleTime: number
  helpRequested: boolean
}

export interface ProactiveHint {
  trigger: 'idle' | 'error' | 'confusion' | 'first_visit' | 'stuck'
  message: string
  suggestions: string[]
}

// Thresholds for proactive help
const IDLE_THRESHOLD_MS = 45000 // 45 seconds
const ERROR_THRESHOLD = 2
const CONFUSION_PATTERNS = [
  'click', 'click', 'click', // Rapid clicking
  'back', 'forward', 'back', // Navigation confusion
]

// Module-specific proactive hints
const MODULE_HINTS: Record<string, ProactiveHint> = {
  jarvis: {
    trigger: 'first_visit',
    message: '👋 ¡Hola! Soy ASK Octo AI. ¿Necesitas ayuda con Jarvis?',
    suggestions: [
      '¿Cómo genero imágenes?',
      '¿Cómo creo videos UGC?',
      '¿Cómo programo publicaciones?',
    ]
  },
  'social-bridge': {
    trigger: 'first_visit',
    message: '📱 Veo que estás en Social Bridge. ¿Necesitas ayuda para conectar o publicar?',
    suggestions: [
      '¿Cómo conecto LinkedIn?',
      '¿Cómo programo un post?',
      '¿Por qué mi publicación falló?',
    ]
  },
  'ugc-factory': {
    trigger: 'first_visit',
    message: '🎬 Estás en UGC Factory. ¿Te ayudo a crear tu primer video?',
    suggestions: [
      '¿Cómo creo un avatar?',
      '¿Cuánto tarda un video?',
      '¿Qué voces están disponibles?',
    ]
  },
  default: {
    trigger: 'idle',
    message: '🤔 Parece que llevas un rato aquí. ¿Puedo ayudarte en algo?',
    suggestions: [
      'Muéstrame qué puedo hacer',
      '¿Cómo empiezo?',
      'Tengo un problema',
    ]
  }
}

// Error-specific hints
const ERROR_HINTS: Record<string, ProactiveHint> = {
  linkedin_connection: {
    trigger: 'error',
    message: '⚠️ Detecté un problema con LinkedIn. ¿Necesitas ayuda?',
    suggestions: [
      '¿Por qué no puedo conectar?',
      '¿Cómo reconecto mi cuenta?',
      'El token expiró, ¿qué hago?',
    ]
  },
  video_generation: {
    trigger: 'error',
    message: '🎥 Parece que hubo un problema con la generación de video.',
    suggestions: [
      '¿Por qué falló mi video?',
      '¿Cómo reinicio la generación?',
      '¿El video está tardando mucho?',
    ]
  },
  general: {
    trigger: 'error',
    message: '⚠️ Detecté algunos errores. ¿Te ayudo a resolverlos?',
    suggestions: [
      '¿Qué salió mal?',
      '¿Cómo soluciono este error?',
      'Necesito soporte técnico',
    ]
  }
}

/**
 * Detect if user might need help based on context
 */
export function detectHelpNeeded(context: UserContext): ProactiveHint | null {
  // Check idle time
  if (context.idleTime > IDLE_THRESHOLD_MS) {
    return MODULE_HINTS[context.currentModule] || MODULE_HINTS.default
  }
  
  // Check error count
  if (context.errorsDetected >= ERROR_THRESHOLD) {
    return ERROR_HINTS.general
  }
  
  // First visit to a module (low actions)
  if (context.actionsInSession < 3) {
    const hint = MODULE_HINTS[context.currentModule]
    if (hint && hint.trigger === 'first_visit') {
      return hint
    }
  }
  
  return null
}

/**
 * Get contextual suggestions based on current module
 */
export function getContextualSuggestions(module: string): string[] {
  const hint = MODULE_HINTS[module] || MODULE_HINTS.default
  return hint.suggestions
}

/**
 * Analyze user behavior patterns
 */
export function analyzeUserBehavior(actions: string[]): 'normal' | 'confused' | 'frustrated' {
  // Detect rapid repeated actions (confusion)
  const recentActions = actions.slice(-5)
  const uniqueActions = new Set(recentActions).size
  
  if (recentActions.length >= 5 && uniqueActions <= 2) {
    return 'confused'
  }
  
  // Detect back-and-forth navigation
  const hasBackForth = recentActions.some((action, i) => {
    if (i < 2) return false
    return action === recentActions[i - 2] && action !== recentActions[i - 1]
  })
  
  if (hasBackForth) {
    return 'frustrated'
  }
  
  return 'normal'
}
