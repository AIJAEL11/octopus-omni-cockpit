/**
 * OCTOPUS Context Router v1.1 (Fase 3)
 * 
 * Analyzes user message to determine which context sections are relevant.
 * Reduces system prompt from ~40K tokens to ~8-12K by only injecting what matters.
 * 
 * v1.1 changes:
 * - Weighted scoring (current msg x3 vs history x1)
 * - Smarter fallback: no-match → identity only (no bloat)
 * - Confidence based on match strength, not just count
 * - Vibe-aware companion modules
 */

export type ContextModule =
  | 'identity'          // Always included — core personality
  | 'growth_engine'     // Leads, pipeline, campaigns, outreach, inbox
  | 'creative'          // Ad Factory, UGC, Motion Graphics, Creative Studio
  | 'social_bridge'     // LinkedIn publishing, scheduling
  | 'browser_automation' // Browser control, web automation, templates
  | 'google_workspace'  // Gmail, Calendar, Drive, Docs, Sheets
  | 'brazos'            // External connections
  | 'iot'               // Smart home, devices
  | 'sales_agents'      // Sales agent bots
  | 'voice_agents'      // Voice agent bots (TTS/STT)
  | 'calendar'          // Events, scheduling
  | 'invoicing'         // Facturación Express
  | 'projects'          // Project management
  | 'diagnostic'        // System overview, status, report
  | 'subscription'      // Plan, billing
  | 'knowledge_base'    // RAG, documents
  | 'modules_guide'     // General module awareness

interface RouteResult {
  modules: ContextModule[]
  confidence: number
  reasoning: string
}

// Keyword patterns for each module
const MODULE_SIGNALS: Record<ContextModule, RegExp[]> = {
  identity: [], // Always included
  growth_engine: [
    /\b(leads?|prospectos?|prospectar|prospect|pipeline|outreach|campañ[as]?|campaign|email|correo|inbox|follow[\s-]?up|batch|aprobar?|aprueba|enviar?|enví[ao]|convertidos?|respondieron|replied|bounce|nurture|reactivat|prospección|growth|ventas?|cierr[ea]|objecion|crm|cold[\s-]?email|wildverse|blog[\s-]?lead|drip|secuencia|ingest|investiga[r]?\s+(?:este\s+)?lead|es\s+real|verifica[r]?|leg[ií]timo|qui[eé]n\s+es|busca[r]?\s+(?:perfil|empresa|negocio|cliente|contacto)|encontrar\s+(?:perfil|empresa|negocio|cliente|contacto))\b/i,
    /\b(list_leads|create_lead|sync_inbox|batch_outreach|batch_approve|get_stats|get_insights|get_report|activate_campaign|assign_leads|generate_outreach|send_follow_up|campaign_status|update_pending_emails|update_outreach_copy|nurture_status|research_lead)\b/i,
  ],
  creative: [
    /\b(imagen|imag|banner|video|contenido|creativ[oa]|anuncio|ad[\s-]?factory|ugc|motion|graphic|design|dise[ñn]o|logo|marca|brand|visual|asset|story|reel|post|carousel|carrusel|canva|foto|ilustraci[oó]n|infografía|genera[r]?\s+(?:una?\s+)?(?:imagen|foto|video|banner|logo))\b/i,
  ],
  social_bridge: [
    /\b(linkedin|publica|publicar|programa[r]?|social|post|red[\s]?social|redes|facebook|instagram|twitter|tiktok|social[\s-]?bridge|schedule)\b/i,
  ],
  browser_automation: [
    /\b(browser|navegador|puppeteer|automat(?:iz|e)|web\s*automat|publer|scraping|scrape[ar]?|plantilla|template|formulario|form|login\s*(?:en|to|a)|abre\s+(?:la\s+)?(?:p[aá]gina|web|sitio|url)|haz\s+click|rellena|fill|submit|navega|browse|bot\s*web|web\s*bot|skill\s*web|browser\s*auto)\b/i,
  ],
  google_workspace: [
    /\b(google|gmail|calendar|drive|docs?|sheets?|documento|hoja|spreadsheet|archivo|agenda|evento|cita|reuni[oó]n|meeting|email personal)\b/i,
    /\b(env[ií]a[r]?\s+(un\s+)?email|redacta[r]?\s+(un\s+)?email|manda[r]?\s+(un\s+)?correo|escrib[ei][r]?\s+(un\s+)?email|borrador|draft|responde[r]?\s+(el\s+)?email|reply\s+email|compose)\b/i,
  ],
  brazos: [
    /\b(brazos?|conex[ioó]n|conecta|desconecta|telegram|workspace|integra[rcn]?|brazo)\b/i,
  ],
  iot: [
    /\b(luz|luces?|enchufe|dispositivo|iot|hubspace|wiz|smart|inteligente|hogar|encender|apagar|brillo|escena|casa|play\s?room|habitaci[oó]n|sensor|home)\b/i,
  ],
  sales_agents: [
    /\b(sales[\s-]?agent|agente[\s]?de[\s]?venta|captura[r]?[\s]?lead|chatbot|widget|sales\s?bot)\b/i,
  ],
  voice_agents: [
    /\b(voice[\s-]?agent|agente[\s]?de[\s]?voz|voz|tts|stt|speech|habla[r]?|eleven\s?labs|text[\s-]?to[\s-]?speech|reconocimiento[\s]?de[\s]?voz|voice\s?bot|widget[\s]?de[\s]?voz|asistente[\s]?de[\s]?voz)\b/i,
  ],
  calendar: [
    /\b(calendario|agenda|evento|cita|reuni[oó]n|meeting|booking|disponibilidad|horario|slot)\b/i,
  ],
  invoicing: [
    /\b(factura|invoice|cobrar|pagar|recibo|billing|facturaci[oó]n)\b/i,
  ],
  projects: [
    /\b(proyecto|project|carpeta|organizar|client[ea]|portafolio)\b/i,
  ],
  diagnostic: [
    /\b(reporte|report|estado|status|c[oó]mo\s+(?:va|vamos|estoy|anda)|resumen|overview|diagn[oó]stic|estad[ií]stica|m[eé]trica|haber\s+qu[eé]\s+hay|qu[eé]\s+hay|qu[eé]\s+tengo|dashboard|briefing|executive|n[uú]meros|resultados|rendimiento|performance)\b/i,
  ],
  subscription: [
    /\b(plan|suscripci[oó]n|subscription|upgrade|pricing|precio|gratis|free|pro|business|starter|pago)\b/i,
  ],
  knowledge_base: [
    /\b(knowledge|conocimiento|base\s+de\s+datos|rag|documentos?\s+subidos?)\b/i,
  ],
  modules_guide: [
    /\b(c[oó]mo\s+funciona|qu[eé]\s+puedo|por\s+d[oó]nde\s+empiezo|tutorial|ayuda|help|gu[ií]a|m[oó]dulos?|d[oó]nde\s+(?:est[aá]|encuentro|queda)|an[aá]l[ií]zate|introspe[ck]|tu\s+c[oó]digo|ojos\s+internos|auto[\s-]?an[aá]lisis|qu[eé]\s+(?:sabes|puedes)\s+hacer|mu[eé]strame\s+tu)\b/i,
  ],
}

// Some modules often come together
const MODULE_COMPANIONS: Partial<Record<ContextModule, ContextModule[]>> = {
  growth_engine: ['google_workspace'], // Outreach needs Gmail status
  social_bridge: ['creative'],          // Publishing often involves content
  creative: ['projects'],               // Assets belong to projects
  diagnostic: ['growth_engine', 'subscription'], // Reports need metrics
}

/**
 * Analyzes user message and returns which context modules are relevant.
 * Always includes 'identity' as the core personality.
 * 
 * v1.1: Weighted scoring — current message has 3x weight vs history.
 * Smarter fallback — no-match returns identity only (lean prompt).
 */
export function routeContext(message: string, recentHistory: string[] = []): RouteResult {
  const matched: Set<ContextModule> = new Set(['identity'])
  const moduleScores: Partial<Record<ContextModule, number>> = {}

  // Score current message (weight: 3)
  for (const [module, patterns] of Object.entries(MODULE_SIGNALS) as [ContextModule, RegExp[]][]) {
    if (module === 'identity') continue
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        moduleScores[module] = (moduleScores[module] || 0) + 3
        break
      }
    }
  }

  // Score recent history (weight: 1 each, max 3 messages)
  for (const histMsg of recentHistory.slice(-3)) {
    for (const [module, patterns] of Object.entries(MODULE_SIGNALS) as [ContextModule, RegExp[]][]) {
      if (module === 'identity') continue
      for (const pattern of patterns) {
        if (pattern.test(histMsg.toLowerCase())) {
          moduleScores[module] = (moduleScores[module] || 0) + 1
          break
        }
      }
    }
  }

  // Add modules with score >= 1 (any match counts)
  let totalScore = 0
  for (const [module, score] of Object.entries(moduleScores)) {
    if (score >= 1) {
      matched.add(module as ContextModule)
      totalScore += score
    }
  }

  // Add companion modules
  const withCompanions = new Set(matched)
  for (const mod of matched) {
    const companions = MODULE_COMPANIONS[mod]
    if (companions) {
      for (const comp of companions) {
        withCompanions.add(comp)
      }
    }
  }

  // v1.1: Smarter fallback — if nothing matched, just use identity.
  // The LLM can still answer general questions from its training.
  // Only add modules_guide if user explicitly asks for help.
  if (withCompanions.size <= 1) {
    // Check if user is asking what Octopus can do
    if (/\b(qu[eé]\s+puedo|c[oó]mo\s+funciona|ayuda|help|gu[ií]a|tutorial|por\s+d[oó]nde\s+empiezo)\b/i.test(message)) {
      withCompanions.add('modules_guide')
    }
    // Otherwise: identity only → lean prompt, conversational response
  }

  // Confirmations ("dale", "sí", "hazlo", "luz verde") need the conversation context
  const isConfirmation = /^\s*(s[ií]|dale|ok|hazlo|procede|listo|va|claro|adelante|aprueba|env[ií]a(lo)?|m[aá]ndalo|luz\s+verde|dale\s+(env[ií]a|m[aá]ndalo|hazlo)|ok\s+dale|env[ií]alo|perfecto|exacto|eso|as[ií]\s+mismo|dame\s+(el\s+)?ok|dale\s+luz\s+verde)\s*[.!?]*\s*$/i.test(message)
  if (isConfirmation && recentHistory.length > 0) {
    for (const histMsg of recentHistory.slice(-3)) {
      for (const [module, patterns] of Object.entries(MODULE_SIGNALS) as [ContextModule, RegExp[]][]) {
        if (module === 'identity') continue
        for (const pattern of patterns) {
          if (pattern.test(histMsg.toLowerCase())) {
            withCompanions.add(module)
            break
          }
        }
      }
    }
  }

  const modules = Array.from(withCompanions)
  // Confidence: ratio of top module score to max possible (3 from msg + 3 from history)
  const maxModuleScore = Math.max(...Object.values(moduleScores), 0)
  const confidence = totalScore > 0 ? Math.min(maxModuleScore / 6, 1) : 0.2

  return {
    modules,
    confidence,
    reasoning: totalScore > 0
      ? `Detected ${Object.keys(moduleScores).length} module signal(s): ${modules.filter(m => m !== 'identity').join(', ')}`
      : 'No specific module detected — identity only (lean prompt)',
  }
}