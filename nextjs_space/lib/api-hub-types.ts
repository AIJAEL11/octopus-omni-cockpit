// API Hub Types and Configuration

export type ApiServiceType = 
  | 'openrouter'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'replicate'
  | 'elevenlabs'
  | 'stability'
  | 'huggingface'
  | 'cohere'
  | 'mistral'
  | 'together'
  | 'perplexity'
  | 'falai'
  | 'content_publisher'
  | 'custom'

export type ApiKeyStatus = 'active' | 'inactive' | 'error' | 'testing'

export interface ApiKeyConnection {
  id: string
  userId: string
  serviceType: ApiServiceType
  name: string
  apiKey: string // Encriptada en BD
  baseUrl?: string
  status: ApiKeyStatus
  lastTested?: Date
  lastUsed?: Date
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface ApiServiceConfig {
  type: ApiServiceType
  name: string
  name_en?: string
  description: string
  description_en: string
  icon: string
  color: string
  baseUrl: string
  docsUrl: string
  pricingUrl: string
  features: string[]
  features_en: string[]
  models?: string[]
  testEndpoint: string
  headers: (apiKey: string) => Record<string, string>
  category: 'llm' | 'image' | 'audio' | 'video' | 'embeddings' | 'multi' | 'publishing'
}

export const API_SERVICE_CONFIGS: Record<ApiServiceType, ApiServiceConfig> = {
  openrouter: {
    type: 'openrouter',
    name: 'OpenRouter',
    description: 'Acceso unificado a múltiples LLMs (GPT-4, Claude, Llama, etc.)',
    description_en: 'Unified access to multiple LLMs (GPT-4, Claude, Llama, etc.)',
    icon: '🌐',
    color: '#6366F1',
    baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/docs',
    pricingUrl: 'https://openrouter.ai/pricing',
    features: ['Multi-modelo', 'Pay-per-use', 'Fallback automático', 'API compatible OpenAI'],
    features_en: ['Multi-model', 'Pay-per-use', 'Automatic fallback', 'OpenAI compatible API'],
    models: ['openai/gpt-4-turbo', 'anthropic/claude-3-opus', 'meta-llama/llama-3-70b', 'mistralai/mixtral-8x7b'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://octopus-omni.app',
      'X-Title': 'Octopus Omni Cockpit'
    }),
    category: 'llm'
  },
  groq: {
    type: 'groq',
    name: 'Groq',
    description: 'Inferencia ultra rápida con LPU™. Llama 3, Mixtral y más.',
    description_en: 'Ultra-fast inference with LPU™. Llama 3, Mixtral and more.',
    icon: '⚡',
    color: '#F97316',
    baseUrl: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/docs',
    pricingUrl: 'https://console.groq.com/settings/billing',
    features: ['Velocidad extrema', 'Costo bajo', 'API compatible OpenAI', 'Llama 3 optimizado'],
    features_en: ['Extreme speed', 'Low cost', 'OpenAI compatible API', 'Optimized Llama 3'],
    models: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'llm'
  },
  openai: {
    type: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5, DALL-E, Whisper y embeddings.',
    description_en: 'GPT-4, GPT-3.5, DALL-E, Whisper and embeddings.',
    icon: '🧠',
    color: '#10A37F',
    baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://github.com/openai/openai-python',
    pricingUrl: 'https://github.com/openai/openai-python',
    features: ['GPT-4 Turbo', 'Vision', 'Function calling', 'Assistants API'],
    features_en: ['GPT-4 Turbo', 'Vision', 'Function calling', 'Assistants API'],
    models: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'dall-e-3'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'multi'
  },
  anthropic: {
    type: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3 Opus, Sonnet y Haiku. Contexto de 200K tokens.',
    description_en: 'Claude 3 Opus, Sonnet and Haiku. 200K token context.',
    icon: '🧊',
    color: '#D97706',
    baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://docs.anthropic.com',
    pricingUrl: 'https://www.anthropic.com/pricing',
    features: ['200K contexto', 'Visión', 'Seguridad avanzada', 'Razonamiento superior'],
    features_en: ['200K context', 'Vision', 'Advanced safety', 'Superior reasoning'],
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    testEndpoint: '/messages',
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }),
    category: 'llm'
  },
  replicate: {
    type: 'replicate',
    name: 'Replicate',
    description: 'Miles de modelos de ML: imagen, video, audio y más.',
    description_en: 'Thousands of ML models: image, video, audio and more.',
    icon: '🔮',
    color: '#8B5CF6',
    baseUrl: 'https://api.replicate.com/v1',
    docsUrl: 'https://replicate.com/docs',
    pricingUrl: 'https://replicate.com/pricing',
    features: ['SDXL', 'Stable Video', 'Whisper', 'Modelos custom'],
    features_en: ['SDXL', 'Stable Video', 'Whisper', 'Custom models'],
    models: ['stability-ai/sdxl', 'meta/llama-2-70b', 'openai/whisper'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Token ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'multi'
  },
  elevenlabs: {
    type: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Síntesis de voz realista y clonación de voz.',
    description_en: 'Realistic voice synthesis and voice cloning.',
    icon: '🎙️',
    color: '#000000',
    baseUrl: 'https://api.elevenlabs.io/v1',
    docsUrl: 'https://docs.elevenlabs.io',
    pricingUrl: 'https://elevenlabs.io/pricing',
    features: ['Voces realistas', 'Clonación', 'Multi-idioma', 'Emociones'],
    features_en: ['Realistic voices', 'Cloning', 'Multi-language', 'Emotions'],
    testEndpoint: '/voices',
    headers: (apiKey) => ({
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    }),
    category: 'audio'
  },
  stability: {
    type: 'stability',
    name: 'Stability AI',
    description: 'Stable Diffusion, SDXL y Stable Video Diffusion.',
    description_en: 'Stable Diffusion, SDXL and Stable Video Diffusion.',
    icon: '🎨',
    color: '#A855F7',
    baseUrl: 'https://api.stability.ai/v1',
    docsUrl: 'https://platform.stability.ai/docs',
    pricingUrl: 'https://platform.stability.ai/pricing',
    features: ['SDXL 1.0', 'Image-to-image', 'Inpainting', 'Video'],
    features_en: ['SDXL 1.0', 'Image-to-image', 'Inpainting', 'Video'],
    models: ['stable-diffusion-xl-1024-v1-0', 'stable-diffusion-v1-6'],
    testEndpoint: '/engines/list',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'image'
  },
  huggingface: {
    type: 'huggingface',
    name: 'Hugging Face',
    description: 'Inference API para miles de modelos open source.',
    description_en: 'Inference API for thousands of open source models.',
    icon: '🤗',
    color: '#FFD21E',
    baseUrl: 'https://api-inference.huggingface.co',
    docsUrl: 'https://huggingface.co/docs/api-inference',
    pricingUrl: 'https://huggingface.co/pricing',
    features: ['Modelos gratuitos', 'Comunidad enorme', 'Serverless', 'Fine-tuning'],
    features_en: ['Free models', 'Huge community', 'Serverless', 'Fine-tuning'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'multi'
  },
  cohere: {
    type: 'cohere',
    name: 'Cohere',
    description: 'Command, Embed y Rerank para búsqueda y RAG.',
    description_en: 'Command, Embed and Rerank for search and RAG.',
    icon: '🔍',
    color: '#39D98A',
    baseUrl: 'https://api.cohere.ai/v1',
    docsUrl: 'https://docs.cohere.com',
    pricingUrl: 'https://cohere.com/pricing',
    features: ['Command R+', 'Embeddings', 'Reranking', 'RAG optimizado'],
    features_en: ['Command R+', 'Embeddings', 'Reranking', 'Optimized RAG'],
    models: ['command-r-plus', 'command-r', 'embed-english-v3.0'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'llm'
  },
  mistral: {
    type: 'mistral',
    name: 'Mistral AI',
    description: 'Mistral Large, Medium y modelos open source.',
    description_en: 'Mistral Large, Medium and open source models.',
    icon: '🌬️',
    color: '#FF7000',
    baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://docs.mistral.ai',
    pricingUrl: 'https://mistral.ai/pricing',
    features: ['Mistral Large', 'Function calling', 'JSON mode', 'Europeo'],
    features_en: ['Mistral Large', 'Function calling', 'JSON mode', 'European'],
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'llm'
  },
  together: {
    type: 'together',
    name: 'Together AI',
    description: 'Inferencia rápida de modelos open source.',
    description_en: 'Fast inference of open source models.',
    icon: '🤝',
    color: '#0EA5E9',
    baseUrl: 'https://api.together.xyz/v1',
    docsUrl: 'https://docs.together.ai',
    pricingUrl: 'https://together.ai/pricing',
    features: ['Llama 3', 'Mixtral', 'SDXL', 'Fine-tuning'],
    features_en: ['Llama 3', 'Mixtral', 'SDXL', 'Fine-tuning'],
    models: ['meta-llama/Meta-Llama-3-70B-Instruct', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'llm'
  },
  perplexity: {
    type: 'perplexity',
    name: 'Perplexity',
    description: 'Búsqueda con IA y modelos de razonamiento.',
    description_en: 'AI-powered search and reasoning models.',
    icon: '🔭',
    color: '#20B2AA',
    baseUrl: 'https://api.perplexity.ai',
    docsUrl: 'https://docs.perplexity.ai',
    pricingUrl: 'https://docs.perplexity.ai',
    features: ['Búsqueda online', 'Citaciones', 'Sonar Large', 'Tiempo real'],
    features_en: ['Online search', 'Citations', 'Sonar Large', 'Real-time'],
    models: ['sonar-large-online', 'sonar-medium-online', 'sonar-small-online'],
    testEndpoint: '/chat/completions',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'llm'
  },
  falai: {
    type: 'falai',
    name: 'fal.ai',
    description: 'Video IA: Kling, Veo 3.1, Hailuo, Wan, Seedance y más. +1000 modelos.',
    description_en: 'AI Video: Kling, Veo 3.1, Hailuo, Wan, Seedance and more. +1000 models.',
    icon: '🎬',
    color: '#7C3AED',
    baseUrl: 'https://queue.fal.run',
    docsUrl: 'https://fal.ai/docs',
    pricingUrl: 'https://fal.ai/pricing',
    features: ['Veo 3.1 (Google)', 'Sora 2 Pro (OpenAI)', 'Kling 3.0 Pro', 'Seedance 1.5', 'Hailuo 2.3', 'Wan 2.7', 'PixVerse v5.6', 'Audio nativo'],
    features_en: ['Veo 3.1 (Google)', 'Sora 2 Pro (OpenAI)', 'Kling 3.0 Pro', 'Seedance 1.5', 'Hailuo 2.3', 'Wan 2.7', 'PixVerse v5.6', 'Native audio'],
    models: ['veo-3.1', 'sora-2-pro', 'kling-3.0-pro', 'kling-2.6-pro', 'kling-2.5-turbo', 'seedance-1.5', 'hailuo-2.3', 'wan-2.7', 'pixverse-5.6'],
    testEndpoint: '/fal-ai/kling-video/v2.6/pro/text-to-video',
    headers: (apiKey) => ({
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'video'
  },
  content_publisher: {
    type: 'content_publisher',
    name: 'Content Publisher',
    description: 'Publica contenido AI directamente a tu blog/CMS vía API REST.',
    description_en: 'Publish AI content directly to your blog/CMS via REST API.',
    icon: '📡',
    color: '#0EA5E9',
    baseUrl: '',
    docsUrl: 'https://octopuskills.com/docs/content-publisher',
    pricingUrl: '',
    features: ['Publicación automática', 'Multi-CMS compatible', 'Field mapping', 'Logs en tiempo real'],
    features_en: ['Automatic publishing', 'Multi-CMS compatible', 'Field mapping', 'Real-time logs'],
    testEndpoint: '',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'publishing'
  },
  custom: {
    type: 'custom',
    name: 'API Personalizada',
    name_en: 'Custom API',
    description: 'Configura tu propia API compatible con OpenAI.',
    description_en: 'Configure your own OpenAI-compatible API.',
    icon: '⚙️',
    color: '#64748B',
    baseUrl: '',
    docsUrl: '',
    pricingUrl: '',
    features: ['URL personalizada', 'Headers custom', 'Cualquier modelo'],
    features_en: ['Custom URL', 'Custom headers', 'Any model'],
    testEndpoint: '/models',
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }),
    category: 'multi'
  }
}

export const API_CATEGORIES = [
  { id: 'publishing', name: 'Publicación', name_en: 'Publishing', icon: '📡' },
  { id: 'all', name: 'Todos', name_en: 'All', icon: '🌐' },
  { id: 'llm', name: 'Modelos de Lenguaje', name_en: 'Language Models', icon: '🧠' },
  { id: 'image', name: 'Generación de Imágenes', name_en: 'Image Generation', icon: '🎨' },
  { id: 'video', name: 'Video IA', name_en: 'AI Video', icon: '🎬' },
  { id: 'audio', name: 'Audio & Voz', name_en: 'Audio & Voice', icon: '🎙️' },
  { id: 'multi', name: 'Multi-Modal', name_en: 'Multi-Modal', icon: '✨' }
]

// Locale-aware helper functions
export function getLocalizedService(service: ApiServiceConfig, locale: string) {
  const isEn = locale === 'en'
  return {
    ...service,
    name: (isEn && service.name_en) ? service.name_en : service.name,
    description: isEn ? service.description_en : service.description,
    features: isEn ? service.features_en : service.features,
  }
}

export function getLocalizedCategories(locale: string) {
  return API_CATEGORIES.map(cat => ({
    ...cat,
    name: locale === 'en' ? cat.name_en : cat.name,
  }))
}

// Utilidades
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****'
  return apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4)
}

export function getServiceByType(type: ApiServiceType): ApiServiceConfig {
  return API_SERVICE_CONFIGS[type]
}

export function getServicesByCategory(category: string): ApiServiceConfig[] {
  if (category === 'all') {
    return Object.values(API_SERVICE_CONFIGS)
  }
  return Object.values(API_SERVICE_CONFIGS).filter(s => s.category === category)
}
