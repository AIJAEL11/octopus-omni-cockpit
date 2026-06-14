// JARVIS Intelligence - Vibe Detection + Emotional Intelligence + Task Chaining

export type UserVibe = 'developer' | 'creative' | 'business' | 'marketing' | 'casual';

// Emotional states — detected independently from vibe
export type EmotionalState = 
  | 'neutral'
  | 'frustrated'     // Algo no funciona, está perdiendo paciencia
  | 'excited'        // Entusiasmado, celebrando un logro
  | 'confused'       // No entiende algo, necesita claridad
  | 'overwhelmed'    // Demasiado en su plato, necesita simplificación
  | 'casual_chat'    // Solo quiere hablar, no ejecutar nada
  | 'grateful'       // Agradeciendo, satisfecho
  | 'urgent'         // Presión de tiempo, necesita velocidad
  | 'curious'        // Explorando, haciendo preguntas abiertas
  | 'disappointed';  // Resultado no fue lo esperado

export interface VibeAnalysis {
  detectedVibe: UserVibe;
  emotionalState: EmotionalState;
  confidence: number;
  suggestedTemperature: number;
  responseStyle: {
    technical: boolean;
    verbose: boolean;
    emoji: boolean;
    formal: boolean;
  };
}

export interface ChainedTask {
  id: string;
  type: 'creation' | 'media' | 'analysis' | 'notification';
  action: string;
  params: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: unknown;
  dependsOn?: string;
}

export interface TaskChain {
  id: string;
  tasks: ChainedTask[];
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface SelfCorrectionAttempt {
  originalPrompt: string;
  error: string;
  correctedPrompt: string;
  attemptNumber: number;
}

// Patrones para detectar el "vibe" del usuario
const VIBE_PATTERNS: Record<UserVibe, RegExp[]> = {
  developer: [
    /\b(código|code|function|api|endpoint|debug|error|bug|deploy|git|npm|yarn)\b/i,
    /\b(typescript|javascript|react|next|prisma|sql|json|xml)\b/i,
    /\b(implementa|programa|desarrolla|refactoriza|optimiza)\b/i,
    /\b(terminal|consola|servidor|backend|frontend)\b/i
  ],
  creative: [
    /\b(diseño|design|arte|imagen|visual|estilo|colores?)\b/i,
    /\b(genera|crea|dibuja|ilustra|imagina|visualiza)\b/i,
    /\b(bonito|hermoso|elegante|minimalista|moderno|vibrante)\b/i,
    /\b(inspiración|creativo|artístico|aesthetic)\b/i
  ],
  marketing: [
    /\b(campaña|campaign|publicidad|ads?|anuncio|promoción|promo)\b/i,
    /\b(redes\s*sociales|instagram|tiktok|facebook|linkedin|twitter|youtube)\b/i,
    /\b(contenido|content|post|story|stories|reel|reels|feed|carousel|carrusel)\b/i,
    /\b(marketing|branding|marca|lanzamiento|launch|funnel|embudo)\b/i,
    /\b(engagement|awareness|conversión|lead|leads|cta|copy|copywriting|hashtag)\b/i,
    /\b(calendario\s*editorial|plan\s*de\s*contenido|estrategia\s*digital|growth)\b/i,
    /\b(audiencia|target|segmento|nicho|b2b|b2c|dtc|ecommerce)\b/i
  ],
  business: [
    /\b(proyecto|negocio|empresa|cliente|producto|servicio)\b/i,
    /\b(roi|kpi|métricas|analytics|conversión|ventas)\b/i,
    /\b(estrategia|plan|objetivo|meta|deadline|entrega)\b/i,
    /\b(profesional|corporativo|presentación|reporte)\b/i
  ],
  casual: [
    /\b(hola|hey|que tal|como estas|ayuda|por favor|gracias)\b/i,
    /\b(quiero|necesito|puedes|podrías|hazme|dame)\b/i,
    /\b(cool|genial|chido|mola|increíble|wow)\b/i
  ]
};

// Patrones para detectar estado emocional (independiente del vibe)
const EMOTION_PATTERNS: Record<EmotionalState, RegExp[]> = {
  frustrated: [
    /\b(no funciona|no sirve|no jala|está roto|broken|error|falla|bug|problema)\b/i,
    /\b(otra vez|de nuevo|sigue sin|ya intenté|no puedo|no logro)\b/i,
    /\b(ugh|argh|maldición|rayos|carajo|wtf|demonios)\b/i,
    /\b(harto|cansado|frustrado|molesto|irritado)\b/i,
    /[!?]{2,}|\.{3,}/,
  ],
  excited: [
    /\b(increíble|amazing|wow|genial|excelente|perfecto|brutal|fire|🔥)\b/i,
    /\b(me encanta|love it|espectacular|lo logré|funcionó|siiii)\b/i,
    /[!]{2,}|🎉|🚀|💪|🔥|❤️|😍/,
    /\b(vamooo|let'?s go|dale que|a darle)\b/i,
  ],
  confused: [
    /\b(no entiendo|no comprendo|qué es|cómo funciona|qué significa)\b/i,
    /\b(confundido|perdido|no sé|me explicas|a qué te refieres)\b/i,
    /\b(cuál es la diferencia|por qué|para qué sirve)\b/i,
    /\?{2,}/,
  ],
  overwhelmed: [
    /\b(demasiado|mucho|no sé por dónde|no sé qué hacer primero)\b/i,
    /\b(abrumado|overwhelmed|estresado|agobiado)\b/i,
    /\b(es mucho|son muchas cosas|no me da tiempo)\b/i,
  ],
  casual_chat: [
    /\b(qué opinas|tú qué piensas|cómo ves|qué onda|cuéntame)\b/i,
    /\b(platicamos|hablemos|conversemos|dime algo)\b/i,
    /\b(cómo estás|qué tal tu día|qué hay de nuevo)\b/i,
    /\b(jaja|haha|lol|😂|🤣|jejeje)\b/i,
  ],
  grateful: [
    /\b(gracias|thanks|thank you|te agradezco|mil gracias)\b/i,
    /\b(eres genial|eres increíble|excelente trabajo|buen trabajo)\b/i,
    /\b(me salvaste|justo lo que necesitaba|perfecto así)\b/i,
    /👏|🙏|❤️|💯/,
  ],
  urgent: [
    /\b(urgente|asap|ya|ahora|rápido|inmediato|de emergencia)\b/i,
    /\b(deadline|para hoy|para ya|no tengo tiempo|apúrate)\b/i,
    /\b(lo necesito ya|cuanto antes|prisa|corriendo)\b/i,
    /🚨|⚠️|🆘/,
  ],
  curious: [
    /\b(me pregunto|puedes hacer|es posible|qué pasaría si)\b/i,
    /\b(dime más|explícame|cuéntame sobre|cómo sería)\b/i,
    /\b(hipotéticamente|imagina que|y si)\b/i,
    /\b(interesante|hmm|mmm|a ver)\b/i,
  ],
  disappointed: [
    /\b(no era lo que|esperaba algo|no me gustó|meh|regular)\b/i,
    /\b(pensé que|debería ser|no es lo que pedí|incompleto)\b/i,
    /\b(decepcionado|disappointed|no cumple|le falta)\b/i,
    /😕|😞|👎/,
  ],
  neutral: [], // Default fallback — no patterns needed
};

/**
 * Detecta el estado emocional del usuario
 */
function detectEmotionalState(message: string, messageHistory: string[] = []): EmotionalState {
  const scores: Partial<Record<EmotionalState, number>> = {};
  
  // Score current message (high weight)
  for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS)) {
    if (emotion === 'neutral') continue;
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) score += 2;
    }
    if (score > 0) scores[emotion as EmotionalState] = score;
  }

  // Check recent history for reinforcement (lower weight)
  for (const histMsg of messageHistory.slice(-3)) {
    for (const [emotion, patterns] of Object.entries(EMOTION_PATTERNS)) {
      if (emotion === 'neutral') continue;
      for (const pattern of patterns) {
        if (pattern.test(histMsg)) {
          scores[emotion as EmotionalState] = (scores[emotion as EmotionalState] || 0) + 0.5;
        }
      }
    }
  }

  // Find dominant emotion
  let maxScore = 0;
  let detected: EmotionalState = 'neutral';
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detected = emotion as EmotionalState;
    }
  }

  // Need minimum threshold to avoid false positives
  return maxScore >= 2 ? detected : 'neutral';
}

// Configuración de respuesta por vibe
const VIBE_CONFIGS: Record<UserVibe, VibeAnalysis['responseStyle'] & { temperature: number }> = {
  developer: {
    technical: true,
    verbose: false,
    emoji: false,
    formal: false,
    temperature: 0.3
  },
  creative: {
    technical: false,
    verbose: true,
    emoji: true,
    formal: false,
    temperature: 0.8
  },
  marketing: {
    technical: false,
    verbose: true,
    emoji: true,
    formal: false,
    temperature: 0.7
  },
  business: {
    technical: false,
    verbose: true,
    emoji: false,
    formal: true,
    temperature: 0.5
  },
  casual: {
    technical: false,
    verbose: false,
    emoji: true,
    formal: false,
    temperature: 0.7
  }
};

// Patrones para detectar tareas encadenadas
const CHAIN_PATTERNS = [
  /(?:crea|genera|haz) (?:un|una) ([\w\s]+) y (?:después|luego|también|además) (?:genera|crea|haz) (?:un|una|el|la) ([\w\s]+)/i,
  /(?:quiero|necesito) (?:un|una) ([\w\s]+) con (?:su|un|una) ([\w\s]+)/i,
  /(?:genera|crea) ([\w\s]+) (?:y|,) ([\w\s]+) (?:y|,)? ?([\w\s]+)?/i
];

// Mapeo de palabras clave a tipos de tarea
const TASK_TYPE_KEYWORDS: Record<ChainedTask['type'], string[]> = {
  creation: ['skill', 'agente', 'mcp', 'herramienta', 'componente', 'función', 'api'],
  media: ['imagen', 'logo', 'icono', 'banner', 'foto', 'ilustración', 'gráfico'],
  analysis: ['analiza', 'revisa', 'evalúa', 'compara', 'diagnostica'],
  notification: ['notifica', 'avisa', 'envía', 'reporta', 'informa']
};

/**
 * Analiza el "vibe" del usuario basado en su mensaje
 */
export function analyzeUserVibe(message: string, messageHistory: string[] = []): VibeAnalysis {
  const scores: Record<UserVibe, number> = {
    developer: 0,
    creative: 0,
    marketing: 0,
    business: 0,
    casual: 0
  };
  
  // Analizar mensaje actual
  for (const [vibe, patterns] of Object.entries(VIBE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        scores[vibe as UserVibe] += 2;
      }
    }
  }
  
  // Analizar historial (con menos peso)
  for (const histMsg of messageHistory.slice(-5)) {
    for (const [vibe, patterns] of Object.entries(VIBE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(histMsg)) {
          scores[vibe as UserVibe] += 0.5;
        }
      }
    }
  }
  
  // Encontrar vibe dominante
  let maxScore = 0;
  let detectedVibe: UserVibe = 'casual';
  let totalScore = 0;
  
  for (const [vibe, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
      detectedVibe = vibe as UserVibe;
    }
  }
  
  const confidence = totalScore > 0 ? maxScore / totalScore : 0.25;
  const config = VIBE_CONFIGS[detectedVibe];
  
  // Detect emotional state independently
  const emotionalState = detectEmotionalState(message, messageHistory);
  
  // Adjust temperature based on emotional state
  let adjustedTemperature = config.temperature;
  if (emotionalState === 'casual_chat' || emotionalState === 'excited') {
    adjustedTemperature = Math.min(adjustedTemperature + 0.15, 0.9);
  } else if (emotionalState === 'frustrated' || emotionalState === 'urgent') {
    adjustedTemperature = Math.max(adjustedTemperature - 0.1, 0.25);
  } else if (emotionalState === 'confused') {
    adjustedTemperature = Math.max(adjustedTemperature - 0.05, 0.3);
  }
  
  return {
    detectedVibe,
    emotionalState,
    confidence,
    suggestedTemperature: adjustedTemperature,
    responseStyle: {
      technical: config.technical,
      verbose: config.verbose,
      emoji: config.emoji,
      formal: config.formal
    }
  };
}

// Compact style tags per vibe — replaces verbose multi-line instructions
const VIBE_STYLE_TAGS: Record<UserVibe, string> = {
  developer: '[ESTILO: técnico, conciso, sin emojis, código cuando aplique]',
  creative: '[ESTILO: inspirador, detallado, emojis naturales, tono cercano]',
  marketing: '[ESTILO: marketing mode — campañas, funnels, ROI, copy publicitario, genera MÚLTIPLES piezas]',
  business: '[ESTILO: profesional, formal, detallado, métricas y estrategia]',
  casual: '[ESTILO: amigable, conciso, emojis, tono de colega]',
}

// Compact emotion directives — 1-2 lines instead of 5+
const EMOTION_DIRECTIVES: Record<EmotionalState, string> = {
  frustrated: '⚡ Usuario FRUSTRADO → reconoce, ve DIRECTO a solución, cero minimizar, verifica al final.',
  excited: '🎉 Usuario EMOCIONADO → celebra, amplifica, sugiere siguiente paso, no apagues con formalidad.',
  confused: '🤔 Usuario CONFUNDIDO → analogías simples, pasos pequeños, ejemplos de SU contexto, pregunta "¿tiene sentido?".',
  overwhelmed: '😮‍💨 Usuario ABRUMADO → prioriza por él, ofrece hacerlo, divide en pasos, transmite calma.',
  casual_chat: '💬 CONVERSACIÓN CASUAL → NO ejecutes herramientas, conversa naturalmente, pregunta de vuelta.',
  grateful: '🙏 Usuario AGRADECIDO → recibe con calidez, dale crédito, pregunta si necesita algo más.',
  urgent: '🚨 URGENCIA → cero introducción, ejecuta ya, ultra-conciso, velocidad sobre perfección.',
  curious: '🔍 CURIOSO → contexto rico, conecta posibilidades, comparte insights extra.',
  disappointed: '😔 DECEPCIONADO → reconoce sin excusas, pregunta qué esperaba, ofrece rehacer ya.',
  neutral: '',
}

/**
 * Ajusta el system prompt de JARVIS según el vibe + estado emocional detectado.
 * Fase 3: Compact injection — ~50 tokens instead of ~300-500.
 * Only injects emotional layer when confidence is meaningful.
 */
export function adjustSystemPromptForVibe(
  basePrompt: string,
  vibeAnalysis: VibeAnalysis
): string {
  const parts: string[] = [basePrompt]
  
  // Always inject style tag (1 line, ~15 tokens)
  parts.push(VIBE_STYLE_TAGS[vibeAnalysis.detectedVibe])
  
  // Only inject emotion directive if non-neutral AND confidence >= 0.4
  if (vibeAnalysis.emotionalState !== 'neutral' && vibeAnalysis.confidence >= 0.4) {
    const directive = EMOTION_DIRECTIVES[vibeAnalysis.emotionalState]
    if (directive) parts.push(directive)
  }
  
  return parts.join('\n')
}

/**
 * Detecta si el mensaje contiene múltiples tareas encadenadas
 */
export function detectTaskChain(message: string): ChainedTask[] | null {
  const tasks: ChainedTask[] = [];
  
  // Buscar patrones de encadenamiento
  for (const pattern of CHAIN_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      // Extraer cada tarea mencionada
      for (let i = 1; i < match.length; i++) {
        if (match[i]) {
          const taskDesc = match[i].trim();
          const taskType = detectTaskType(taskDesc);
          
          tasks.push({
            id: `task_${Date.now()}_${i}`,
            type: taskType,
            action: taskDesc,
            params: { description: taskDesc },
            status: 'pending',
            dependsOn: i > 1 ? tasks[i - 2]?.id : undefined
          });
        }
      }
      break;
    }
  }
  
  // Si no encontramos patrones explícitos, buscar múltiples acciones
  if (tasks.length === 0) {
    const actionWords = message.match(/(?:crea|genera|haz|diseña|implementa|añade)/gi);
    if (actionWords && actionWords.length > 1) {
      // Dividir por conjunciones
      const parts = message.split(/\s+(?:y|,|después|luego|también)\s+/i);
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.length > 5) {
          const taskType = detectTaskType(part);
          
          tasks.push({
            id: `task_${Date.now()}_${i}`,
            type: taskType,
            action: part,
            params: { description: part },
            status: 'pending',
            dependsOn: i > 0 ? tasks[i - 1]?.id : undefined
          });
        }
      }
    }
  }
  
  return tasks.length > 1 ? tasks : null;
}

/**
 * Detecta el tipo de tarea basado en palabras clave
 */
function detectTaskType(taskDescription: string): ChainedTask['type'] {
  const lowerDesc = taskDescription.toLowerCase();
  
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerDesc.includes(keyword)) {
        return type as ChainedTask['type'];
      }
    }
  }
  
  // Default basado en contenido
  if (/imagen|logo|icono|visual|foto/i.test(lowerDesc)) {
    return 'media';
  }
  
  return 'creation';
}

/**
 * Genera una corrección para un prompt que falló
 */
export function generateSelfCorrection(
  originalPrompt: string,
  error: string,
  attemptNumber: number
): SelfCorrectionAttempt | null {
  // Máximo 3 intentos
  if (attemptNumber >= 3) {
    return null;
  }
  
  let correctedPrompt = originalPrompt;
  const lowerError = error.toLowerCase();
  
  // Correcciones basadas en el tipo de error
  if (lowerError.includes('safety') || lowerError.includes('content policy') || lowerError.includes('inappropriate')) {
    // Error de contenido - hacer el prompt más neutral
    correctedPrompt = originalPrompt
      .replace(/\b(violent|gore|blood|weapon|gun|nude|naked|sexy)\b/gi, '')
      .replace(/\b(violento|sangre|arma|desnudo|sexy)\b/gi, '')
      + ', safe for work, family friendly';
  } else if (lowerError.includes('rate limit') || lowerError.includes('quota')) {
    // Rate limit - no hay corrección posible, solo esperar
    return null;
  } else if (lowerError.includes('invalid') || lowerError.includes('format')) {
    // Error de formato - simplificar el prompt
    correctedPrompt = originalPrompt
      .replace(/[^\w\s,.-]/g, '') // Eliminar caracteres especiales
      .substring(0, 500); // Limitar longitud
  } else if (lowerError.includes('timeout') || lowerError.includes('network')) {
    // Error de red - no modificar, solo reintentar
    correctedPrompt = originalPrompt;
  } else {
    // Error genérico - simplificar y añadir claridad
    const words = originalPrompt.split(' ');
    if (words.length > 20) {
      correctedPrompt = words.slice(0, 15).join(' ') + ', clear composition, well-defined';
    } else {
      correctedPrompt = originalPrompt + ', well-defined, clear';
    }
  }
  
  return {
    originalPrompt,
    error,
    correctedPrompt,
    attemptNumber: attemptNumber + 1
  };
}

/**
 * Ejecuta una cadena de tareas secuencialmente
 */
export async function executeTaskChain(
  chain: TaskChain,
  executors: {
    creation: (task: ChainedTask) => Promise<unknown>;
    media: (task: ChainedTask) => Promise<unknown>;
    analysis: (task: ChainedTask) => Promise<unknown>;
    notification: (task: ChainedTask) => Promise<unknown>;
  },
  onProgress?: (task: ChainedTask, status: string) => void
): Promise<TaskChain> {
  chain.status = 'running';
  chain.startedAt = Date.now();
  
  const completedTasks: string[] = [];
  
  for (const task of chain.tasks) {
    // Verificar dependencias
    if (task.dependsOn && !completedTasks.includes(task.dependsOn)) {
      task.status = 'failed';
      continue;
    }
    
    task.status = 'running';
    onProgress?.(task, 'running');
    
    try {
      const executor = executors[task.type];
      if (executor) {
        task.result = await executor(task);
        task.status = 'completed';
        completedTasks.push(task.id);
        onProgress?.(task, 'completed');
      } else {
        task.status = 'failed';
        onProgress?.(task, 'no executor');
      }
    } catch (error) {
      task.status = 'failed';
      task.result = error instanceof Error ? error.message : 'Unknown error';
      onProgress?.(task, 'failed');
    }
  }
  
  // Determinar estado final de la cadena
  const completed = chain.tasks.filter(t => t.status === 'completed').length;
  const total = chain.tasks.length;
  
  if (completed === total) {
    chain.status = 'completed';
  } else if (completed > 0) {
    chain.status = 'partial';
  } else {
    chain.status = 'failed';
  }
  
  chain.completedAt = Date.now();
  return chain;
}

/**
 * Formatea el resultado de una cadena de tareas para el usuario
 */
export function formatTaskChainResult(chain: TaskChain): string {
  const lines: string[] = [];
  
  if (chain.status === 'completed') {
    lines.push('✅ **Todas las tareas completadas exitosamente**\n');
  } else if (chain.status === 'partial') {
    lines.push('⚠️ **Algunas tareas completadas**\n');
  } else {
    lines.push('❌ **Error al ejecutar las tareas**\n');
  }
  
  for (const task of chain.tasks) {
    const icon = task.status === 'completed' ? '✓' : task.status === 'failed' ? '✗' : '○';
    lines.push(`${icon} ${task.action}`);
  }
  
  const duration = chain.completedAt ? 
    ((chain.completedAt - chain.startedAt) / 1000).toFixed(1) + 's' : 
    'en progreso';
  
  lines.push(`\n_Tiempo total: ${duration}_`);
  
  return lines.join('\n');
}

export const JarvisIntelligence = {
  analyzeUserVibe,
  adjustSystemPromptForVibe,
  detectTaskChain,
  generateSelfCorrection,
  executeTaskChain,
  formatTaskChainResult
};
