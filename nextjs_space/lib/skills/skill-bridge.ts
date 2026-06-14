// ═══════════════════════════════════════════════════════════════════════════════
// 🌉 SKILL BRIDGE — Connects Code Engine ↔ Skill Factory
// Phase A: Skill awareness + invoke_skill action execution
// ═══════════════════════════════════════════════════════════════════════════════

import { getActiveSkills, type SkillInfo } from './index'
import { prisma, withDbRetry } from '@/lib/prisma'
import {
  searchImages,
  getProjectImages,
  type ImageSearchResult,
} from './image-skill'
import {
  detectGameType,
  generateGameConfig,
  MASTER_GAME_PROMPT,
  GAME_TEMPLATES,
} from './game-skill'
import { analyzeCode } from './code-refiner'

// ── Types ──

export interface SkillInvocation {
  skillId: string
  method: string
  params: Record<string, unknown>
}

export interface SkillResult {
  success: boolean
  skillId: string
  method: string
  data?: unknown
  error?: string
  duration: number // ms
}

// ── Build skill context for Code Engine system prompt ──

export function buildSkillContext(): string {
  // Filter out web-vision — it's auto-detected server-side, not manually invocable
  const skills = getActiveSkills().filter(s => s.id !== 'web-vision')
  if (skills.length === 0) return ''

  const skillBlocks = skills.map(s => formatSkillForPrompt(s)).join('\n\n')

  return `
═══════════════════════════════════════════════════════════════════════════════
§4.5 — SKILL SYSTEM + IMAGE INJECTION
═══════════════════════════════════════════════════════════════════════════════

⚠️ RULE #1: You MUST ALWAYS generate write_file actions. Skills NEVER replace file generation.

AVAILABLE SKILLS (active in the background):
${skillBlocks}

🖼️ AUTO-IMAGE INJECTION:
When the user requests a visual project (landing, web, tienda, etc.), the system automatically
injects an [IMAGE_CONTEXT] block with curated Unsplash URLs into your context.

IF [IMAGE_CONTEXT] IS PRESENT IN YOUR CONTEXT:
- You MUST use those real Unsplash URLs in your HTML <img src="..."> tags.
- DO NOT use placeholder.com, picsum.photos, lorempixel, or via.placeholder.com.
- Pick the most appropriate URL from each section (hero, features, testimonials).
- Example: <img src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800" alt="Café de especialidad">

IF [IMAGE_CONTEXT] IS NOT PRESENT:
- Use CSS gradients, emojis, or Unsplash URLs from your own knowledge.
- Or use generate_image for AI-generated images.

OPTIONAL invoke_skill (advanced — rarely needed):
{ "type": "invoke_skill", "skillId": "<id>", "method": "<method>", "params": { ... } }
- ALWAYS emit write_file actions in the SAME response. Never invoke_skill alone.
`
}

function formatSkillForPrompt(skill: SkillInfo): string {
  const methods = getSkillMethods(skill.id)
  return `• ${skill.name} [id: "${skill.id}"]
  ${skill.description}
  Capabilities: ${skill.capabilities.join(', ')}
  Methods:
${methods.map(m => `    - ${m.name}(${m.params}) → ${m.returns}`).join('\n')}`
}

interface MethodInfo {
  name: string
  params: string
  returns: string
}

function getSkillMethods(skillId: string): MethodInfo[] {
  switch (skillId) {
    case 'image-skill':
      return [
        { name: 'searchImages', params: '{ query: string, count?: number }', returns: 'ImageSearchResult[] (url, thumbnailUrl, alt)' },
        { name: 'getProjectImages', params: '{ projectType: string, projectName: string, sections: string[] }', returns: 'Record<section, ImageSearchResult[]>' },
      ]
    case 'game-skill':
      return [
        { name: 'detectGameType', params: '{ description: string }', returns: 'GameType | null (snake, pong, tetris, breakout, flappy, memory, puzzle, platformer)' },
        { name: 'generateGameConfig', params: '{ type: GameType, name: string, colors?: { primary, secondary, background, accent } }', returns: 'GameConfig (type, name, width, height, colors, difficulty)' },
        { name: 'getGameTemplate', params: '{ type: GameType }', returns: 'Template config (canvas size, speed, colors, features)' },
        { name: 'getMasterPrompt', params: '{}', returns: 'Full game development system prompt for Canvas 2D games' },
      ]
    case 'code-refiner':
      return [
        { name: 'analyze', params: '{ files: Array<{ path: string, content: string }> }', returns: 'RefinerResult { issues[], score: 0-100, summary }' },
      ]
    case 'lead-to-asset':
      return [
        { name: 'getStatus', params: '{ processId: string }', returns: 'Process status and progress' },
      ]
    default:
      return []
  }
}

// ── Skill Memory: persist execution to DB ──

export async function persistSkillExecution(opts: {
  userId: string
  skillId: string
  method: string
  params?: Record<string, unknown>
  success: boolean
  duration: number
  resultSize?: number
  error?: string
  category?: string
  sessionId?: string
  trigger?: 'auto' | 'manual' | 'refine'
}): Promise<void> {
  try {
    await withDbRetry(() =>
      prisma.skillExecution.create({
        data: {
          userId: opts.userId,
          skillId: opts.skillId,
          method: opts.method,
          params: opts.params ? JSON.stringify(opts.params) : null,
          success: opts.success,
          duration: opts.duration,
          resultSize: opts.resultSize ?? null,
          error: opts.error ?? null,
          category: opts.category ?? null,
          sessionId: opts.sessionId ?? null,
          trigger: opts.trigger ?? 'manual',
        },
      })
    )
  } catch (err) {
    // Non-critical — never block skill execution for memory persistence
    console.error('[SkillMemory] Failed to persist execution:', err)
  }
}

// ── Execute a skill invocation ──

export async function executeSkill(invocation: SkillInvocation, userId?: string, sessionId?: string): Promise<SkillResult> {
  const start = Date.now()
  const { skillId, method, params } = invocation

  try {
    const data = await dispatchSkill(skillId, method, params)
    const result: SkillResult = {
      success: true,
      skillId,
      method,
      data,
      duration: Date.now() - start,
    }

    // Phase B: Persist to Skill Memory
    if (userId) {
      const resultSize = data ? JSON.stringify(data).length : 0
      persistSkillExecution({
        userId,
        skillId,
        method,
        params,
        success: true,
        duration: result.duration,
        resultSize,
        sessionId,
        trigger: 'manual',
      }).catch(() => {}) // fire-and-forget
    }

    return result
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[SkillBridge] Error executing ${skillId}.${method}:`, errorMsg)

    // Phase B: Persist failure
    if (userId) {
      persistSkillExecution({
        userId,
        skillId,
        method,
        params,
        success: false,
        duration: Date.now() - start,
        error: errorMsg,
        sessionId,
        trigger: 'manual',
      }).catch(() => {})
    }

    return {
      success: false,
      skillId,
      method,
      error: errorMsg,
      duration: Date.now() - start,
    }
  }
}

async function dispatchSkill(
  skillId: string,
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (skillId) {
    case 'image-skill':
      return dispatchImageSkill(method, params)
    case 'game-skill':
      return dispatchGameSkill(method, params)
    case 'code-refiner':
      return dispatchCodeRefiner(method, params)
    case 'lead-to-asset':
      return dispatchLeadToAsset(method, params)
    case 'web-vision':
      return dispatchWebVision(method, params)
    default:
      throw new Error(`Unknown skill: ${skillId}`)
  }
}

async function dispatchImageSkill(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    case 'searchImages':
      return searchImages({
        query: (params.query as string) || '',
        count: (params.count as number) || 5,
        orientation: params.orientation as 'landscape' | 'portrait' | 'square' | undefined,
        style: params.style as 'photo' | 'illustration' | 'minimal' | undefined,
      })
    case 'getProjectImages':
      return getProjectImages(
        (params.projectType as string) || '',
        (params.projectName as string) || '',
        (params.sections as string[]) || [],
      )
    default:
      throw new Error(`Unknown image-skill method: ${method}`)
  }
}

async function dispatchGameSkill(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    case 'detectGameType':
      return detectGameType((params.description as string) || '')
    case 'generateGameConfig': {
      const gameType = (params.type as string) || 'snake'
      const name = (params.name as string) || 'Game'
      const colors = params.colors as Record<string, string> | undefined
      return generateGameConfig(
        gameType as Parameters<typeof generateGameConfig>[0],
        name,
        colors,
      )
    }
    case 'getGameTemplate': {
      const type = (params.type as string) || ''
      const template = GAME_TEMPLATES[type as keyof typeof GAME_TEMPLATES]
      if (!template) throw new Error(`No template for game type: ${type}`)
      return template
    }
    case 'getMasterPrompt':
      return { prompt: MASTER_GAME_PROMPT.substring(0, 500) + '...[truncated for context]' }
    default:
      throw new Error(`Unknown game-skill method: ${method}`)
  }
}

async function dispatchCodeRefiner(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  switch (method) {
    case 'analyze': {
      const files = (params.files as Array<{ path: string; content: string }>) || []
      if (files.length === 0) throw new Error('No files provided for analysis')
      return analyzeCode(files)
    }
    default:
      throw new Error(`Unknown code-refiner method: ${method}`)
  }
}

async function dispatchLeadToAsset(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  // Lazy import to avoid circular deps
  const { getProcessStatus } = await import('./lead-to-asset-service')
  switch (method) {
    case 'getStatus':
      return getProcessStatus(
        (params.processId as string) || '',
        (params.userId as string) || 'system',
      )
    default:
      throw new Error(`Unknown lead-to-asset method: ${method}`)
  }
}

async function dispatchWebVision(
  method: string,
  params: Record<string, unknown>
): Promise<unknown> {
  const { captureScreenshots, analyzeDesign, formatDesignReference } = await import('./web-vision')
  switch (method) {
    case 'analyzeUrl': {
      const url = (params.url as string) || ''
      if (!url) throw new Error('URL is required for web-vision analyzeUrl')
      const screenshots = await captureScreenshots(url)
      const analysis = await analyzeDesign(screenshots, url, (params.userId as string) || 'system')
      return { analysis, contextBlock: formatDesignReference(analysis) }
    }
    default:
      throw new Error(`Unknown web-vision method: ${method}`)
  }
}

// ── Auto-Invoke: Server-side Image Skill before LLM call ──
// Detects if user message needs images and injects curated URLs into context

const VISUAL_PROJECT_KEYWORDS = [
  // Project types that need images
  'landing', 'página', 'pagina', 'web', 'sitio', 'website', 'portfolio', 'portafolio',
  'tienda', 'shop', 'store', 'ecommerce',
  // Industries
  'café', 'cafe', 'cafetería', 'cafeteria', 'coffee',
  'restaurante', 'restaurant', 'comida', 'food', 'gastronomía',
  'gym', 'fitness', 'deporte', 'yoga', 'entrenamiento',
  'inmobiliaria', 'real estate', 'vivienda', 'apartamento',
  'viaje', 'travel', 'turismo', 'hotel',
  'moda', 'fashion', 'ropa', 'boutique',
  'tech', 'startup', 'saas', 'app',
  'agencia', 'agency', 'estudio', 'studio',
  'clínica', 'clinic', 'dentista', 'spa', 'salón', 'salon',
  'blog', 'magazine', 'revista',
]

// Skip image injection for these project types
const NON_VISUAL_KEYWORDS = [
  'juego', 'game', 'snake', 'pong', 'tetris', 'breakout',
  'script', 'api', 'backend', 'cli', 'terminal', 'calculadora', 'calculator',
]

export interface AutoImageContext {
  detected: boolean
  category: string
  imageUrls: Record<string, string[]> // section → urls
  contextBlock: string // Formatted for LLM injection
}

export async function autoInvokeImageSkill(
  userMessage: string,
  userId?: string,
  sessionId?: string,
): Promise<AutoImageContext> {
  const msg = userMessage.toLowerCase()
  const start = Date.now()
  
  // Skip if it's a game or non-visual project
  if (NON_VISUAL_KEYWORDS.some(kw => msg.includes(kw))) {
    return { detected: false, category: '', imageUrls: {}, contextBlock: '' }
  }
  
  // Check if it's a visual project
  const isVisual = VISUAL_PROJECT_KEYWORDS.some(kw => msg.includes(kw))
  if (!isVisual) {
    return { detected: false, category: '', imageUrls: {}, contextBlock: '' }
  }
  
  console.log(`[SkillBridge:AutoImage] Visual project detected, fetching images...`)
  
  try {
    // Determine sections based on what a landing/web typically needs
    const sections = ['hero-cinematic', 'features', 'testimonials-carousel']
    
    // Extract a project name from the message (best effort)
    const projectName = extractProjectName(msg)
    const projectType = extractProjectType(msg)
    
    const imagesBySection = await getProjectImages(projectType, projectName, sections)
    
    // Also get hero-specific images matching the exact query
    const heroImages = await searchImages({ query: userMessage, count: 4 })
    if (heroImages.length > 0) {
      imagesBySection.hero_specific = heroImages
    }
    
    // Format for LLM
    const urlMap: Record<string, string[]> = {}
    for (const [section, images] of Object.entries(imagesBySection)) {
      urlMap[section] = (images as ImageSearchResult[]).map(img => img.url)
    }
    
    const totalImages = Object.values(urlMap).flat().length
    const duration = Date.now() - start
    console.log(`[SkillBridge:AutoImage] Found ${totalImages} images across ${Object.keys(urlMap).length} sections (${duration}ms)`)
    
    // Phase B: Persist auto-invoke to Skill Memory
    if (userId) {
      persistSkillExecution({
        userId,
        skillId: 'image-skill',
        method: 'autoInvoke',
        params: { projectType, projectName, sections },
        success: true,
        duration,
        resultSize: totalImages,
        category: projectType,
        sessionId,
        trigger: 'auto',
      }).catch(() => {})
    }
    
    const contextBlock = formatImageContext(urlMap, projectName, projectType)
    
    return {
      detected: true,
      category: projectType,
      imageUrls: urlMap,
      contextBlock,
    }
  } catch (err) {
    const duration = Date.now() - start
    console.error('[SkillBridge:AutoImage] Error:', err)
    
    // Phase B: Persist failure
    if (userId) {
      persistSkillExecution({
        userId,
        skillId: 'image-skill',
        method: 'autoInvoke',
        params: { message: userMessage.substring(0, 200) },
        success: false,
        duration,
        error: err instanceof Error ? err.message : String(err),
        trigger: 'auto',
      }).catch(() => {})
    }
    
    return { detected: false, category: '', imageUrls: {}, contextBlock: '' }
  }
}

function extractProjectName(msg: string): string {
  // Try to extract the subject of the project from common patterns
  // "landing para una cafetería premium" → "cafetería premium"
  // "web de restaurante italiano" → "restaurante italiano"
  const patterns = [
    /(?:para|de|sobre)\s+(?:un[ao]?\s+)?(.+?)(?:\s*$|\s*con\s)/i,
    /(?:crea|genera|haz|diseña|build|create)\s+(?:un[ao]?\s+)?(?:landing|web|sitio|página|page|tienda)\s+(?:de\s+|para\s+)?(.+?)$/i,
  ]
  for (const p of patterns) {
    const match = msg.match(p)
    if (match?.[1]) return match[1].trim().substring(0, 50)
  }
  return msg.substring(0, 50)
}

function extractProjectType(msg: string): string {
  if (msg.includes('café') || msg.includes('cafe') || msg.includes('cafetería') || msg.includes('coffee')) return 'coffee'
  if (msg.includes('restaurante') || msg.includes('restaurant')) return 'restaurant'
  if (msg.includes('tienda') || msg.includes('shop') || msg.includes('ecommerce')) return 'ecommerce'
  if (msg.includes('gym') || msg.includes('fitness')) return 'fitness'
  if (msg.includes('inmobiliaria') || msg.includes('real estate') || msg.includes('propiedad') || msg.includes('bienes raíces') || msg.includes('bienes raices') || msg.includes('penthouse') || msg.includes('villa') || msg.includes('mansión') || msg.includes('mansion') || msg.includes('residencia') || msg.includes('lujo') || msg.includes('luxury')) return 'realestate'
  if (msg.includes('viaje') || msg.includes('travel')) return 'travel'
  if (msg.includes('moda') || msg.includes('fashion')) return 'fashion'
  if (msg.includes('tech') || msg.includes('startup') || msg.includes('saas')) return 'technology'
  if (msg.includes('arte') || msg.includes('art') || msg.includes('galería') || msg.includes('gallery')) return 'art'
  if (msg.includes('comida') || msg.includes('food')) return 'food'
  return 'landing'
}

function formatImageContext(
  urlMap: Record<string, string[]>,
  projectName: string,
  projectType: string,
): string {
  const lines = [
    `\n[IMAGE_CONTEXT — Auto-injected by Image Skill]`,
    `Project: "${projectName}" (${projectType})`,
    `USE THESE REAL UNSPLASH URLS in your HTML <img> tags instead of placeholder images.`,
    `DO NOT use placeholder.com, picsum.photos, or via.placeholder.com — use these actual URLs:`,
    ``,
  ]
  
  for (const [section, urls] of Object.entries(urlMap)) {
    lines.push(`📸 ${section.toUpperCase()}:`)
    urls.forEach((url, i) => lines.push(`  [${i + 1}] ${url}`))
    lines.push('')
  }
  
  lines.push(`INSTRUCTIONS: Pick the best URLs for each section of your HTML.`)
  lines.push(`For hero sections, use the hero_specific or hero URLs.`)
  lines.push(`For team/testimonial photos, use the testimonials URLs.`)
  lines.push(`For feature illustrations, use CSS icons/emojis or features URLs.`)
  lines.push(`[/IMAGE_CONTEXT]`)
  
  return lines.join('\n')
}

// ── Format skill results for Nervous System injection ──

export function formatSkillFeedback(results: SkillResult[]): string {
  if (results.length === 0) return ''

  const blocks = results.map(r => {
    if (r.success) {
      const dataStr = typeof r.data === 'string'
        ? r.data
        : JSON.stringify(r.data, null, 2)
      // Truncate large payloads to keep context manageable
      const truncated = dataStr.length > 2000
        ? dataStr.substring(0, 2000) + `\n... [truncated ${dataStr.length - 2000} chars]`
        : dataStr
      return `✅ ${r.skillId}.${r.method} (${r.duration}ms):\n${truncated}`
    } else {
      return `❌ ${r.skillId}.${r.method} FAILED (${r.duration}ms): ${r.error}`
    }
  })

  return `\n[SKILL_FEEDBACK]\n${blocks.join('\n\n')}\n[/SKILL_FEEDBACK]`
}

// ── Parse invoke_skill from action payloads ──

interface ActionWithFields {
  action: string
  skillId?: string
  skill_id?: string
  method?: string
  params?: Record<string, unknown>
}

export function extractSkillInvocations<T extends { action: ActionWithFields }>(
  actions: T[]
): { skillActions: SkillInvocation[]; otherActions: T[] } {
  const skillActions: SkillInvocation[] = []
  const otherActions: T[] = []

  for (const a of actions) {
    if (a.action.action === 'invoke_skill') {
      skillActions.push({
        skillId: a.action.skillId || a.action.skill_id || '',
        method: a.action.method || '',
        params: a.action.params || {},
      })
    } else {
      otherActions.push(a)
    }
  }

  return { skillActions, otherActions }
}
