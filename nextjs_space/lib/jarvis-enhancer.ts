// JARVIS Enhancer - Prompt Engineering Autónomo + Slot Filling + Aspect Ratio

export interface EnhancedPrompt {
  originalQuery: string;
  enhancedPrompt: string;
  aspectRatio: string;
  detectedCategory: string;
  inferredParams: Record<string, string>;
}

export interface DashboardContext {
  projectName?: string;
  projectType?: string;
  primaryColor?: string;
  secondaryColor?: string;
  industry?: string;
  style?: string;
  recentTopics?: string[];
}

// Categorías de imagen con sus aspect ratios óptimos
const IMAGE_CATEGORIES = {
  wallpaper: { ratio: '16:9', keywords: ['fondo de pantalla', 'wallpaper', 'desktop', 'background', 'panorama', 'landscape', 'paisaje'] },
  portrait: { ratio: '2:3', keywords: ['retrato', 'portrait', 'persona', 'character', 'personaje', 'face', 'rostro', 'headshot'] },
  logo: { ratio: '1:1', keywords: ['logo', 'icono', 'icon', 'avatar', 'badge', 'emblema', 'símbolo', 'marca'] },
  banner: { ratio: '3:1', keywords: ['banner', 'header', 'cabecera', 'encabezado', 'hero', 'portada'] },
  social: { ratio: '1:1', keywords: ['instagram', 'social', 'post', 'publicación', 'redes'] },
  story: { ratio: '9:16', keywords: ['story', 'historia', 'vertical', 'móvil', 'tiktok', 'reel'] },
  thumbnail: { ratio: '16:9', keywords: ['thumbnail', 'miniatura', 'preview', 'vista previa', 'youtube'] },
  product: { ratio: '4:5', keywords: ['producto', 'product', 'ecommerce', 'tienda', 'artículo'] },
  cinematic: { ratio: '21:9', keywords: ['cinematic', 'cinemático', 'película', 'movie', 'scene', 'escena', 'epic'] },
  square: { ratio: '1:1', keywords: ['cuadrado', 'square', 'album', 'cover', 'carátula'] }
};

// Estilos artísticos para enhancement
const ARTISTIC_STYLES = {
  photorealistic: ['foto', 'real', 'fotografía', 'photorealistic', 'realistic', 'photograph'],
  digital_art: ['digital', 'arte digital', 'ilustración', 'illustration', 'concept art'],
  anime: ['anime', 'manga', 'japonés', 'estilo anime', 'cartoon'],
  oil_painting: ['óleo', 'pintura', 'painting', 'artístico', 'canvas'],
  minimalist: ['minimalista', 'minimal', 'simple', 'clean', 'limpio'],
  cyberpunk: ['cyberpunk', 'futurista', 'neon', 'sci-fi', 'futuristic'],
  fantasy: ['fantasy', 'fantasía', 'mágico', 'magical', 'épico', 'epic'],
  watercolor: ['acuarela', 'watercolor', 'soft', 'suave', 'delicado'],
  '3d_render': ['3d', 'render', 'cgi', 'dimensional', 'volumétrico'],
  vintage: ['vintage', 'retro', 'antiguo', 'old', 'nostálgico']
};

// Modificadores de calidad
const QUALITY_MODIFIERS = [
  'high quality',
  'highly detailed',
  'professional',
  'sharp focus',
  '8k resolution',
  'masterpiece'
];

// Lighting keywords para enhancement
const LIGHTING_STYLES = {
  dramatic: 'dramatic lighting, high contrast, deep shadows',
  soft: 'soft diffused lighting, gentle shadows, warm tones',
  studio: 'professional studio lighting, clean background',
  natural: 'natural sunlight, golden hour, ambient light',
  neon: 'neon lighting, vibrant colors, glowing effects',
  cinematic: 'cinematic lighting, film grain, moody atmosphere',
  backlit: 'backlit silhouette, rim lighting, halo effect'
};

/**
 * Detecta la categoría de imagen basada en el query
 */
function detectImageCategory(query: string): { category: string; ratio: string } {
  const lowerQuery = query.toLowerCase();
  
  for (const [category, config] of Object.entries(IMAGE_CATEGORIES)) {
    for (const keyword of config.keywords) {
      if (lowerQuery.includes(keyword)) {
        return { category, ratio: config.ratio };
      }
    }
  }
  
  // Default: cuadrado para la mayoría de casos
  return { category: 'general', ratio: '1:1' };
}

/**
 * Detecta el estilo artístico implícito o explícito
 */
function detectArtisticStyle(query: string): string {
  const lowerQuery = query.toLowerCase();
  
  for (const [style, keywords] of Object.entries(ARTISTIC_STYLES)) {
    for (const keyword of keywords) {
      if (lowerQuery.includes(keyword)) {
        return style.replace('_', ' ');
      }
    }
  }
  
  // Default basado en contenido
  if (lowerQuery.includes('persona') || lowerQuery.includes('gente')) {
    return 'photorealistic';
  }
  if (lowerQuery.includes('logo') || lowerQuery.includes('icono')) {
    return 'minimalist';
  }
  
  return 'digital art';
}

/**
 * Detecta el tipo de iluminación apropiada
 */
function detectLightingStyle(query: string, category: string): string {
  const lowerQuery = query.toLowerCase();
  
  // Detectar keywords de iluminación explícitos
  if (lowerQuery.includes('dramático') || lowerQuery.includes('dramatic')) {
    return LIGHTING_STYLES.dramatic;
  }
  if (lowerQuery.includes('neon') || lowerQuery.includes('neón')) {
    return LIGHTING_STYLES.neon;
  }
  if (lowerQuery.includes('suave') || lowerQuery.includes('soft')) {
    return LIGHTING_STYLES.soft;
  }
  if (lowerQuery.includes('natural') || lowerQuery.includes('atardecer')) {
    return LIGHTING_STYLES.natural;
  }
  if (lowerQuery.includes('cinematic') || lowerQuery.includes('cinemático')) {
    return LIGHTING_STYLES.cinematic;
  }
  
  // Default basado en categoría
  switch (category) {
    case 'logo':
    case 'product':
      return LIGHTING_STYLES.studio;
    case 'portrait':
      return LIGHTING_STYLES.soft;
    case 'cinematic':
    case 'wallpaper':
      return LIGHTING_STYLES.cinematic;
    default:
      return LIGHTING_STYLES.natural;
  }
}

/**
 * Infiere parámetros faltantes basado en el contexto del dashboard
 */
function inferMissingParams(
  query: string,
  context: DashboardContext
): Record<string, string> {
  const params: Record<string, string> = {};
  const lowerQuery = query.toLowerCase();
  
  // Si menciona "logo" o "marca" y tenemos nombre de proyecto
  if ((lowerQuery.includes('logo') || lowerQuery.includes('marca')) && context.projectName) {
    params.brandName = context.projectName;
  }
  
  // Si tenemos colores del proyecto y no se especifican
  if (!lowerQuery.includes('color') && context.primaryColor) {
    params.suggestedColors = `using ${context.primaryColor} as primary color`;
    if (context.secondaryColor) {
      params.suggestedColors += ` and ${context.secondaryColor} as accent`;
    }
  }
  
  // Si tenemos industria/estilo del proyecto
  if (context.industry) {
    params.industry = context.industry;
  }
  
  if (context.style) {
    params.styleHint = context.style;
  }
  
  // Inferir composición basada en el tipo de imagen
  if (lowerQuery.includes('grupo') || lowerQuery.includes('varios') || lowerQuery.includes('múltiples')) {
    params.composition = 'group composition, balanced layout';
  } else if (lowerQuery.includes('close') || lowerQuery.includes('cerca') || lowerQuery.includes('detalle')) {
    params.composition = 'close-up shot, detailed view';
  } else if (lowerQuery.includes('lejos') || lowerQuery.includes('wide') || lowerQuery.includes('panorámico')) {
    params.composition = 'wide angle, panoramic view';
  }
  
  return params;
}

/**
 * Construye el prompt mejorado con todos los enhancements
 */
function buildEnhancedPrompt(
  query: string,
  category: string,
  style: string,
  lighting: string,
  inferredParams: Record<string, string>
): string {
  const parts: string[] = [];
  
  // 1. Descripción principal mejorada
  let mainSubject = query;
  
  // Expandir descripciones simples
  const simpleExpansions: Record<string, string> = {
    'un gato': 'a beautiful cat with soft fur, expressive eyes, elegant pose',
    'un perro': 'a friendly dog with shiny coat, happy expression, natural setting',
    'una persona': 'a person with natural features, authentic expression, well-composed portrait',
    'un paisaje': 'a breathtaking landscape with vivid colors, natural elements, atmospheric depth',
    'un carro': 'a sleek car with reflective surface, dynamic angle, automotive photography style',
    'una casa': 'a charming house with architectural details, warm ambiance, inviting atmosphere'
  };
  
  for (const [simple, expanded] of Object.entries(simpleExpansions)) {
    if (query.toLowerCase().includes(simple)) {
      mainSubject = query.toLowerCase().replace(simple, expanded);
      break;
    }
  }
  
  parts.push(mainSubject);
  
  // 2. Añadir estilo artístico
  parts.push(`${style} style`);
  
  // 3. Añadir iluminación
  parts.push(lighting);
  
  // 4. Añadir parámetros inferidos
  if (inferredParams.suggestedColors) {
    parts.push(inferredParams.suggestedColors);
  }
  if (inferredParams.composition) {
    parts.push(inferredParams.composition);
  }
  if (inferredParams.brandName) {
    parts.push(`for brand "${inferredParams.brandName}"`);
  }
  
  // 5. Añadir modificadores de calidad
  const qualityMods = QUALITY_MODIFIERS.slice(0, 3).join(', ');
  parts.push(qualityMods);
  
  return parts.join(', ');
}

/**
 * Función principal: Mejora automáticamente un prompt de imagen
 */
export function enhanceImagePrompt(
  userQuery: string,
  context: DashboardContext = {}
): EnhancedPrompt {
  // 1. Detectar categoría y aspect ratio
  const { category, ratio } = detectImageCategory(userQuery);
  
  // 2. Detectar estilo artístico
  const style = detectArtisticStyle(userQuery);
  
  // 3. Detectar iluminación apropiada
  const lighting = detectLightingStyle(userQuery, category);
  
  // 4. Inferir parámetros faltantes del contexto
  const inferredParams = inferMissingParams(userQuery, context);
  
  // 5. Construir prompt mejorado
  const enhancedPrompt = buildEnhancedPrompt(
    userQuery,
    category,
    style,
    lighting,
    inferredParams
  );
  
  return {
    originalQuery: userQuery,
    enhancedPrompt,
    aspectRatio: ratio,
    detectedCategory: category,
    inferredParams
  };
}

/**
 * Obtiene las dimensiones en píxeles basado en aspect ratio
 */
export function getImageDimensions(aspectRatio: string): { width: number; height: number } {
  const dimensions: Record<string, { width: number; height: number }> = {
    '1:1': { width: 1024, height: 1024 },
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '2:3': { width: 683, height: 1024 },
    '3:2': { width: 1024, height: 683 },
    '4:5': { width: 819, height: 1024 },
    '3:1': { width: 1536, height: 512 },
    '21:9': { width: 2560, height: 1080 }
  };
  
  return dimensions[aspectRatio] || dimensions['1:1'];
}

/**
 * Exportar utilidades para uso externo
 */
export const JarvisEnhancer = {
  enhanceImagePrompt,
  getImageDimensions,
  detectImageCategory,
  detectArtisticStyle,
  IMAGE_CATEGORIES,
  ARTISTIC_STYLES
};
