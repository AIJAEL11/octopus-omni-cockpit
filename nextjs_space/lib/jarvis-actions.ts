// JARVIS Actions - Sistema de Intenciones Avanzado estilo DeepAgent

export type ActionType = 
  | 'create_skill' | 'create_agent' | 'create_mcp' | 'create_project'
  | 'navigate' | 'report' | 'analyze' | 'search'
  | 'connect' | 'disconnect' | 'configure'
  | 'generate_image' | 'generate_video' | 'generate_code'
  | 'create_media'     // 🎨 Generar imagen/video via Creative API
  | 'explain' | 'help' | 'list' | 'status'
  | 'execute' | 'test' | 'deploy' | 'export'
  | 'modify' | 'delete' | 'duplicate'
  | 'schedule' | 'automate' | 'integrate'
  | 'confirm' | 'cancel' | 'undo'
  | 'delegate_agent'   // 🤖🔀 Delegar tarea a un agente existente
  | 'tool_created'     // ✅ Herramienta ya creada server-side (skill/agent/mcp) — solo refrescar UI
  | 'introspect'       // 👁️ OJOS INTERNOS - leer código del sistema
  | 'google_workspace' // 🔵 Google Workspace: Calendar, Drive, Docs, Sheets, Gmail
  | 'growth_engine'    // 🚀 Growth Engine: CRM, Leads, Outreach, Inbox, Campañas, Reportes
  | 'brazos'           // 🦾 Brazos: health check, troubleshoot
  | 'content_publish'   // 📡 Content Publisher: publicar contenido a blog/CMS
  | 'iot'              // 🏠 IoT: control devices, scenes, status
  | 'social_bridge'    // 📡 Social Bridge: publish/schedule LinkedIn
  | 'sales_agent'      // 🤖 Sales Agent: create, list, edit
  | 'voice_agent'      // 🎙️ Voice Agent: create, list, configure
  | 'ugc_generate'     // 🎬 UGC Factory: generate video
  | 'web_search'       // 🔍 Web search
  | 'theme_toggle'     // 🌙 Toggle dark/light mode
  | 'browser_automation' // 🌐 Browser Automation: navigate, click, type, run templates
  | 'none'

// [Fase 2] IntentCategory, DetectedIntent, detectIntent(), INTENT_PATTERNS removed
// Intent detection is now handled by the LLM via native function calling (tools)

export interface JarvisAction {
  type: ActionType
  data?: {
    // Para skills
    skillName?: string
    skillDescription?: string
    skillCategory?: string
    skillCode?: string
    // Para agents
    agentName?: string
    agentDescription?: string
    agentCategory?: string
    agentPrompt?: string
    agentModel?: string
    // Para MCPs
    mcpName?: string
    mcpDescription?: string
    mcpEndpoint?: string
    mcpCapabilities?: string[]
    // Tool created (server-side)
    toolType?: 'skill' | 'agent' | 'mcp'
    id?: string
    name?: string
    location?: string
    // Navegación
    route?: string
    pageName?: string
    // Media
    imagePrompt?: string
    videoPrompt?: string
    // Proyecto
    projectName?: string
    projectDescription?: string
    projectType?: string
    // Google Workspace
    googleService?: 'calendar' | 'drive' | 'docs' | 'sheets' | 'gmail'
    googleAction?: string
    googleParams?: Record<string, unknown>
    // Growth Engine
    growthAction?: string  // list_leads, create_lead, generate_outreach, approve_action, sync_inbox, etc.
    growthParams?: Record<string, unknown>
    // Brazos
    brazosAction?: string
    armType?: string
    // IoT
    iotAction?: string  // on, off, toggle, brightness, colorTemp, status, all_off, scene
    deviceName?: string
    roomName?: string
    iotParams?: Record<string, unknown>
    // Social Bridge
    socialAction?: string  // publish_linkedin, schedule_linkedin, status
    content?: string
    scheduledFor?: string
    mediaUrl?: string
    // Sales Agent
    salesAction?: string  // create, list, edit, delete
    salesParams?: Record<string, unknown>
    agentId?: string
    agentData?: Record<string, unknown>
    // Voice Agent
    voiceAction?: string  // create, list, configure
    // Content Publisher
    slug?: string
    contentType?: string
    metadata?: Record<string, unknown>
    // Browser Automation
    browserAction?: string  // create_session, send_command, run_template, create_template, ai_task, list_templates, status
    browserSessionId?: string
    browserTemplateId?: string
    browserSteps?: Array<Record<string, unknown>>
    browserVariables?: Record<string, string>
    browserCommand?: string  // natural language command for ai_task
    templateName?: string
    templateDescription?: string
    templateCategory?: string
    // UGC Factory
    ugcAction?: string
    ugcTopic?: string
    ugcStyle?: string
    ugcLanguage?: string
    ugcDuration?: number
    ugcParams?: Record<string, unknown>
    script?: string
    // Schedule / Calendar
    title?: string
    date?: string
    time?: string
    calendarAction?: string
    eventDescription?: string
    // Web Search
    query?: string
    // Theme Toggle
    theme?: 'dark' | 'light' | 'toggle'
    // Create Media (image/video)
    media?: Record<string, unknown>
    // Delegación de agentes
    task?: string
    // General
    target?: string
    parameters?: Record<string, unknown>
  }
  message: string
}

// [Fase 2] ROUTE_MAPPINGS removed — navigation is now handled via tools (system_navigate)


function parseSingleActionBlock(actionJson: string, fullResponse: string): JarvisAction | null {
  try {
    const actionData = JSON.parse(actionJson.trim())
    const cleanMessage = fullResponse.replace(/```jarvis-action[\s\S]*?```/g, '').trim()
    
    // CREAR SKILL
    if (actionData.action === 'create_skill' && actionData.skill) {
      return {
        type: 'create_skill',
        data: {
          skillName: actionData.skill.name,
          skillDescription: actionData.skill.description,
          skillCategory: actionData.skill.category,
          skillCode: actionData.skill.code,
        },
        message: cleanMessage,
      }
    }
    
    // DELEGAR A AGENTE
    if (actionData.action === 'delegate_agent' && actionData.agentName) {
      return {
        type: 'delegate_agent',
        data: {
          agentName: actionData.agentName,
          task: actionData.task || '',
        },
        message: cleanMessage,
      }
    }
    
    // CREAR AGENTE
    if (actionData.action === 'create_agent' && actionData.agent) {
      return {
        type: 'create_agent',
        data: {
          agentName: actionData.agent.name,
          agentDescription: actionData.agent.description,
          agentCategory: actionData.agent.category,
          agentPrompt: actionData.agent.systemPrompt,
          agentModel: actionData.agent.model || 'gpt-4.1',
        },
        message: cleanMessage,
      }
    }
    
    // CREAR MCP
    if (actionData.action === 'create_mcp' && actionData.mcp) {
      return {
        type: 'create_mcp',
        data: {
          mcpName: actionData.mcp.name,
          mcpDescription: actionData.mcp.description,
          mcpEndpoint: actionData.mcp.endpoint,
          mcpCapabilities: actionData.mcp.capabilities,
        },
        message: cleanMessage,
      }
    }
    
    // NAVEGACIÓN
    if (actionData.action === 'navigate' && actionData.route) {
      return {
        type: 'navigate',
        data: {
          route: actionData.route,
          pageName: actionData.message || actionData.route,
        },
        message: cleanMessage || actionData.message || `Navegando a ${actionData.route}`,
      }
    }
    
    // EJECUTAR TAREA
    if (actionData.action === 'execute_task') {
      return {
        type: 'execute',
        data: {
          target: actionData.task,
          parameters: actionData.params,
        },
        message: cleanMessage || actionData.message || 'Ejecutando tarea...',
      }
    }
    
    // CONECTAR
    if (actionData.action === 'connect') {
      return {
        type: 'connect',
        data: {
          target: actionData.service || actionData.target,
          parameters: actionData.params,
        },
        message: cleanMessage || actionData.message || 'Conectando servicio...',
      }
    }
    
    // CREAR MEDIA (imágenes/videos desde Estudio Creativo)
    if (actionData.action === 'create_media' || actionData.action === 'generate_media') {
      const mediaData = actionData.media || actionData.data || actionData
      return {
        type: 'generate_image', // or generate_video based on mediaType
        data: {
          imagePrompt: mediaData.description || mediaData.prompt || '',
          videoPrompt: mediaData.description || mediaData.prompt || '',
          parameters: {
            mediaType: mediaData.mediaType || 'image',
            orientation: mediaData.orientation || 'square',
            platform: mediaData.platform || 'general',
            format: mediaData.format || 'post',
            style: mediaData.style || 'cinematic',
            title: mediaData.title,
            videoMode: mediaData.videoMode || 'slideshow',
            videoModel: mediaData.videoModel,
            // 🎨 Multi-modelo de imagen — hint del LLM o selección manual
            imageModel: mediaData.imageModel || mediaData.modelId,
            projectId: mediaData.projectId, // Asociar al proyecto
            items: mediaData.items, // For batch generation
          },
        },
        message: cleanMessage || actionData.message || 'Generando contenido creativo...',
      }
    }

    // 👁️ INTROSPECCIÓN (OJOS INTERNOS)
    // Support multiple action names the LLM might use for introspection
    const introspectActions = ['introspect', 'get_self_analysis', 'self_analysis', 'analyze_self', 'auto_analysis', 'diagnostico', 'self_diagnostic', 'show_code', 'read_code', 'view_code']
    if (introspectActions.includes(actionData.action)) {
      // Map various LLM-generated params to the standard introspect format
      let introspectType = actionData.type || 'analyze-self'
      const scope = actionData.params?.scope || actionData.scope
      
      // Map scope values to introspect types
      if (scope === 'full_diagnostic' || scope === 'last_updates' || scope === 'capabilities') {
        introspectType = 'analyze-self'
      }
      if (actionData.action === 'show_code' || actionData.action === 'read_code' || actionData.action === 'view_code') {
        introspectType = actionData.file ? 'read' : 'structure'
      }
      
      return {
        type: 'introspect',
        data: {
          parameters: {
            type: introspectType, // structure, read, search, analyze-self, stats
            file: actionData.file || actionData.params?.file,
            query: actionData.query || actionData.params?.query,
          },
        },
        message: cleanMessage || actionData.message || 'Activando ojos internos...',
      }
    }

    // 🔵 GOOGLE WORKSPACE (Calendar, Drive, Docs, Sheets, Gmail)
    if (actionData.action === 'google_workspace' && actionData.service) {
      return {
        type: 'google_workspace',
        data: {
          googleService: actionData.service, // 'calendar' | 'drive' | 'docs' | 'sheets' | 'gmail'
          googleAction: actionData.serviceAction || actionData.action_type, // 'list_events', 'list_files', etc.
          googleParams: actionData.params || {},
        },
        message: cleanMessage || actionData.message || 'Consultando Google Workspace...',
      }
    }

    // 🚀 GROWTH ENGINE (CRM, Leads, Outreach, Inbox, Campañas, Reportes)
    if (actionData.action === 'growth_engine' && actionData.growthAction) {
      return {
        type: 'growth_engine',
        data: {
          growthAction: actionData.growthAction,
          growthParams: actionData.params || {},
        },
        message: cleanMessage || actionData.message || 'Ejecutando Growth Engine...',
      }
    }

    // 📁 CREAR PROYECTO
    if (actionData.action === 'create_project' && actionData.project) {
      return {
        type: 'create_project',
        data: {
          projectName: actionData.project.name,
          projectDescription: actionData.project.description || '',
          projectType: actionData.project.projectType || 'custom',
        },
        message: cleanMessage || actionData.message || 'Creando proyecto...',
      }
    }

    // 🏠 IoT (Smart Home / Device Control)
    if (actionData.action === 'iot' || actionData.action === 'smart_home' || actionData.action === 'device_control') {
      return {
        type: 'iot',
        data: {
          iotAction: actionData.iotAction || actionData.params?.action || actionData.command || 'status',
          deviceName: actionData.deviceName || actionData.device || actionData.params?.deviceName || actionData.target || '',
          roomName: actionData.roomName || actionData.room || actionData.params?.roomName || '',
          iotParams: actionData.iotParams || actionData.params || {},
          target: actionData.deviceName || actionData.device || actionData.target || '',
        },
        message: cleanMessage || actionData.message || '🏠 Controlando dispositivo...',
      }
    }

    // 📡 SOCIAL BRIDGE (LinkedIn publish/schedule)
    if (actionData.action === 'social_bridge' || actionData.action === 'publish_linkedin' || actionData.action === 'linkedin') {
      return {
        type: 'social_bridge',
        data: {
          socialAction: actionData.socialAction || actionData.params?.socialAction || 'publish_linkedin',
          content: actionData.content || actionData.params?.content || actionData.text || '',
          scheduledFor: actionData.scheduledFor || actionData.params?.scheduledFor || '',
        },
        message: cleanMessage || actionData.message || '📡 Publicando en LinkedIn...',
      }
    }

    // 🌐 BROWSER AUTOMATION
    if (actionData.action === 'browser_automation' || actionData.action === 'browser' || actionData.action === 'web_automation' || actionData.action === 'automate_browser') {
      return {
        type: 'browser_automation',
        data: {
          browserAction: actionData.browserAction || actionData.params?.browserAction || 'ai_task',
          browserSessionId: actionData.browserSessionId || actionData.sessionId || actionData.params?.sessionId || '',
          browserTemplateId: actionData.browserTemplateId || actionData.templateId || actionData.params?.templateId || '',
          browserSteps: actionData.browserSteps || actionData.steps || actionData.params?.steps || [],
          browserVariables: actionData.browserVariables || actionData.variables || actionData.params?.variables || {},
          browserCommand: actionData.browserCommand || actionData.command || actionData.task || actionData.params?.task || '',
          templateName: actionData.templateName || actionData.name || actionData.params?.name || '',
          templateDescription: actionData.templateDescription || actionData.description || actionData.params?.description || '',
          templateCategory: actionData.templateCategory || actionData.category || actionData.params?.category || '',
          content: actionData.content || '',
        },
        message: cleanMessage || actionData.message || '🌐 Ejecutando Browser Automation...',
      }
    }

    // 🔍 WEB SEARCH
    if (actionData.action === 'web_search' || actionData.action === 'search' || actionData.action === 'buscar') {
      return {
        type: 'web_search',
        data: {
          query: actionData.query || actionData.params?.query || actionData.search_query || actionData.params?.search_query || '',
        },
        message: cleanMessage || actionData.message || 'Buscando en la web...',
      }
    }

    // 🌙 THEME TOGGLE
    if (actionData.action === 'theme_toggle' || actionData.action === 'toggle_theme' || actionData.action === 'change_theme' || actionData.action === 'dark_mode' || actionData.action === 'light_mode') {
      const themeValue = actionData.theme || actionData.params?.theme || actionData.mode || actionData.params?.mode || 'toggle'
      return {
        type: 'theme_toggle',
        data: {
          theme: themeValue === 'dark' || themeValue === 'oscuro' ? 'dark' : themeValue === 'light' || themeValue === 'claro' ? 'light' : 'toggle',
        },
        message: cleanMessage || actionData.message || 'Cambiando tema...',
      }
    }

    // 📅 SCHEDULE (calendar/reminders)
    if (actionData.action === 'schedule' || actionData.action === 'calendar' || actionData.action === 'reminder') {
      return {
        type: 'schedule',
        data: {
          title: actionData.title || actionData.params?.title || '',
          date: actionData.date || actionData.params?.date || '',
          time: actionData.time || actionData.params?.time || '',
          eventDescription: actionData.description || actionData.params?.description || '',
          calendarAction: actionData.calendarAction || actionData.params?.calendarAction || 'create',
        },
        message: cleanMessage || actionData.message || '📅 Programando evento...',
      }
    }

    // 🦾 BRAZOS (connection management)
    if (actionData.action === 'brazos' || actionData.action === 'connection' || actionData.action === 'arm') {
      return {
        type: 'brazos',
        data: {
          brazosAction: actionData.brazosAction || actionData.params?.brazosAction || 'status',
          armType: actionData.armType || actionData.params?.armType || '',
          target: actionData.target || actionData.armType || '',
        },
        message: cleanMessage || actionData.message || '🦾 Gestionando brazo...',
      }
    }

    // 🤖 SALES AGENT
    if (actionData.action === 'sales_agent' || actionData.action === 'create_sales_agent') {
      return {
        type: 'sales_agent',
        data: {
          salesAction: actionData.salesAction || actionData.params?.salesAction || 'list',
          agentId: actionData.agentId || actionData.params?.agentId || '',
          agentData: actionData.agentData || actionData.params || {},
        },
        message: cleanMessage || actionData.message || '🤖 Gestionando agente de ventas...',
      }
    }

    // 🎙️ VOICE AGENT
    if (actionData.action === 'voice_agent' || actionData.action === 'create_voice_agent') {
      return {
        type: 'voice_agent',
        data: {
          voiceAction: actionData.voiceAction || actionData.params?.voiceAction || 'list',
          agentId: actionData.agentId || actionData.params?.agentId || '',
          agentData: actionData.agentData || actionData.params || {},
        },
        message: cleanMessage || actionData.message || '🎙️ Gestionando Voice Agent...',
      }
    }

    // 🎬 UGC GENERATE
    if (actionData.action === 'ugc_generate' || actionData.action === 'generate_ugc' || actionData.action === 'ugc') {
      return {
        type: 'ugc_generate',
        data: {
          ugcAction: actionData.ugcAction || actionData.params?.ugcAction || 'generate',
          script: actionData.script || actionData.params?.script || '',
          ugcParams: actionData.params || {},
        },
        message: cleanMessage || actionData.message || '🎬 Generando UGC...',
      }
    }

    // 📡 CONTENT PUBLISH
    if (actionData.action === 'content_publish' || actionData.action === 'publish_content' || actionData.action === 'publish') {
      return {
        type: 'content_publish',
        data: {
          title: actionData.title || actionData.params?.title || '',
          content: actionData.content || actionData.params?.content || '',
          slug: actionData.slug || actionData.params?.slug || '',
          contentType: actionData.contentType || actionData.params?.contentType || 'blog_post',
          agentId: actionData.agentId || actionData.params?.agentId || 'octopus',
          metadata: actionData.metadata || actionData.params?.metadata || {},
        },
        message: cleanMessage || actionData.message || '📡 Publicando contenido...',
      }
    }

    // 🔄 FALLBACK: If we have a valid action block but don't recognize the action type,
    // still return a generic action so the raw JSON doesn't show in the UI
    if (actionData.action && typeof actionData.action === 'string') {
      console.warn(`[JARVIS Actions] Unrecognized action: "${actionData.action}" — treating as generic execute`)
      return {
        type: 'none',
        data: {
          target: actionData.action,
          parameters: actionData.params || actionData,
        },
        message: cleanMessage || actionData.message || '',
      }
    }

    return null
  } catch {
    return null
  }
}

// Parsear respuesta de JARVIS para extraer la PRIMERA acción (retrocompatible)
export function parseJarvisAction(response: string): JarvisAction | null {
  const actionMatch = response.match(/```jarvis-action\n?([\s\S]*?)```/)
  if (!actionMatch) return null
  return parseSingleActionBlock(actionMatch[1], response)
}

// Parsear TODAS las acciones jarvis-action de una respuesta (para ejecución multi-paso)
export function parseAllJarvisActions(response: string): JarvisAction[] {
  const regex = /```jarvis-action\n?([\s\S]*?)```/g
  const actions: JarvisAction[] = []
  let match: RegExpExecArray | null
  
  while ((match = regex.exec(response)) !== null) {
    const action = parseSingleActionBlock(match[1], response)
    if (action) {
      actions.push(action)
    }
  }
  
  return actions
}
