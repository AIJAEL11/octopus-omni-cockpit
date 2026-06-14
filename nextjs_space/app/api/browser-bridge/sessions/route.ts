import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withDbRetry } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_MODEL = 'llama-3.1-8b-instant' // Fast & cheap for command parsing
const ABACUS_CHAT_URL = 'https://apps.abacus.ai/v1/chat/completions'
const ABACUS_MODEL = 'gpt-5.4-mini' // Fast & reliable for structured output

// ── Decrypt API key (same as api-hub) ──
function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}

// ── Get user's Groq API key ──
async function getGroqKey(userId: string): Promise<string | null> {
  const record = await withDbRetry(() =>
    prisma.apiKey.findFirst({
      where: { userId, serviceType: 'groq' },
      select: { apiKey: true },
    })
  )
  if (!record?.apiKey) return null
  return decryptApiKey(record.apiKey)
}

// ── LLM command parser (Phase 2) ──
const BROWSER_COMMAND_SYSTEM = `You are an expert browser automation agent. You think and act like a real human browsing the web. Convert natural language instructions into precise, resilient browser commands.

AVAILABLE COMMANDS:
- goto: Navigate to URL. Params: { url: string }
- click: Click element. Params: { selector: string, method: "text"|"css" }
- type: Type text into focused/selected field. Params: { text: string, selector: string }
- screenshot: Capture the page. Params: {} or { fullPage: true }
- scroll: Scroll page. Params: { direction: "up"|"down", amount: number }
- wait: Pause execution. Params: { ms: number }
- extract: Extract text. Params: { selector: string }
- keypress: Press a keyboard key. Params: { key: string } — Use "Enter" to submit forms/searches

CORE STRATEGY — Think like a human:
1. NAVIGATE: goto URL → ALWAYS wait 2000-3000ms for page load
2. INTERACT: click field → type text → submit with keypress Enter
3. SUBMIT FORMS: After typing in a search/input field, ALWAYS submit using: { "type": "keypress", "params": { "key": "Enter" } }
   This is THE MOST RELIABLE universal method. Do NOT click submit buttons (their selectors break across sites). Do NOT use evaluate.
4. WAIT FOR RESULTS: After submitting, ALWAYS wait 3000ms before screenshot
5. CAPTURE: screenshot at the end for visual feedback

SEARCH PATTERN (universal for ANY site):
goto → wait 2-3s → click search field → type query → keypress Enter → wait 3s → screenshot

SITE-SPECIFIC SEARCH FIELD SELECTORS:
- Amazon: "#twotabsearchtextbox"
- Google: "textarea[name=q]"
- YouTube: "input[name=search_query]" (NOT "input#search" which is ambiguous)
- Twitter/X: "input[data-testid=SearchBox_Search_Input]"
- LinkedIn: "input.search-global-typeahead__input"
- Generic: "input[type=search]" or "input[name=q]" or "input[name=search]"

RULES:
1. Understand Spanish AND English equally (busca=search, abre=open, navega=goto, foto/captura/pantallazo=screenshot, baja/scroll abajo=scroll down, sube=scroll up, haz clic=click, escribe/teclea=type)
2. ALWAYS wait 2000-3000ms after every goto — pages need time to load, especially SPAs
3. To submit ANY form: ALWAYS use keypress Enter. Do NOT use evaluate for form submission.
4. The keypress command presses a keyboard key (Enter, Escape, Tab, etc). It is the most reliable way to submit forms.
5. ALWAYS end with a screenshot for visual feedback
6. For click on visible text/buttons, ALWAYS use method: "text" with the visible text as selector (e.g. "Sign In", "Historia", "Log In"). Use method: "css" ONLY for input fields and form elements.
7. NEVER use :contains() pseudo-selector — it is NOT valid CSS and will cause errors. Instead use method: "text" for clicking by text content.
8. NEVER use jQuery selectors. Only use standard CSS selectors (IDs, classes, tag names, attributes) for method: "css".
9. If user mentions a website by name, resolve to its URL (google→google.com, youtube→youtube.com, amazon→amazon.com, twitter→x.com)
10. Break complex multi-step tasks into individual atomic commands
11. If current page URL is provided and user doesn't mention navigating elsewhere, work on current page
12. NEVER use the evaluate command. Use keypress for form submission instead
13. For navigation links (e.g. "click on Historia", "click on About"), ALWAYS use method: "text" with just the link text as selector

Examples:
User: "abre google y busca OCTOPUS AI"
{"commands":[{"type":"goto","params":{"url":"https://www.google.com"}},{"type":"wait","params":{"ms":2000}},{"type":"click","params":{"selector":"textarea[name=q]","method":"css"}},{"type":"type","params":{"text":"OCTOPUS AI","selector":"textarea[name=q]"}},{"type":"keypress","params":{"key":"Enter"}},{"type":"wait","params":{"ms":3000}},{"type":"screenshot","params":{}}]}

User: "navega a amazon.com, busca 'laptop gaming' y baja"
{"commands":[{"type":"goto","params":{"url":"https://www.amazon.com"}},{"type":"wait","params":{"ms":2000}},{"type":"click","params":{"selector":"#twotabsearchtextbox","method":"css"}},{"type":"type","params":{"text":"laptop gaming","selector":"#twotabsearchtextbox"}},{"type":"keypress","params":{"key":"Enter"}},{"type":"wait","params":{"ms":3000}},{"type":"scroll","params":{"direction":"down","amount":500}},{"type":"screenshot","params":{}}]}

User: "ve a youtube y busca música lo-fi"
{"commands":[{"type":"goto","params":{"url":"https://www.youtube.com"}},{"type":"wait","params":{"ms":3000}},{"type":"click","params":{"selector":"input[name=search_query]","method":"css"}},{"type":"type","params":{"text":"música lo-fi","selector":"input[name=search_query]"}},{"type":"keypress","params":{"key":"Enter"}},{"type":"wait","params":{"ms":3000}},{"type":"screenshot","params":{}}]}

User: "click on Sign In"
{"commands":[{"type":"click","params":{"selector":"Sign In","method":"text"}},{"type":"wait","params":{"ms":2000}},{"type":"screenshot","params":{}}]}

User: "haz clic en Historia"
{"commands":[{"type":"click","params":{"selector":"Historia","method":"text"}},{"type":"wait","params":{"ms":3000}},{"type":"screenshot","params":{}}]}

User: "scroll down and take a screenshot"
{"commands":[{"type":"scroll","params":{"direction":"down","amount":500}},{"type":"screenshot","params":{}}]}

Respond ONLY with a JSON object: { "commands": [...] }`

async function parseWithLLM(
  task: string,
  currentUrl: string | null,
  userId: string
): Promise<{ type: string; params: Record<string, any> }[]> {
  const userMessage = currentUrl
    ? `Current page: ${currentUrl}\nTask: ${task}`
    : `Task: ${task}`

  // Try Groq first (free & fast)
  const groqKey = await getGroqKey(userId)
  if (groqKey) {
    try {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: BROWSER_COMMAND_SYSTEM },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content?.trim() || ''
        const parsed = extractJSON(content)
        if (parsed && parsed.length > 0) {
          console.log('[Browser AI] Parsed via Groq:', parsed.length, 'commands')
          return parsed
        }
        console.warn('[Browser AI] Groq returned empty/unparseable:', content.slice(0, 200))
      } else {
        const errText = await res.text().catch(() => 'no body')
        console.warn('[Browser AI] Groq HTTP', res.status, errText.slice(0, 300))
      }
    } catch (e: any) {
      console.warn('[Browser AI] Groq exception:', e.message)
    }
  } else {
    console.log('[Browser AI] No Groq key found for user')
  }

  // Fallback: Abacus AI (RouteLLM endpoint)
  const abacusKey = process.env.ABACUSAI_API_KEY
  if (abacusKey) {
    try {
      const res = await fetch(ABACUS_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${abacusKey}`,
        },
        body: JSON.stringify({
          model: ABACUS_MODEL,
          messages: [
            { role: 'system', content: BROWSER_COMMAND_SYSTEM },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const content = data.choices?.[0]?.message?.content?.trim() || ''
        const parsed = extractJSON(content)
        if (parsed && parsed.length > 0) {
          console.log('[Browser AI] Parsed via Abacus:', parsed.length, 'commands')
          return parsed
        }
        console.warn('[Browser AI] Abacus returned empty/unparseable:', content.slice(0, 200))
      } else {
        const errText = await res.text().catch(() => 'no body')
        console.warn('[Browser AI] Abacus HTTP', res.status, errText.slice(0, 300))
      }
    } catch (e: any) {
      console.warn('[Browser AI] Abacus exception:', e.message)
    }
  }

  // Ultimate fallback: regex parser
  console.log('[Browser AI] All LLMs failed, using regex fallback')
  return parseWithRegex(task, currentUrl)
}

function extractJSON(text: string): { type: string; params: Record<string, any> }[] | null {
  try {
    const obj = JSON.parse(text)
    // Handle { "commands": [...] } wrapper
    if (obj && Array.isArray(obj.commands)) return obj.commands
    // Handle direct array
    if (Array.isArray(obj)) return obj
  } catch {}
  // Try to find JSON array in text
  const match = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
  if (match) {
    try {
      const arr = JSON.parse(match[0])
      if (Array.isArray(arr)) return arr
    } catch {}
  }
  // Try to find { "commands": [...] } in text
  const objMatch = text.match(/\{\s*"commands"\s*:\s*\[/)
  if (objMatch) {
    const start = text.indexOf(objMatch[0])
    try {
      const obj = JSON.parse(text.slice(start))
      if (Array.isArray(obj.commands)) return obj.commands
    } catch {}
  }
  return null
}

// ── Regex fallback (Phase 1 parser, kept as safety net) ──
function parseWithRegex(task: string, currentUrl?: string | null) {
  const commands: { type: string; params: Record<string, any> }[] = []
  const lower = task.toLowerCase()

  const urlMatch = task.match(/https?:\/\/[^\s]+/)
  if (urlMatch || lower.includes('go to') || lower.includes('abre') || lower.includes('navega') || lower.includes('open')) {
    const url = urlMatch?.[0] || extractUrlFromText(lower)
    if (url) commands.push({ type: 'goto', params: { url } })
  }

  // Handle "busca/search" patterns — type in search box + evaluate form submit
  const searchMatch = task.match(/(?:busca|buscar|search|search for)\s+['"]?([^'",.]+)['"]?/i)
  if (searchMatch) {
    const query = searchMatch[1].trim()
    // Determine search selector based on target site
    let searchSelector = 'input[type=search], input[name=q], input[name=search]'
    const urlTarget = commands[0]?.params?.url || currentUrl || ''
    if (urlTarget.includes('amazon')) searchSelector = '#twotabsearchtextbox'
    else if (urlTarget.includes('google')) searchSelector = 'textarea[name=q]'
    else if (urlTarget.includes('youtube')) searchSelector = 'input[name=search_query]'
    else if (urlTarget.includes('x.com') || urlTarget.includes('twitter')) searchSelector = 'input[data-testid=SearchBox_Search_Input]'
    else if (urlTarget.includes('linkedin')) searchSelector = 'input.search-global-typeahead__input'
    // Always wait after goto before interacting
    if (commands.length > 0 && commands[commands.length - 1]?.type === 'goto') {
      commands.push({ type: 'wait', params: { ms: 2500 } })
    }
    commands.push({ type: 'click', params: { selector: searchSelector, method: 'css' } })
    commands.push({ type: 'type', params: { text: query, selector: searchSelector } })
    // Universal submit: keypress Enter (works on ALL sites)
    commands.push({ type: 'keypress', params: { key: 'Enter' } })
    commands.push({ type: 'wait', params: { ms: 3000 } })
  }

  if (lower.includes('screenshot') || lower.includes('captura') || lower.includes('foto') || lower.includes('pantallazo')) {
    commands.push({ type: 'screenshot', params: {} })
  }

  const clickMatch = lower.match(/(?:click|clic|press|presiona|haz clic)(?:\s+(?:on|en))?\s+["']([^"']+)["']/)
  if (clickMatch) {
    commands.push({ type: 'click', params: { selector: clickMatch[1], method: 'text' } })
  }

  const typeMatch = lower.match(/(?:type|escribe|write|teclea)\s+["']([^"']+)["'](?:\s+(?:in|en)\s+["']([^"']+)["'])?/)
  if (typeMatch) {
    commands.push({ type: 'type', params: { text: typeMatch[1], selector: typeMatch[2] || 'input:focus' } })
  }

  if (lower.includes('scroll down') || lower.includes('baja') || lower.includes('scroll abajo')) {
    commands.push({ type: 'scroll', params: { direction: 'down', amount: 500 } })
  }
  if (lower.includes('scroll up') || lower.includes('sube') || lower.includes('scroll arriba')) {
    commands.push({ type: 'scroll', params: { direction: 'up', amount: 500 } })
  }

  if (lower.includes('espera') || lower.includes('wait')) {
    const secs = lower.match(/(\d+)\s*(?:seg|sec|s)/)
    commands.push({ type: 'wait', params: { ms: secs ? parseInt(secs[1]) * 1000 : 2000 } })
  }

  if (commands.length === 0) {
    commands.push({ type: 'screenshot', params: { note: task } })
  }

  if (commands.length > 0 && commands[commands.length - 1].type !== 'screenshot') {
    commands.push({ type: 'screenshot', params: {} })
  }

  return commands
}

function extractUrlFromText(text: string): string | null {
  const sites: Record<string, string> = {
    google: 'https://www.google.com',
    twitter: 'https://twitter.com',
    x: 'https://x.com',
    instagram: 'https://www.instagram.com',
    facebook: 'https://www.facebook.com',
    linkedin: 'https://www.linkedin.com',
    publer: 'https://app.publer.io',
    hubspot: 'https://app.hubspot.com',
    youtube: 'https://www.youtube.com',
    github: 'https://github.com',
    tiktok: 'https://www.tiktok.com',
    reddit: 'https://www.reddit.com',
    amazon: 'https://www.amazon.com',
    canva: 'https://www.canva.com',
    chatgpt: 'https://chat.openai.com',
    citablehub: 'https://citablehub.com',
  }
  for (const [name, url] of Object.entries(sites)) {
    if (text.includes(name)) return url
  }
  return null
}

// ══════════════════════════════════════════════════════════════
// GET — List sessions for current user
// ══════════════════════════════════════════════════════════════
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sessions = await prisma.browserSession.findMany({
      where: { userId: session.user.id },
      include: {
        _count: { select: { commands: true } },
        commands: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, type: true, status: true, createdAt: true, screenshotUrl: true, result: true, error: true, duration: true, params: true, completedAt: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Browser sessions GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ══════════════════════════════════════════════════════════════
// POST — Create session, send command, AI task
// ══════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === 'create_session') {
      const { name } = body
      const browserSession = await prisma.browserSession.create({
        data: {
          userId: session.user.id,
          name: name || 'New Session',
          status: 'idle',
        },
      })
      return NextResponse.json({ session: browserSession })
    }

    if (action === 'send_command') {
      const { sessionId, type, params, tabId } = body

      const browserSession = await prisma.browserSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
      })
      if (!browserSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      const command = await prisma.browserCommand.create({
        data: {
          userId: session.user.id,
          sessionId,
          type,
          params: params || {},
          tabId: tabId || null,
          status: 'pending',
        },
      })

      if (browserSession.status === 'idle') {
        await prisma.browserSession.update({
          where: { id: sessionId },
          data: { status: 'running' },
        })
      }

      return NextResponse.json({ command })
    }

    if (action === 'delete_session') {
      const { sessionId } = body
      await prisma.browserSession.delete({
        where: { id: sessionId, userId: session.user.id },
      })
      return NextResponse.json({ ok: true })
    }

    if (action === 'ai_task') {
      const { sessionId, task } = body

      const browserSession = await prisma.browserSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
      })
      if (!browserSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      // Phase 2: LLM-powered command parsing with Groq/Abacus fallback
      const commands = await parseWithLLM(task, browserSession.currentUrl || null, session.user.id)

      const created: any[] = []
      for (const cmd of commands) {
        const c = await prisma.browserCommand.create({
          data: {
            userId: session.user.id,
            sessionId,
            type: cmd.type,
            params: cmd.params,
            status: 'pending',
          },
        })
        created.push(c)
      }

      if (browserSession.status === 'idle') {
        await prisma.browserSession.update({
          where: { id: sessionId },
          data: { status: 'running' },
        })
      }

      return NextResponse.json({
        commands: created,
        parsed: commands.length,
        engine: 'ai',
        task,
      })
    }

    // ── RUN TEMPLATE ──
    if (action === 'run_template') {
      const { sessionId, templateId, variables } = body
      if (!sessionId || !templateId) {
        return NextResponse.json({ error: 'sessionId and templateId required' }, { status: 400 })
      }

      const template = await prisma.browserTemplate.findFirst({
        where: { id: templateId, userId: session.user.id },
      })
      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const steps = template.steps as Array<{ type: string; [k: string]: any }>
      const vars = (variables || {}) as Record<string, string>

      // Resolve {{var}} placeholders in string values
      const resolveVars = (val: any): any => {
        if (typeof val === 'string') {
          return val.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
        }
        if (Array.isArray(val)) return val.map(resolveVars)
        if (val && typeof val === 'object') {
          return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, resolveVars(v)]))
        }
        return val
      }

      const resolvedSteps = steps.map(resolveVars)

      // Create commands for each step
      const commands = await Promise.all(
        resolvedSteps.map((step: any, idx: number) =>
          prisma.browserCommand.create({
            data: {
              userId: session.user.id,
              sessionId,
              type: step.type || 'navigate',
              params: (step.params || step) as any,
              status: 'pending',
            },
          })
        )
      )

      // Update template usage stats
      await prisma.browserTemplate.update({
        where: { id: templateId },
        data: { lastUsed: new Date(), useCount: { increment: 1 } },
      })

      return NextResponse.json({ commands, templateName: template.name })
    }

    // ── START RECORDING ──
    if (action === 'start_recording') {
      const { sessionId } = body
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

      const browserSession = await prisma.browserSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
      })
      if (!browserSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      // Send start_recording command to Bridge
      const command = await prisma.browserCommand.create({
        data: {
          userId: session.user.id,
          sessionId,
          type: 'start_recording',
          params: { sessionId },
          status: 'pending',
        },
      })

      return NextResponse.json({ command, recording: true })
    }

    // ── STOP RECORDING ──
    if (action === 'stop_recording') {
      const { sessionId } = body
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

      const browserSession = await prisma.browserSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
      })
      if (!browserSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      // Send stop_recording command to Bridge
      const command = await prisma.browserCommand.create({
        data: {
          userId: session.user.id,
          sessionId,
          type: 'stop_recording',
          params: {},
          status: 'pending',
        },
      })

      return NextResponse.json({ command, recording: false })
    }

    // ── GET RECORDING (from session metadata) ──
    if (action === 'get_recording') {
      const { sessionId } = body
      if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 })

      const browserSession = await prisma.browserSession.findFirst({
        where: { id: sessionId, userId: session.user.id },
        select: { metadata: true },
      })
      if (!browserSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

      const meta = browserSession.metadata as Record<string, any> | null
      return NextResponse.json({ recording: meta?.recording || [], recordedAt: meta?.recordedAt || null })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Browser sessions POST error:', error?.message || error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}