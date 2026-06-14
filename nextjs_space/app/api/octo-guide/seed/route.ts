import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateEmbedding, prepareTextForEmbedding } from '@/lib/embeddings'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Allow longer timeout for embedding generation

// Initial knowledge base for ASK Octo AI - EXPANDED VERSION
const INITIAL_KNOWLEDGE = [
  // ═══════════════════════════════════════════════════════════════════════════
  // OCTOPUS (JARVIS) - Comandos y Funciones
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'jarvis',
    title: 'Qué es OCTOPUS (Jarvis)',
    content: 'OCTOPUS (Jarvis) es el asistente principal de la plataforma. Puedes hablarle en lenguaje natural para generar imágenes, videos UGC, publicar en redes sociales, buscar información y más. Es el centro de control de todo el sistema.',
    keywords: ['octopus', 'jarvis', 'asistente', 'qué es', 'para qué sirve'],
    priority: 100
  },
  {
    category: 'command',
    module: 'jarvis',
    title: 'Generar imágenes con Jarvis',
    content: 'Para generar imágenes, escribe: "Genera una imagen de [descripción]". Ejemplos: "Genera una imagen de un pulpo futurista", "Crea una imagen profesional para LinkedIn sobre IA".',
    keywords: ['imagen', 'generar', 'crear', 'foto', 'picture', 'generate image'],
    priority: 90,
    examples: JSON.stringify(['Genera una imagen de un pulpo futurista', 'Crea un banner para redes sociales', 'Genera una imagen profesional para LinkedIn'])
  },
  {
    category: 'command',
    module: 'jarvis',
    title: 'Generar videos UGC con Jarvis',
    content: 'Para generar videos UGC con avatares IA, escribe: "Genera un video UGC de [tema]". El sistema creará un video con un avatar parlante. Puedes especificar idioma y estilo.',
    keywords: ['video', 'ugc', 'generar', 'avatar', 'clip', 'crear video'],
    priority: 90,
    examples: JSON.stringify(['Genera un video UGC promocionando OCTOPUS', 'Crea un video explicando los beneficios de la IA', 'Genera un video UGC en español sobre marketing digital'])
  },
  {
    category: 'command',
    module: 'jarvis',
    title: 'Publicar en LinkedIn desde Jarvis',
    content: 'Para publicar contenido en LinkedIn directamente desde Jarvis: "Publica esto en LinkedIn" o "Publícalo en LinkedIn". Asegúrate de que LinkedIn esté conectado en Social Bridge primero.',
    keywords: ['publicar', 'linkedin', 'postear', 'compartir', 'publish'],
    priority: 85,
    examples: JSON.stringify(['Publica esto en LinkedIn', 'Compártelo en LinkedIn', 'Publícalo'])
  },
  {
    category: 'command',
    module: 'jarvis',
    title: 'Programar publicaciones desde Jarvis',
    content: 'Para programar una publicación en LinkedIn: "Programa este video para hoy a las [hora] en LinkedIn". Ejemplos de formatos de hora: 5pm, 17:30, 6:45pm. El sistema entiende español e inglés.',
    keywords: ['programar', 'schedule', 'agendar', 'programación', 'hora', 'mañana', 'hoy'],
    priority: 85,
    examples: JSON.stringify(['Programa este video para hoy a las 5:30pm en LinkedIn', 'Programa la imagen para mañana a las 9am', 'Programa este contenido para las 18:00'])
  },
  {
    category: 'best_practice',
    module: 'jarvis',
    title: 'Mejores prácticas con Jarvis',
    content: 'Tips para usar Jarvis efectivamente: 1) Sé específico en tus peticiones 2) Puedes encadenar comandos: "Genera un video UGC y progámalo para las 5pm" 3) Si algo no funciona, reformula la petición 4) Jarvis recuerda el contexto de la conversación',
    keywords: ['tips', 'consejos', 'mejores prácticas', 'cómo usar', 'recomendaciones'],
    priority: 70
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL BRIDGE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'social_bridge',
    title: 'Qué es Social Bridge',
    content: 'Social Bridge es el módulo para publicar y programar contenido en redes sociales. Actualmente soporta LinkedIn con conexión API directa (sin extensión). Puedes publicar texto, imágenes y videos.',
    keywords: ['social bridge', 'redes sociales', 'publicar', 'qué es', 'para qué sirve'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'social_bridge',
    title: 'Cómo conectar LinkedIn',
    content: 'Para conectar LinkedIn: 1) Ve a Social Bridge 2) En la sección "Conexiones", haz clic en "Conectar LinkedIn" 3) Autoriza la conexión con tu cuenta de LinkedIn 4) Verás el badge verde "API Conectada" cuando esté listo.',
    keywords: ['conectar', 'linkedin', 'api', 'autorizar', 'vincular', 'enlazar'],
    priority: 95
  },
  {
    category: 'faq',
    module: 'social_bridge',
    title: 'Cómo publicar en Social Bridge',
    content: 'Para publicar: 1) Asegúrate de que LinkedIn esté conectado (badge verde) 2) Ve a la pestaña "Publicar" 3) Escribe tu contenido o adjunta imagen/video 4) Haz clic en "Publicar". También puedes publicar desde Jarvis diciendo "Publica esto en LinkedIn".',
    keywords: ['publicar', 'postear', 'cómo', 'paso a paso', 'tutorial'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'social_bridge',
    title: 'Cómo programar publicaciones',
    content: 'Para programar posts: 1) Desde Social Bridge: usa la pestaña "Programar" y selecciona fecha/hora 2) Desde Jarvis: di "Programa este video para hoy a las 5pm en LinkedIn". Las publicaciones programadas se envían automáticamente cuando llega la hora.',
    keywords: ['programar', 'agendar', 'schedule', 'hora', 'fecha', 'automático'],
    priority: 90
  },
  {
    category: 'error',
    module: 'social_bridge',
    title: 'LinkedIn no conecta',
    content: 'Si LinkedIn no conecta: 1) Verifica que estás logueado en LinkedIn en tu navegador 2) Intenta desconectar y reconectar 3) Limpia cookies del navegador 4) Si persiste, contacta soporte. La conexión usa OAuth oficial de LinkedIn.',
    keywords: ['error', 'no conecta', 'falla', 'problema', 'no funciona'],
    priority: 80
  },
  {
    category: 'error',
    module: 'social_bridge',
    title: 'La hora de programación sale mal',
    content: 'Si la hora de programación no es correcta: 1) Usa formato claro: "5:30pm" o "17:30" 2) Especifica "hoy" o "mañana" 3) El sistema usa tu zona horaria del navegador. Ejemplo correcto: "Programa este video para hoy a las 6:40pm en LinkedIn"',
    keywords: ['hora', 'mal', 'incorrecta', 'error', 'programación', 'minutos'],
    priority: 85
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UGC FACTORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'ugc_factory',
    title: 'Qué es UGC Factory',
    content: 'UGC Factory es el módulo para crear videos con avatares IA. Puedes crear videos donde un avatar habla tu guión con lip-sync realista. Ideal para contenido de marketing, tutoriales y redes sociales.',
    keywords: ['ugc', 'factory', 'video', 'avatar', 'qué es', 'para qué sirve'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'ugc_factory',
    title: 'Cómo crear un video UGC',
    content: 'Para crear un video UGC: 1) Ve a UGC Factory o usa Jarvis 2) Selecciona un avatar (o usa el predeterminado) 3) Escribe el guión o deja que la IA lo genere 4) Selecciona la voz 5) Haz clic en "Generar". El video tarda 1-2 minutos.',
    keywords: ['crear', 'generar', 'video', 'ugc', 'cómo', 'pasos'],
    priority: 95
  },
  {
    category: 'faq',
    module: 'ugc_factory',
    title: 'Generar video UGC desde Jarvis',
    content: 'Para generar un video UGC desde Jarvis, simplemente escribe: "Genera un video UGC de [tema]". Ejemplos: "Genera un video UGC promocionando OCTOPUS", "Crea un video UGC sobre los beneficios de la automatización". El sistema usará el avatar y voz predeterminados.',
    keywords: ['jarvis', 'generar', 'video', 'ugc', 'comando', 'desde jarvis'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'ugc_factory',
    title: 'Cuánto tarda un video UGC',
    content: 'Un video UGC típico tarda entre 1-2 minutos en generarse. Videos más largos pueden tardar más. Verás una barra de progreso mientras se genera. Una vez listo, puedes descargarlo o enviarlo a Social Bridge.',
    keywords: ['tiempo', 'tarda', 'duración', 'cuánto', 'esperar'],
    priority: 75
  },
  {
    category: 'best_practice',
    module: 'ugc_factory',
    title: 'Tips para mejores videos UGC',
    content: 'Para mejores videos: 1) Guiones cortos (30-60 seg) funcionan mejor 2) Evita jerga técnica excesiva 3) Termina con un CTA claro 4) Usa avatares que representen tu marca 5) Revisa el video antes de publicar',
    keywords: ['tips', 'consejos', 'mejores', 'calidad', 'recomendaciones'],
    priority: 70
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAL / PLATAFORMA
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'faq',
    module: null,
    title: 'Navegación en OCTOPUS',
    content: 'OCTOPUS tiene varios módulos accesibles desde el menú lateral: Dashboard (inicio), Estudio Creativo, OCTOPUS (Jarvis), Mis Proyectos, Social Bridge, UGC Factory, y más. Cada módulo tiene funciones específicas.',
    keywords: ['navegar', 'menú', 'dónde', 'encontrar', 'módulos'],
    priority: 80
  },
  {
    category: 'faq',
    module: null,
    title: 'Qué es el modo Turbo',
    content: 'El modo Turbo activa modelos de IA más avanzados para respuestas más rápidas y precisas. Se activa desde el botón "Turbo" en el header. Útil para tareas complejas que requieren más capacidad de procesamiento.',
    keywords: ['turbo', 'modo', 'rápido', 'avanzado', 'qué es'],
    priority: 60
  },
  {
    category: 'faq',
    module: null,
    title: 'Soporte y ayuda',
    content: 'Para obtener ayuda: 1) Usa ASK Octo AI (donde estás ahora) para dudas rápidas 2) Contacta soporte desde Settings 3) Revisa la documentación en el Admin Panel (si eres admin).',
    keywords: ['soporte', 'ayuda', 'contacto', 'problema', 'asistencia'],
    priority: 70
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROWTH ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'growth',
    title: 'Qué es Growth Engine',
    content: 'Growth Engine es tu sistema de prospección y generación de leads B2B. Importa leads, clasifícalos por tier (Diamond, Vibranium, Antimatter), automatiza outreach y trackea conversiones. Ideal para equipos de ventas.',
    keywords: ['growth', 'engine', 'leads', 'prospectos', 'qué es', 'ventas'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'growth',
    title: 'Cómo importar leads',
    content: 'Para importar leads: 1) Ve a Growth Engine 2) Haz clic en "Importar Leads" 3) Sube un CSV con columnas: nombre, email, empresa, cargo 4) El sistema clasificará automáticamente por tier. También puedes agregar leads manualmente.',
    keywords: ['importar', 'csv', 'leads', 'subir', 'agregar', 'cargar'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'growth',
    title: 'Sistema de tiers en Growth Engine',
    content: 'Los leads se clasifican en 3 tiers: 💎 Diamond (alta prioridad, máximo potencial), 🟣 Vibranium (buen potencial), 🟢 Antimatter (leads fríos o de menor potencial). Puedes reclasificar manualmente o dejar que la IA lo haga.',
    keywords: ['tier', 'clasificación', 'diamond', 'vibranium', 'antimatter', 'prioridad'],
    priority: 85
  },
  {
    category: 'faq',
    module: 'growth',
    title: 'Automatizar outreach',
    content: 'Para automatizar outreach: 1) Selecciona leads 2) Crea una secuencia de emails/mensajes 3) Programa envíos automáticos 4) Trackea aperturas y respuestas. El sistema registra todas las interacciones para análisis.',
    keywords: ['outreach', 'automatizar', 'emails', 'secuencia', 'campaña'],
    priority: 80
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AD FACTORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'ad_factory',
    title: 'Qué es Ad Factory',
    content: 'Ad Factory es el módulo para crear anuncios publicitarios optimizados. Genera creatividades, copys y variaciones para Facebook Ads, Google Ads, Instagram y más. Usa IA para optimizar CTAs y diseños.',
    keywords: ['ad', 'factory', 'anuncios', 'publicidad', 'ads', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'ad_factory',
    title: 'Crear un anuncio con Ad Factory',
    content: 'Para crear un anuncio: 1) Ve a Ad Factory 2) Selecciona la plataforma (Facebook, Google, etc.) 3) Describe tu producto/servicio 4) La IA generará variaciones de copy e imagen 5) Edita y descarga los creativos finales.',
    keywords: ['crear', 'anuncio', 'ad', 'cómo', 'generar'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'ad_factory',
    title: 'Formatos de anuncios disponibles',
    content: 'Ad Factory soporta: Stories (9:16), Feed cuadrado (1:1), Feed horizontal (16:9), Banner web, Carousel. Cada formato se optimiza automáticamente para la plataforma seleccionada.',
    keywords: ['formato', 'tamaño', 'dimensiones', 'stories', 'feed', 'carousel'],
    priority: 75
  },
  {
    category: 'best_practice',
    module: 'ad_factory',
    title: 'Tips para anuncios efectivos',
    content: 'Para mejores anuncios: 1) Un mensaje claro por anuncio 2) CTA visible y urgente 3) Imágenes de alta calidad 4) Testa múltiples variaciones 5) Usa colores que resalten. La IA puede sugerirte mejoras.',
    keywords: ['tips', 'mejores', 'efectivo', 'conversión', 'ctr'],
    priority: 70
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SALES AGENT
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'sales_agent',
    title: 'Qué es Sales Agent',
    content: 'Sales Agent permite crear chatbots de ventas con IA. Estos agentes conversan con visitantes, califican leads, responden FAQs y programan reuniones. Ideales para websites, landing pages y WhatsApp.',
    keywords: ['sales', 'agent', 'chatbot', 'ventas', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'sales_agent',
    title: 'Crear un agente de ventas',
    content: 'Para crear un Sales Agent: 1) Ve a Sales Agent 2) Clic en "Crear Agente" 3) Define personalidad, producto y objetivo 4) Entrénalo con FAQs 5) Obtén el código embed para tu web. El agente aprende de cada conversación.',
    keywords: ['crear', 'agente', 'configurar', 'cómo', 'nuevo'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'sales_agent',
    title: 'Entrenar un Sales Agent',
    content: 'Para entrenar tu agente: 1) Sube documentos de producto 2) Agrega FAQs comunes 3) Define respuestas para objeciones 4) Prueba conversaciones de ejemplo. Cuanta más información, mejor responderá.',
    keywords: ['entrenar', 'mejorar', 'faqs', 'conocimiento', 'documentos'],
    priority: 85
  },
  {
    category: 'faq',
    module: 'sales_agent',
    title: 'Ver conversaciones de Sales Agent',
    content: 'Para ver chats: 1) Ve a Sales Agent 2) Selecciona el agente 3) Pestaña "Conversaciones". Verás historial completo, leads capturados y métricas. Puedes marcar leads como "hot" para seguimiento.',
    keywords: ['conversaciones', 'chats', 'historial', 'ver', 'leads'],
    priority: 80
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BRAZOS (INTEGRACIONES)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'brazos',
    title: 'Qué son los Brazos',
    content: 'Los Brazos son las integraciones con servicios externos. Conecta Google Workspace, Telegram, APIs personalizadas y más. Cada brazo extiende las capacidades de OCTOPUS.',
    keywords: ['brazos', 'integraciones', 'conexiones', 'qué son', 'servicios'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'brazos',
    title: 'Conectar Google Workspace',
    content: 'Para conectar Google: 1) Ve a Brazos 2) Busca "Google Workspace" 3) Clic en "Conectar" 4) Autoriza con tu cuenta Google. Tendrás acceso a Calendar, Drive, Docs, Sheets y Gmail desde OCTOPUS.',
    keywords: ['google', 'workspace', 'conectar', 'calendar', 'drive'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'brazos',
    title: 'Conectar Telegram',
    content: 'Para conectar Telegram: 1) Ve a Brazos 2) Busca "Telegram" 3) Sigue las instrucciones para crear un bot con @BotFather 4) Pega el token del bot. Podrás recibir notificaciones y comandos vía Telegram.',
    keywords: ['telegram', 'bot', 'conectar', 'notificaciones'],
    priority: 85
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTUDIO CREATIVO
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'creative',
    title: 'Qué es Estudio Creativo',
    content: 'El Estudio Creativo es donde generas contenido visual con IA. Crea imágenes, edita fotos, genera variaciones y exporta en múltiples formatos. Integrado con Jarvis para comandos de voz.',
    keywords: ['estudio', 'creativo', 'imágenes', 'diseño', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'creative',
    title: 'Generar imágenes en Estudio Creativo',
    content: 'Para generar imágenes: 1) Ve a Estudio Creativo 2) Describe lo que quieres 3) Selecciona estilo (fotorealista, ilustración, etc.) 4) Clic en "Generar". Puedes refinar con instrucciones adicionales.',
    keywords: ['generar', 'imagen', 'crear', 'estudio', 'cómo'],
    priority: 90
  },
  {
    category: 'faq',
    module: 'creative',
    title: 'Estilos de imagen disponibles',
    content: 'Estilos disponibles: Fotorealista, Ilustración, 3D Render, Anime, Pixel Art, Oil Painting, Watercolor, Minimalist, y más. Cada estilo tiene variaciones que puedes explorar.',
    keywords: ['estilos', 'tipos', 'formatos', 'arte', 'diseño'],
    priority: 75
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MCP FACTORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'mcp',
    title: 'Qué es MCP Factory',
    content: 'MCP Factory permite crear servidores MCP (Model Context Protocol) personalizados. Los MCPs extienden las capacidades de la IA con herramientas específicas para tu negocio.',
    keywords: ['mcp', 'factory', 'servidores', 'tools', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'mcp',
    title: 'Para qué usar MCP',
    content: 'Usa MCP para: 1) Conectar APIs propietarias a la IA 2) Crear herramientas personalizadas 3) Automatizar flujos específicos de tu negocio 4) Extender Jarvis con nuevas capacidades.',
    keywords: ['usar', 'para qué', 'casos', 'ejemplos', 'utilidad'],
    priority: 85
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HOGAR INTELIGENTE (IoT)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'hogar',
    title: 'Qué es Hogar Inteligente',
    content: 'El módulo Hogar Inteligente controla dispositivos IoT de tu casa u oficina. Conecta luces, sensores, termostatos y más. Controla todo con Jarvis: "Enciende las luces del living".',
    keywords: ['hogar', 'inteligente', 'iot', 'casa', 'dispositivos', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'hogar',
    title: 'Conectar dispositivos IoT',
    content: 'Para conectar dispositivos: 1) Ve a Hogar Inteligente 2) Clic en "Agregar Dispositivo" 3) Selecciona tipo y protocolo (WiFi, Zigbee, etc.) 4) Sigue el asistente de configuración. Luego controla desde Jarvis.',
    keywords: ['conectar', 'agregar', 'dispositivo', 'iot', 'configurar'],
    priority: 90
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // WEB INTELLIGENCE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'web_intel',
    title: 'Qué es Web Intelligence',
    content: 'Web Intelligence analiza sitios web para extraer información estratégica. Analiza competidores, extrae datos de contacto, monitorea cambios y genera reportes automáticos.',
    keywords: ['web', 'intelligence', 'análisis', 'competidores', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'web_intel',
    title: 'Analizar un sitio web',
    content: 'Para analizar un sitio: 1) Ve a Web Intelligence 2) Ingresa la URL 3) Selecciona qué extraer (contactos, precios, estructura, etc.) 4) Ejecuta el análisis. Los resultados se guardan para comparar en el tiempo.',
    keywords: ['analizar', 'sitio', 'web', 'url', 'extraer'],
    priority: 90
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENDA INTELIGENTE
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'calendar',
    title: 'Qué es Agenda Inteligente',
    content: 'Agenda Inteligente gestiona tu calendario y reservas. Crea páginas de booking, sincroniza con Google Calendar, programa reuniones automáticamente y envía recordatorios.',
    keywords: ['agenda', 'calendario', 'reuniones', 'booking', 'qué es'],
    priority: 100
  },
  {
    category: 'faq',
    module: 'calendar',
    title: 'Crear página de booking',
    content: 'Para crear una página de booking: 1) Ve a Agenda Inteligente 2) Clic en "Crear Página" 3) Define tu disponibilidad 4) Personaliza el formulario 5) Comparte el link. Los clientes podrán agendar directamente.',
    keywords: ['booking', 'página', 'reservas', 'crear', 'agendar'],
    priority: 90
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CODE ENGINE — IDE de Desarrollo Web + Octopus Hosting
  // ═══════════════════════════════════════════════════════════════════════════
  {
    category: 'module',
    module: 'claude-code',
    title: 'Qué es Code Engine',
    content: 'Code Engine es el IDE de desarrollo web impulsado por IA dentro de OCTOPUS. Permite crear sitios web completos desde descripciones en lenguaje natural usando Claude AI. Incluye preview en vivo, iteración conversacional y sistema de hosting integrado con Octopus Hosting. Es como tener un desarrollador web experto que construye tu sitio mientras conversas.',
    keywords: ['code engine', 'ide', 'desarrollo', 'web', 'código', 'programar', 'sitio web', 'claude'],
    priority: 100
  },
  {
    category: 'feature',
    module: 'claude-code',
    title: 'Cómo publicar un sitio con Octopus Hosting',
    content: 'Para publicar tu sitio con Octopus Hosting: 1) Crea o edita tu sitio en Code Engine usando lenguaje natural 2) Click en el botón "Publish" (🚀) en la barra superior del preview 3) Se abre el Publish Drawer — selecciona "🐙 Octopus" 4) Click en publicar — en segundos tu sitio está en vivo en sitios.octopuskills.com/tu-proyecto 5) Aparece una barra verde LIVE indicando que está desplegado. Es la forma más rápida de publicar: 1 click.',
    keywords: ['publicar', 'publish', 'hosting', 'octopus hosting', 'deploy', 'desplegar', 'sitio en vivo', 'live'],
    priority: 95
  },
  {
    category: 'feature',
    module: 'claude-code',
    title: 'Opciones de hosting y exportación en Code Engine',
    content: 'Code Engine ofrece 5 opciones de hosting/exportación: 1) 🐙 Octopus Hosting — hosting propio, 1-click, recomendado 2) ⚡ GitHub Pages — deploy automático vía GitHub 3) Hostinger — deploy a tu cuenta Hostinger 4) GitHub — push del código a un repositorio 5) ZIP — descargar todo como archivo comprimido. Octopus Hosting es el más rápido y no requiere configuración adicional.',
    keywords: ['hosting', 'github pages', 'hostinger', 'zip', 'exportar', 'descargar', 'github', 'opciones'],
    priority: 90
  },
  {
    category: 'feature',
    module: 'claude-code',
    title: 'Botón Edit y versionado de sitios',
    content: 'Cuando tu sitio está publicado con Octopus Hosting, aparece un botón ✏️ Edit en la barra LIVE. Al hacer click, el cursor se enfoca en el campo de chat para hacer cambios rápidos. Cada vez que publicas una nueva versión, el contador de versiones se incrementa (v1, v2, v3...). En la lista de sesiones del sidebar, cada proyecto publicado muestra: un icono 🐙, un badge con el número de versión (v{N}), un badge LIVE, y el tiempo relativo de última actualización.',
    keywords: ['edit', 'editar', 'versión', 'version', 'versionado', 'contador', 'badge', 'live'],
    priority: 90
  },
  {
    category: 'feature',
    module: 'claude-code',
    title: 'Rollback y historial de versiones',
    content: 'Code Engine guarda automáticamente hasta 10 snapshots de tu sitio cada vez que publicas. Para restaurar una versión anterior: 1) Abre el Publish Drawer (botón 🚀) 2) Ve a la sección "Version History" 3) Verás todas las versiones anteriores con fecha y hora 4) Click en "Restore" en la versión que quieras restaurar. Al hacer rollback, se restaura el HTML de esa versión, el sitio se re-deployea automáticamente, y el número de versión se incrementa (no retrocede). Antes de restaurar, se guarda un snapshot del estado actual como protección.',
    keywords: ['rollback', 'restaurar', 'versión anterior', 'historial', 'version history', 'snapshot', 'revertir', 'deshacer'],
    priority: 95
  },
  {
    category: 'feature',
    module: 'claude-code',
    title: 'Analíticas de sitios publicados',
    content: 'Los sitios publicados con Octopus Hosting tienen analíticas integradas que se activan automáticamente. Para verlas: 1) Abre el Publish Drawer (botón 🚀) 2) Ve a la sección "Analytics" 3) Selecciona el período (7 días o 30 días). Métricas disponibles: Total Views (visitas totales), Unique Paths (páginas únicas visitadas), Countries (países de visitantes), gráfico de barras con visitas por día, Top Pages (páginas más visitadas), Top Referrers (de dónde vienen: Google, redes sociales, directo), Top Countries (distribución geográfica). No necesitas configurar nada — las analíticas se activan automáticamente al publicar.',
    keywords: ['analíticas', 'analytics', 'visitas', 'views', 'estadísticas', 'tráfico', 'referrers', 'países', 'métricas'],
    priority: 90
  },
  {
    category: 'feature',
    module: 'claude-code',
    title: 'Conectar dominio personalizado',
    content: 'Puedes conectar tu propio dominio a un sitio publicado con Octopus Hosting. Pasos: 1) Abre el Publish Drawer → sección "Custom Domain" 2) Ingresa tu subdominio (ej: miapp.tudominio.com) 3) El sistema muestra instrucciones CNAME: agrega un registro CNAME en tu registrador de dominio apuntando a sitios.octopuskills.com 4) Click "Verify DNS" — el sistema verifica tu configuración 5) Una vez verificado, el certificado SSL se genera automáticamente 6) Tu sitio queda disponible en tu dominio con HTTPS. Estados: Pendiente → DNS Verificado → SSL Activo ✅. Nota: necesitas usar un subdominio (CNAME), no el dominio raíz directamente.',
    keywords: ['dominio', 'domain', 'personalizado', 'custom domain', 'CNAME', 'DNS', 'SSL', 'certificado', 'https'],
    priority: 95
  },
  {
    category: 'tip',
    module: 'claude-code',
    title: 'Tips para Code Engine y Octopus Hosting',
    content: 'Tips profesionales para Code Engine: 1) Describe tu sitio con detalle — Claude AI entiende lenguaje natural complejo 2) Usa el botón Edit para iterar rápido sobre tu sitio publicado 3) Octopus Hosting es la opción más rápida para publicar (1-click) 4) Las analíticas se activan solas — no necesitas configurar nada 5) Usa el historial de versiones como "seguro" antes de cambios grandes 6) Los dominios personalizados necesitan un subdominio (CNAME), no el dominio raíz 7) Cada publicación crea un snapshot automático para rollback 8) La barra LIVE verde confirma que tu sitio está en producción.',
    keywords: ['tips', 'consejos', 'mejores prácticas', 'recomendaciones', 'code engine tips'],
    priority: 85
  }
]

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verify user exists (admin check removed - use with caution)
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Clear existing knowledge (optional - comment out to append instead)
    // await prisma.octoKnowledge.deleteMany({})

    // Seed knowledge with embeddings
    let created = 0
    let updated = 0
    let embeddingsGenerated = 0

    for (const item of INITIAL_KNOWLEDGE) {
      // Prepare text for embedding
      const textForEmbedding = prepareTextForEmbedding(item.title, item.content, item.keywords)
      
      // Generate embedding
      let embedding: number[] = []
      try {
        embedding = await generateEmbedding(textForEmbedding)
        if (embedding.length > 0) {
          embeddingsGenerated++
        }
      } catch (err) {
        console.error(`[Seed] Error generating embedding for "${item.title}":`, err)
      }

      const existing = await prisma.octoKnowledge.findFirst({
        where: { title: item.title }
      })

      if (existing) {
        await prisma.octoKnowledge.update({
          where: { id: existing.id },
          data: {
            ...item,
            embedding: embedding.length > 0 ? embedding : existing.embedding,
            updatedAt: new Date()
          }
        })
        updated++
      } else {
        await prisma.octoKnowledge.create({
          data: {
            ...item,
            embedding
          }
        })
        created++
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log(`[ASK Octo Seed] Completed: ${created} created, ${updated} updated, ${embeddingsGenerated} embeddings`)

    return NextResponse.json({
      success: true,
      message: `Knowledge base seeded: ${created} created, ${updated} updated, ${embeddingsGenerated} embeddings generated`,
      total: INITIAL_KNOWLEDGE.length,
      embeddingsGenerated
    })

  } catch (error) {
    console.error('[ASK Octo AI Seed] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const count = await prisma.octoKnowledge.count()
    const knowledge = await prisma.octoKnowledge.findMany({
      orderBy: [{ module: 'asc' }, { priority: 'desc' }],
      select: { id: true, category: true, module: true, title: true, priority: true }
    })

    return NextResponse.json({
      total: count,
      knowledge
    })
  } catch (error) {
    console.error('[ASK Octo AI Seed] Error:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
