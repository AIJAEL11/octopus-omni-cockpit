/**
 * Image Generation Models Catalog
 * Central registry for all image generation models available in the platform.
 * Used by Ad Factory, UGC Factory, and future image gen surfaces.
 *
 * When adding a new model:
 *  1. Add entry here with correct OpenRouter model ID
 *  2. Pick the right kind ('chat-image' or 'image-only') to control request shape
 *  3. Add i18n labels in lib/i18n-context.tsx (es + en)
 */

export type ImageModelCategory = 'default' | 'google' | 'openai' | 'sourceful' | 'flux' | 'bytedance'
export type ImageModelKind = 'chat-image' | 'image-only'
export type ImageModelTier = 'standard' | 'fast' | 'pro' | 'max'

export interface ImageModel {
  /** OpenRouter model ID (or 'default' for RouteLLM) */
  id: string
  /** i18n key for display label */
  labelKey: string
  /** i18n key for short description */
  descKey: string
  /** Does this model require an OpenRouter API key? */
  needsKey: boolean
  /** Category/provider group */
  category: ImageModelCategory
  /** How to structure the API request */
  kind: ImageModelKind
  /** Tier badge for UI (optional) */
  tier?: ImageModelTier
  /** Emoji for quick visual identification */
  emoji: string
  /** Show "NEW" badge */
  isNew?: boolean
  /** Price hint for UI */
  priceHint?: string
  /** Supports aspect_ratio in image_config */
  supportsAspectRatio?: boolean
  /** Supports image_size (resolution) in image_config */
  supportsImageSize?: boolean
}

export const IMAGE_MODELS: ImageModel[] = [
  // ───── Default (free, always available) ─────
  {
    id: 'default',
    labelKey: 'adf.model_default',
    descKey: 'adf.model_default_desc',
    needsKey: false,
    category: 'default',
    kind: 'chat-image',
    emoji: '🤖',
    priceHint: 'free',
  },

  // ───── OpenAI (newest, premium) ─────
  {
    id: 'openai/gpt-5.4-image-2',
    labelKey: 'adf.model_gpt54_image2',
    descKey: 'adf.model_gpt54_image2_desc',
    needsKey: true,
    category: 'openai',
    kind: 'chat-image',
    tier: 'max',
    emoji: '🎯',
    isNew: true,
    priceHint: '$30/M img tokens',
    supportsAspectRatio: true,
    supportsImageSize: true,
  },

  // ───── Google Gemini family (existing) ─────
  {
    id: 'google/gemini-3-pro-image-preview',
    labelKey: 'adf.model_nano_pro',
    descKey: 'adf.model_nano_pro_desc',
    needsKey: true,
    category: 'google',
    kind: 'chat-image',
    tier: 'pro',
    emoji: '🍌',
    priceHint: '$3/M out tokens',
    supportsAspectRatio: true,
    supportsImageSize: true,
  },
  {
    id: 'google/gemini-3.1-flash-image-preview',
    labelKey: 'adf.model_nano2',
    descKey: 'adf.model_nano2_desc',
    needsKey: true,
    category: 'google',
    kind: 'chat-image',
    tier: 'fast',
    emoji: '🍌',
    priceHint: '$0.50/M in',
    supportsAspectRatio: true,
    supportsImageSize: true,
  },
  {
    id: 'google/gemini-2.5-flash-image',
    labelKey: 'adf.model_nano',
    descKey: 'adf.model_nano_desc',
    needsKey: true,
    category: 'google',
    kind: 'chat-image',
    tier: 'standard',
    emoji: '🍌',
    priceHint: 'budget',
    supportsAspectRatio: true,
    supportsImageSize: true,
  },

  // ───── Sourceful Riverflow (text rendering king) ─────
  {
    id: 'sourceful/riverflow-v2-pro',
    labelKey: 'adf.model_riverflow_pro',
    descKey: 'adf.model_riverflow_pro_desc',
    needsKey: true,
    category: 'sourceful',
    kind: 'image-only',
    tier: 'pro',
    emoji: '🌊',
    isNew: true,
    priceHint: '$0.15–$0.33/img',
  },
  {
    id: 'sourceful/riverflow-v2-fast',
    labelKey: 'adf.model_riverflow_fast',
    descKey: 'adf.model_riverflow_fast_desc',
    needsKey: true,
    category: 'sourceful',
    kind: 'image-only',
    tier: 'fast',
    emoji: '🌊',
    isNew: true,
    priceHint: '$0.02–$0.04/img',
  },

  // ───── Black Forest Labs FLUX.2 ─────
  {
    id: 'black-forest-labs/flux.2-max',
    labelKey: 'adf.model_flux2_max',
    descKey: 'adf.model_flux2_max_desc',
    needsKey: true,
    category: 'flux',
    kind: 'image-only',
    tier: 'max',
    emoji: '🔥',
    isNew: true,
    priceHint: '$0.07/MP',
  },
  {
    id: 'black-forest-labs/flux.2-klein-4b',
    labelKey: 'adf.model_flux2_klein',
    descKey: 'adf.model_flux2_klein_desc',
    needsKey: true,
    category: 'flux',
    kind: 'image-only',
    tier: 'fast',
    emoji: '🔥',
    isNew: true,
    priceHint: '$0.014/MP',
  },

  // ───── ByteDance Seedream ─────
  {
    id: 'bytedance-seed/seedream-4.5',
    labelKey: 'adf.model_seedream',
    descKey: 'adf.model_seedream_desc',
    needsKey: true,
    category: 'bytedance',
    kind: 'image-only',
    tier: 'standard',
    emoji: '🌱',
    isNew: true,
    priceHint: '$0.04/img',
  },
]

/** Default selection fallback */
export const DEFAULT_IMAGE_MODEL_ID = 'google/gemini-3-pro-image-preview'

/** Get model metadata by id (returns undefined if not found) */
export function getImageModel(id: string): ImageModel | undefined {
  return IMAGE_MODELS.find(m => m.id === id)
}

/** Group models by category for UI rendering */
export function groupImageModels(): Record<ImageModelCategory, ImageModel[]> {
  const groups: Record<ImageModelCategory, ImageModel[]> = {
    default: [],
    openai: [],
    google: [],
    sourceful: [],
    flux: [],
    bytedance: [],
  }
  for (const m of IMAGE_MODELS) {
    groups[m.category].push(m)
  }
  return groups
}

/** Category display order (OpenAI first since newest/hottest, then Google for quality, then others) */
export const CATEGORY_ORDER: ImageModelCategory[] = [
  'default',
  'openai',
  'google',
  'sourceful',
  'flux',
  'bytedance',
]

export const CATEGORY_LABELS: Record<ImageModelCategory, { labelKey: string; color: string }> = {
  default: { labelKey: 'adf.cat_model_default', color: '#6B7280' },
  openai: { labelKey: 'adf.cat_model_openai', color: '#10A37F' },
  google: { labelKey: 'adf.cat_model_google', color: '#F59E0B' },
  sourceful: { labelKey: 'adf.cat_model_sourceful', color: '#06B6D4' },
  flux: { labelKey: 'adf.cat_model_flux', color: '#EF4444' },
  bytedance: { labelKey: 'adf.cat_model_bytedance', color: '#8B5CF6' },
}

export const TIER_LABELS: Record<ImageModelTier, { labelKey: string; color: string }> = {
  standard: { labelKey: 'adf.tier_standard', color: '#6B7280' },
  fast: { labelKey: 'adf.tier_fast', color: '#3B82F6' },
  pro: { labelKey: 'adf.tier_pro', color: '#F59E0B' },
  max: { labelKey: 'adf.tier_max', color: '#EC4899' },
}
