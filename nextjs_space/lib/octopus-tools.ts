/**
 * OCTOPUS Tools v1.0 — Function Calling Definitions
 * 
 * The "steering wheel" of the race car.
 * Each tool maps to a real, executable action with typed parameters.
 * The LLM sees these definitions and calls tools natively — no regex, no prompt hacks.
 * 
 * Architecture: OpenAI-compatible function calling format.
 * Works with GPT-4, Claude, Gemini, Qwen — any model that supports tools.
 */

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required?: string[]
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// GROWTH ENGINE — CRM, Leads, Campaigns, Outreach
// ═══════════════════════════════════════════════════════════════

const GROWTH_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'growth_list_leads',
      description: 'Lista los leads/prospectos del pipeline de ventas. Retorna datos reales de la base de datos.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'contacted', 'qualified', 'converted', 'lost'],
            description: 'Filtrar por estado del lead',
          },
          source: {
            type: 'string',
            description: 'Filtrar por fuente (ej: "wildverse-blog", "manual", "expo")',
          },
          limit: {
            type: 'number',
            description: 'Número máximo de leads. Default: 25',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_get_stats',
      description: 'Obtiene estadísticas generales del pipeline: total de leads, por estado, campañas activas, emails enviados, etc.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_deduplicate_leads',
      description: 'Busca y elimina leads duplicados (mismo email). SIEMPRE primero haz dry_run=true para mostrar al usuario qué se eliminará.',
      parameters: {
        type: 'object',
        properties: {
          dry_run: {
            type: 'boolean',
            description: 'Si true, solo lista duplicados sin borrar. Si false, elimina los duplicados dejando el más reciente.',
          },
        },
        required: ['dry_run'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_create_lead',
      description: 'Crea un nuevo lead en el pipeline.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Email del lead' },
          contactName: { type: 'string', description: 'Nombre del contacto' },
          businessName: { type: 'string', description: 'Nombre del negocio' },
          businessType: { type: 'string', description: 'Tipo de negocio' },
          phone: { type: 'string', description: 'Teléfono' },
          city: { type: 'string', description: 'Ciudad' },
          notes: { type: 'string', description: 'Notas adicionales' },
          leadSource: { type: 'string', description: 'Fuente del lead' },
        },
        required: ['businessName'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_research_lead',
      description: 'Investiga un lead existente: verifica si el email es real, busca info online sobre la empresa.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'ID del lead a investigar' },
          email: { type: 'string', description: 'Email a investigar (alternativa a leadId)' },
          name: { type: 'string', description: 'Nombre a investigar (alternativa)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_prospect_web',
      description: 'Busca prospectos/leads REALES en la web y los crea automáticamente en el pipeline. Usa para encontrar negocios con datos de contacto (email, teléfono, etc). ÚSALA cuando el usuario pida buscar perfiles, prospectar o encontrar leads nuevos en internet.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Tipo de negocio a buscar. Ej: "gym", "restaurant", "clinic", "bar", "salon", "coaching"' },
          location: { type: 'string', description: 'Ciudad o región donde buscar. Ej: "Miami", "Madrid", "New York"' },
          count: { type: 'number', description: 'Número de perfiles a buscar (máx 10). Default: 5' },
          role: { type: 'string', description: 'Rol del contacto a buscar. Ej: "owner", "manager", "founder", "marketing director"' },
        },
        required: ['industry'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_list_campaigns',
      description: 'Lista todas las campañas de outreach/nurture del usuario.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['draft', 'active', 'paused', 'completed', 'archived'],
            description: 'Filtrar por estado',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_create_campaign',
      description: 'Crea una nueva campaña de outreach o nurture.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la campaña' },
          campaignType: {
            type: 'string',
            enum: ['outreach', 'seasonal', 'nurture', 'reactivation', 'remarketing'],
            description: 'Tipo de campaña',
          },
          description: { type: 'string', description: 'Descripción de la campaña' },
          emailSubject: { type: 'string', description: 'Asunto del email template' },
          emailTemplate: { type: 'string', description: 'Template del email (soporta tokens [Name], [Business], [City])' },
        },
        required: ['name', 'campaignType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_assign_leads_to_campaign',
      description: 'Asigna leads a una campaña existente.',
      parameters: {
        type: 'object',
        properties: {
          campaignId: { type: 'string', description: 'ID de la campaña' },
          campaignName: { type: 'string', description: 'Nombre de la campaña (alternativa a campaignId)' },
          count: { type: 'number', description: 'Cantidad de leads a asignar. Default: 25' },
          status: { type: 'string', description: 'Solo asignar leads con este estado. Default: "new"' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_activate_campaign',
      description: 'Activa una campaña, generando emails pendientes para cada lead asignado. Los emails quedan como PENDIENTES para revisión.',
      parameters: {
        type: 'object',
        properties: {
          campaignId: { type: 'string', description: 'ID de la campaña' },
          campaignName: { type: 'string', description: 'Nombre de la campaña (alternativa)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_batch_approve',
      description: 'Aprueba y envía todos los emails pendientes. SOLO usar cuando el usuario confirme explícitamente después de revisar.',
      parameters: {
        type: 'object',
        properties: {
          campaignId: { type: 'string', description: 'Solo aprobar emails de esta campaña. Si vacío, aprueba todos.' },
          limit: { type: 'number', description: 'Máximo de emails a aprobar. Default: 50' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_generate_outreach',
      description: 'Genera un email de outreach personalizado para un lead específico.',
      parameters: {
        type: 'object',
        properties: {
          leadId: { type: 'string', description: 'ID del lead' },
          email: { type: 'string', description: 'Email directo (alternativa a leadId)' },
          customSubject: { type: 'string', description: 'Asunto personalizado' },
          customMessage: { type: 'string', description: 'Mensaje personalizado' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_update_pending_emails',
      description: 'Actualiza el copy (asunto y/o cuerpo) de todos los emails pendientes de una campaña.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Nuevo asunto. Soporta tokens: [Name], [Business], [City], [Email]' },
          body: { type: 'string', description: 'Nuevo cuerpo del email. Soporta tokens.' },
          campaignId: { type: 'string', description: 'Solo actualizar emails de esta campaña' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_sync_inbox',
      description: 'Sincroniza el inbox de email para detectar respuestas de leads y actualizar estados.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_get_report',
      description: 'Genera un reporte detallado del pipeline con DATOS REALES de la DB: leads por status, campañas, emails enviados, APERTURAS de emails (tracking pixel: quién abrió, cuándo y cuántas veces), respuestas y conversiones. USA SIEMPRE esta herramienta cuando el usuario pregunte si alguien abrió sus emails o por métricas de campañas — NUNCA uses web_search para datos internos.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'growth_get_insights',
      description: 'Obtiene insights inteligentes del pipeline: patrones, recomendaciones, oportunidades.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// GOOGLE WORKSPACE — Gmail, Calendar, Drive, Docs
// ═══════════════════════════════════════════════════════════════

const GOOGLE_WORKSPACE_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'gmail_send_email',
      description: 'Envía un email vía Gmail. IMPORTANTE: Siempre muestra un borrador al usuario para confirmación ANTES de enviar.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Dirección de email del destinatario' },
          subject: { type: 'string', description: 'Asunto del email' },
          body: { type: 'string', description: 'Cuerpo del email (puede incluir HTML básico)' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_list_emails',
      description: 'Lista los emails recientes del inbox de Gmail.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Número de emails. Default: 10' },
          query: { type: 'string', description: 'Filtro de búsqueda Gmail (ej: "from:user@example.com")' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gmail_create_draft',
      description: 'Crea un borrador de email en Gmail.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Destinatario' },
          subject: { type: 'string', description: 'Asunto' },
          body: { type: 'string', description: 'Cuerpo' },
        },
        required: ['to', 'subject', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calendar_list_events',
      description: 'Lista los próximos eventos del Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Eventos de los próximos N días. Default: 7' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calendar_create_event',
      description: 'Crea un nuevo evento en Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del evento' },
          date: { type: 'string', description: 'Fecha (formato YYYY-MM-DD)' },
          time: { type: 'string', description: 'Hora de inicio (formato HH:MM)' },
          duration: { type: 'number', description: 'Duración en minutos. Default: 60' },
          description: { type: 'string', description: 'Descripción del evento' },
        },
        required: ['title', 'date'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// CREATIVE STUDIO — Image & Video Generation
// ═══════════════════════════════════════════════════════════════

const CREATIVE_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Genera una imagen con IA. La descripción SIEMPRE debe ser en INGLÉS para mejores resultados.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Descripción de la imagen a generar (EN INGLÉS)' },
          style: {
            type: 'string',
            enum: ['cinematic', 'photographic', 'illustration', 'minimalist', '3d', 'anime'],
            description: 'Estilo visual',
          },
          orientation: {
            type: 'string',
            enum: ['square', 'landscape', 'portrait', 'story'],
            description: 'Orientación de la imagen',
          },
          platform: {
            type: 'string',
            enum: ['general', 'instagram', 'facebook', 'linkedin', 'twitter'],
            description: 'Plataforma destino (ajusta dimensiones)',
          },
        },
        required: ['description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description: 'Genera un video corto con IA a partir de un prompt descriptivo.',
      parameters: {
        type: 'object',
        properties: {
          description: { type: 'string', description: 'Descripción del video (EN INGLÉS)' },
          videoMode: {
            type: 'string',
            enum: ['slideshow', 'ai_video', 'motion_graphics'],
            description: 'Modo de generación',
          },
          title: { type: 'string', description: 'Título del video' },
        },
        required: ['description'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// SYSTEM — Navigation, Theme, Search, Introspection
// ═══════════════════════════════════════════════════════════════

const SYSTEM_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description: 'Navega al usuario a una página específica del cockpit.',
      parameters: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            enum: [
              'dashboard', 'growth', 'projects', 'brazos', 'skill-factory',
              'agent-factory', 'mcp-factory', 'chat', 'api-hub', 'settings',
              'browser-automation', 'jarvis', 'onboarding',
            ],
            description: 'Página destino',
          },
        },
        required: ['page'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_theme',
      description: 'Cambia el tema visual del cockpit (modo oscuro/claro).',
      parameters: {
        type: 'object',
        properties: {
          theme: {
            type: 'string',
            enum: ['dark', 'light', 'toggle'],
            description: 'Tema deseado. "toggle" alterna entre oscuro y claro.',
          },
        },
        required: ['theme'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Busca información en la web EXTERNA. Usa para investigar temas, noticias, tendencias. PROHIBIDO usarla para datos internos de la plataforma (campañas, leads, emails abiertos, skills, agentes) — para eso usa las herramientas growth_* o la conciencia global.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Consulta de búsqueda' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'introspect_system',
      description: 'Auto-análisis del sistema OCTOPUS: estructura de código, estadísticas, capacidades.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['structure', 'stats', 'analyze-self', 'capabilities'],
            description: 'Tipo de introspección',
          },
        },
        required: ['type'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// BROWSER AUTOMATION
// ═══════════════════════════════════════════════════════════════

const BROWSER_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'browser_run_template',
      description: 'Ejecuta una plantilla de Browser Automation YA GUARDADA (de /dashboard/browser-automation). Si el usuario pide una tarea web nueva o ad-hoc que no tiene plantilla, usa browser_ai_task en su lugar. Las skills de Skill Factory NO son plantillas de browser.',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'ID del template' },
          templateName: { type: 'string', description: 'Nombre del template (alternativa al ID)' },
          variables: {
            type: 'object',
            description: 'Variables para el template (key-value). Puedes usar {{last_image_url}} como valor: se sustituye por la URL real de la última imagen generada.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_ai_task',
      description: 'Ejecuta una tarea de automatización web descrita en lenguaje natural (navegar, buscar, scrapear, hacer clicks). Es la opción preferida para tareas web nuevas. Requiere que el Bridge esté online en el PC del usuario. ENCADENAMIENTO: si en este mismo turno (o uno reciente) generaste una imagen con generate_image, incluye el placeholder {{last_image_url}} en la tarea y el sistema lo sustituirá por la URL real de la imagen.',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'Descripción de la tarea a ejecutar en el browser' },
          sessionId: { type: 'string', description: 'ID de sesión de browser existente (opcional)' },
        },
        required: ['task'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// IoT — Smart Home
// ═══════════════════════════════════════════════════════════════

const IOT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'iot_control_device',
      description: 'Controla un dispositivo inteligente del hogar (luces, enchufes, sensores).',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['on', 'off', 'toggle', 'set_brightness', 'set_color', 'status', 'list'],
            description: 'Acción a realizar',
          },
          deviceName: { type: 'string', description: 'Nombre del dispositivo' },
          roomName: { type: 'string', description: 'Nombre del cuarto' },
          brightness: { type: 'number', description: 'Nivel de brillo (0-100)' },
          color: { type: 'string', description: 'Color (hex o nombre)' },
        },
        required: ['action'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// SOCIAL & CONTENT
// ═══════════════════════════════════════════════════════════════

const SOCIAL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'social_publish_linkedin',
      description: 'Publica o programa un post en LinkedIn.',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: 'Contenido del post' },
          scheduledFor: { type: 'string', description: 'Fecha/hora para programar (ISO 8601). Si vacío, publica inmediatamente.' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'content_publish_blog',
      description: 'Publica un artículo en el blog/CMS conectado.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del artículo' },
          content: { type: 'string', description: 'Contenido HTML del artículo' },
          slug: { type: 'string', description: 'URL slug' },
        },
        required: ['title', 'content'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// SKILL & AGENT CREATION
// ═══════════════════════════════════════════════════════════════

const CREATION_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_skill',
      description: 'Registra una nueva skill en Skill Factory (metadata + código). IMPORTANTE: una skill creada aquí NO se ejecuta automáticamente en el navegador — si el usuario quiere ejecutar una tarea web en vivo, usa browser_ai_task después de crear la skill (o en lugar de crearla).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre de la skill' },
          description: { type: 'string', description: 'Descripción de lo que hace' },
          category: { type: 'string', description: 'Categoría (ej: marketing, analytics, automation)' },
          code: { type: 'string', description: 'Código JavaScript de la skill' },
        },
        required: ['name', 'description', 'code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_agent',
      description: 'Crea un nuevo agente especializado de IA que queda guardado en Agent Factory, listo para recibir tareas delegadas. Escribe un systemPrompt PROFESIONAL y COMPLETO (rol, expertise, tono, formato de respuestas, reglas). Elige temperature según el rol: 0.2-0.4 para tareas analíticas/datos, 0.7-0.8 para tareas creativas/copywriting.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del agente' },
          description: { type: 'string', description: 'Descripción del agente' },
          systemPrompt: { type: 'string', description: 'System prompt completo y profesional que define rol, expertise, tono, formato y reglas del agente' },
          model: {
            type: 'string',
            enum: ['gpt-4.1', 'claude-sonnet-4-20250514', 'gemini-2.5-flash'],
            description: 'Modelo LLM a usar. Default: gpt-4.1',
          },
          temperature: { type: 'number', description: 'Creatividad del agente (0.1-1.0). Analítico: 0.2-0.4, balanceado: 0.5-0.6, creativo: 0.7-0.8. Default: 0.7' },
          category: { type: 'string', description: 'Categoría: code, design, data, automation, marketing, custom' },
          icon: { type: 'string', description: 'Emoji que representa al agente (ej: ✍️, 📊, 🤖)' },
        },
        required: ['name', 'description', 'systemPrompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_mcp',
      description: 'Crea un nuevo conector MCP (Model Context Protocol) en MCP Factory para integrar un servicio/API externo. Queda guardado con estado "desconectado" hasta que el usuario pruebe la conexión. Si el usuario te da el endpoint y/o API key, inclúyelos.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del MCP (ej: "Notion MCP", "Slack Connector")' },
          description: { type: 'string', description: 'Qué servicio integra y para qué sirve' },
          endpoint: { type: 'string', description: 'URL del endpoint del servidor MCP o API (si el usuario la proporciona)' },
          apiKey: { type: 'string', description: 'API key del servicio (solo si el usuario la proporciona explícitamente)' },
          capabilities: { type: 'array', items: { type: 'string' }, description: 'Lista de capacidades (ej: ["leer páginas", "crear tareas"])' },
          category: { type: 'string', description: 'Categoría: productivity, communication, data, dev, custom' },
        },
        required: ['name', 'description'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delegate_to_agent',
      description: 'Delega una tarea a un agente especializado existente.',
      parameters: {
        type: 'object',
        properties: {
          agentName: { type: 'string', description: 'Nombre del agente al que delegar' },
          task: { type: 'string', description: 'Tarea a delegar' },
        },
        required: ['agentName', 'task'],
      },
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// TOOL REGISTRY — All tools combined
// ═══════════════════════════════════════════════════════════════

export const ALL_TOOLS: ToolDefinition[] = [
  ...GROWTH_TOOLS,
  ...GOOGLE_WORKSPACE_TOOLS,
  ...CREATIVE_TOOLS,
  ...SYSTEM_TOOLS,
  ...BROWSER_TOOLS,
  ...IOT_TOOLS,
  ...SOCIAL_TOOLS,
  ...CREATION_TOOLS,
]

// Module-based tool selection (reduces token usage by only sending relevant tools)
export type ToolModule = 
  | 'growth' | 'google_workspace' | 'creative' | 'system' 
  | 'browser' | 'iot' | 'social' | 'creation'

const MODULE_TOOL_MAP: Record<ToolModule, ToolDefinition[]> = {
  growth: GROWTH_TOOLS,
  google_workspace: GOOGLE_WORKSPACE_TOOLS,
  creative: CREATIVE_TOOLS,
  system: SYSTEM_TOOLS,
  browser: BROWSER_TOOLS,
  iot: IOT_TOOLS,
  social: SOCIAL_TOOLS,
  creation: CREATION_TOOLS,
}

// Map context-router modules to tool modules
const CONTEXT_TO_TOOL_MODULE: Record<string, ToolModule[]> = {
  growth_engine: ['growth'],
  google_workspace: ['google_workspace'],
  creative: ['creative'],
  browser_automation: ['browser'],
  iot: ['iot'],
  social_bridge: ['social'],
  calendar: ['google_workspace'],
  diagnostic: ['growth'], // Reports need growth data
  modules_guide: [],      // No tools needed for help
  sales_agents: ['creation'],
  voice_agents: ['creation'],
  invoicing: [],
  projects: ['creation'],
  subscription: [],
  knowledge_base: [],
  brazos: [],
  identity: [],
}

/**
 * Select tools based on active context-router modules.
 * Always includes system tools (navigation, theme, search).
 * This keeps the tool payload small (~2-4K tokens instead of ~8K).
 */
export function selectToolsForModules(contextModules: string[]): ToolDefinition[] {
  const toolModules = new Set<ToolModule>(['system']) // Always include system tools
  
  for (const ctxMod of contextModules) {
    const mapped = CONTEXT_TO_TOOL_MODULE[ctxMod]
    if (mapped) {
      for (const tm of mapped) toolModules.add(tm)
    }
  }
  
  // Always include creation tools — users can create things from any context
  toolModules.add('creation')
  
  const tools: ToolDefinition[] = []
  for (const mod of toolModules) {
    tools.push(...MODULE_TOOL_MAP[mod])
  }
  
  return tools
}

/**
 * Get the total token estimate for a set of tools.
 * Rough estimate: ~40 tokens per tool (name + description + params).
 */
export function estimateToolTokens(tools: ToolDefinition[]): number {
  return tools.reduce((acc, t) => {
    const desc = t.function.description.length / 4
    const params = JSON.stringify(t.function.parameters).length / 4
    return acc + desc + params + 20 // 20 for name + structure
  }, 0)
}
