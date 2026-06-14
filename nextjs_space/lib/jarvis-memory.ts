// JARVIS Memory System - Memoria de Atributos Visuales para Continuidad

export interface VisualAttributes {
  subject: string;           // "caballero con armadura"
  style: string;             // "fantasy digital art"
  colors: string[];          // ["azul", "plateado"]
  mood: string;              // "épico"
  setting: string;           // "campo de batalla"
  additionalElements: string[]; // ["espada", "escudo"]
  lighting: string;          // "dramatic"
}

export interface ImageMemoryEntry {
  id: string;
  timestamp: number;
  prompt: string;
  enhancedPrompt: string;
  imageUrl?: string;
  visualAttributes: VisualAttributes;
  aspectRatio: string;
}

export interface ConversationContext {
  lastImagePrompt: string | null;
  lastVisualAttributes: VisualAttributes | null;
  imageHistory: ImageMemoryEntry[];
  sessionTopics: string[];
  currentProject: string | null;
  userPreferences: {
    preferredStyle?: string;
    preferredColors?: string[];
    preferredRatio?: string;
  };
}

// Patrones para detectar modificaciones a imágenes previas
const MODIFICATION_PATTERNS = [
  /^(ahora|y ahora|pero|y|también|además)/i,
  /^(ponle|añade|agrega|quita|elimina|cambia|hazlo|hazla)/i,
  /^(con|sin) (un|una|el|la|más|menos)/i,
  /^(el mismo|la misma|igual pero)/i,
  /(pero )?esta vez/i,
  /^(lo mismo|otra vez|de nuevo) (pero|con|sin)/i
];

// Patrones para extraer elementos visuales del prompt
const VISUAL_EXTRACTORS = {
  subject: [
    /(?:un|una|el|la|the|a) ([\w\s]+?)(?:\s+(?:con|en|de|with|in)|$)/i,
    /^([\w\s]+?)(?:\s+(?:con|en|de|with|in)|$)/i
  ],
  colors: [
    /color(?:es)? (\w+)/gi,
    /(azul|rojo|verde|amarillo|naranja|morado|rosa|negro|blanco|dorado|plateado|blue|red|green|yellow|orange|purple|pink|black|white|gold|silver)/gi
  ],
  mood: [
    /(épico|dramático|sereno|misterioso|alegre|oscuro|luminoso|epic|dramatic|serene|mysterious|joyful|dark|bright)/i
  ],
  setting: [
    /(?:en|at|in|on) (?:un|una|el|la|the|a) ([\w\s]+)/i
  ]
};

/**
 * Detecta si el mensaje es una modificación de la imagen anterior
 */
export function isImageModification(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return MODIFICATION_PATTERNS.some(pattern => pattern.test(lowerMessage));
}

/**
 * Extrae atributos visuales de un prompt de imagen
 */
export function extractVisualAttributes(prompt: string): VisualAttributes {
  const attrs: VisualAttributes = {
    subject: '',
    style: 'digital art',
    colors: [],
    mood: 'neutral',
    setting: '',
    additionalElements: [],
    lighting: 'natural'
  };
  
  // Extraer sujeto principal
  for (const pattern of VISUAL_EXTRACTORS.subject) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      attrs.subject = match[1].trim();
      break;
    }
  }
  
  // Extraer colores
  for (const pattern of VISUAL_EXTRACTORS.colors) {
    const matches = prompt.match(pattern);
    if (matches) {
      attrs.colors.push(...matches.map(m => m.toLowerCase()));
    }
  }
  attrs.colors = [...new Set(attrs.colors)]; // Eliminar duplicados
  
  // Extraer mood
  for (const pattern of VISUAL_EXTRACTORS.mood) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      attrs.mood = match[1].toLowerCase();
      break;
    }
  }
  
  // Extraer setting
  for (const pattern of VISUAL_EXTRACTORS.setting) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      attrs.setting = match[1].trim();
      break;
    }
  }
  
  // Extraer elementos adicionales (con X, con Y)
  const elementsMatch = prompt.match(/con (?:un|una|su|sus|el|la|los|las)? ?([\w\s]+?)(?:,|$|\.|\s+y\s+)/gi);
  if (elementsMatch) {
    attrs.additionalElements = elementsMatch.map(m => 
      m.replace(/^con (?:un|una|su|sus|el|la|los|las)? ?/i, '').trim()
    );
  }
  
  // Detectar estilo
  const styles = ['anime', 'realistic', 'fantasy', 'cyberpunk', 'watercolor', 'oil painting', '3d render', 'pixel art'];
  for (const style of styles) {
    if (prompt.toLowerCase().includes(style)) {
      attrs.style = style;
      break;
    }
  }
  
  // Detectar iluminación
  const lightings = ['dramatic', 'soft', 'neon', 'natural', 'studio', 'cinematic', 'backlit'];
  for (const light of lightings) {
    if (prompt.toLowerCase().includes(light)) {
      attrs.lighting = light;
      break;
    }
  }
  
  return attrs;
}

/**
 * Combina atributos previos con nuevas modificaciones
 */
export function mergeVisualAttributes(
  previous: VisualAttributes,
  modification: string
): VisualAttributes {
  const newAttrs = extractVisualAttributes(modification);
  
  // Crear copia de los atributos previos
  const merged: VisualAttributes = { ...previous };
  
  // Detectar acciones específicas
  const lowerMod = modification.toLowerCase();
  
  // Añadir elementos
  const addMatch = lowerMod.match(/(?:ponle|añade|agrega|con) (?:un|una|su|sus|el|la)? ?([\w\s]+)/i);
  if (addMatch) {
    merged.additionalElements = [...merged.additionalElements, addMatch[1].trim()];
  }
  
  // Quitar elementos
  const removeMatch = lowerMod.match(/(?:quita|elimina|sin) (?:el|la|su|sus)? ?([\w\s]+)/i);
  if (removeMatch) {
    const toRemove = removeMatch[1].trim().toLowerCase();
    merged.additionalElements = merged.additionalElements.filter(
      el => !el.toLowerCase().includes(toRemove)
    );
  }
  
  // Cambiar colores
  const colorMatch = lowerMod.match(/(?:cambia|hazlo|color) (?:a |de )?(\w+)/i);
  if (colorMatch && newAttrs.colors.length > 0) {
    merged.colors = newAttrs.colors;
  }
  
  // Cambiar mood
  if (newAttrs.mood !== 'neutral') {
    merged.mood = newAttrs.mood;
  }
  
  // Cambiar setting
  const settingMatch = lowerMod.match(/(?:en|at|ponlo en) (?:un|una|el|la|the|a)? ?([\w\s]+)/i);
  if (settingMatch) {
    merged.setting = settingMatch[1].trim();
  }
  
  return merged;
}

/**
 * Construye un prompt completo desde atributos visuales
 */
export function buildPromptFromAttributes(attrs: VisualAttributes): string {
  const parts: string[] = [];
  
  // Sujeto principal
  if (attrs.subject) {
    parts.push(attrs.subject);
  }
  
  // Colores
  if (attrs.colors.length > 0) {
    parts.push(`in ${attrs.colors.join(' and ')} colors`);
  }
  
  // Elementos adicionales
  if (attrs.additionalElements.length > 0) {
    parts.push(`with ${attrs.additionalElements.join(', ')}`);
  }
  
  // Setting
  if (attrs.setting) {
    parts.push(`in ${attrs.setting}`);
  }
  
  // Mood
  if (attrs.mood && attrs.mood !== 'neutral') {
    parts.push(`${attrs.mood} atmosphere`);
  }
  
  // Estilo
  parts.push(`${attrs.style} style`);
  
  // Iluminación
  parts.push(`${attrs.lighting} lighting`);
  
  return parts.join(', ');
}

/**
 * Clase principal para gestionar la memoria visual de JARVIS
 */
export class JarvisVisualMemory {
  private context: ConversationContext;
  
  constructor() {
    this.context = {
      lastImagePrompt: null,
      lastVisualAttributes: null,
      imageHistory: [],
      sessionTopics: [],
      currentProject: null,
      userPreferences: {}
    };
  }
  
  /**
   * Procesa una solicitud de imagen y determina si es nueva o modificación
   */
  processImageRequest(userMessage: string): {
    isModification: boolean;
    finalPrompt: string;
    attributes: VisualAttributes;
  } {
    const isModification = this.context.lastVisualAttributes !== null && 
                           isImageModification(userMessage);
    
    let attributes: VisualAttributes;
    let finalPrompt: string;
    
    if (isModification && this.context.lastVisualAttributes) {
      // Combinar con atributos previos
      attributes = mergeVisualAttributes(
        this.context.lastVisualAttributes,
        userMessage
      );
      finalPrompt = buildPromptFromAttributes(attributes);
    } else {
      // Nueva imagen desde cero
      attributes = extractVisualAttributes(userMessage);
      finalPrompt = userMessage;
    }
    
    return {
      isModification,
      finalPrompt,
      attributes
    };
  }
  
  /**
   * Guarda una imagen generada en la memoria
   */
  saveImageToMemory(
    prompt: string,
    enhancedPrompt: string,
    attributes: VisualAttributes,
    imageUrl?: string,
    aspectRatio: string = '1:1'
  ): string {
    const id = `img_${Date.now()}`;
    
    const entry: ImageMemoryEntry = {
      id,
      timestamp: Date.now(),
      prompt,
      enhancedPrompt,
      imageUrl,
      visualAttributes: attributes,
      aspectRatio
    };
    
    this.context.imageHistory.push(entry);
    this.context.lastImagePrompt = prompt;
    this.context.lastVisualAttributes = attributes;
    
    // Mantener solo las últimas 10 imágenes
    if (this.context.imageHistory.length > 10) {
      this.context.imageHistory.shift();
    }
    
    return id;
  }
  
  /**
   * Obtiene el contexto actual
   */
  getContext(): ConversationContext {
    return this.context;
  }
  
  /**
   * Actualiza preferencias del usuario
   */
  updatePreferences(prefs: Partial<ConversationContext['userPreferences']>): void {
    this.context.userPreferences = {
      ...this.context.userPreferences,
      ...prefs
    };
  }
  
  /**
   * Limpia la memoria visual (nueva sesión)
   */
  clearMemory(): void {
    this.context.lastImagePrompt = null;
    this.context.lastVisualAttributes = null;
    this.context.imageHistory = [];
  }
  
  /**
   * Exporta la memoria para persistencia
   */
  exportMemory(): string {
    return JSON.stringify(this.context);
  }
  
  /**
   * Importa memoria desde persistencia
   */
  importMemory(data: string): void {
    try {
      this.context = JSON.parse(data);
    } catch {
      console.error('Error importing memory');
    }
  }
}

export const visualMemory = new JarvisVisualMemory();
