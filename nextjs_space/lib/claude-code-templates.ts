// Client-safe code templates for Claude Code (no server imports)

export interface CodeTemplate {
  id: string
  name: string
  icon: string
  gradient: string // tailwind gradient classes for card bg
  accent: string   // hex accent color
  description: string
  descriptionEn: string
  prompt: string
  category: 'frontend' | 'fullstack'
  techStack?: string[] // shown as badges on card
}

export const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: 'saas-dark',
    name: 'SaaS Dark',
    icon: '🚀',
    gradient: 'from-violet-600 via-purple-600 to-indigo-700',
    accent: '#8B5CF6',
    description: 'Landing SaaS premium estilo Apple — glassmorphism, particles, pricing',
    descriptionEn: 'Premium Apple-style SaaS landing with glass, particles, pricing',
    category: 'frontend',
    techStack: ['HTML', 'CSS', 'JS'],
    prompt: `Construye una landing page SaaS de nivel Awwwards en landing/index.html + landing/style.css + landing/script.js.

DESIGN SYSTEM:
- Fondo: #050510 (NOT pure black). Accent: #8B5CF6 (violeta) + #06B6D4 (cyan).
- Tipografía: Inter (Google Fonts) — 800 para headlines, 400-500 para body.
- Hero headline: clamp(2.5rem, 5vw + 1rem, 4.5rem), font-weight 800, line-height 1.1, letter-spacing -0.03em.
- Gradient text en headline: linear-gradient(135deg, #fff 0%, #8B5CF6 50%, #06B6D4 100%).
- Body text: 16px, color rgba(255,255,255,0.70), line-height 1.6.

SECCIONES (en este orden, con <!--SECTION:name--> markers):

1. HEADER — sticky top-0 z-50, glassmorphism (backdrop-filter blur(20px), bg rgba(5,5,16,0.80), border-bottom 1px rgba(255,255,255,0.06)). Logo text "NexusAI" (left), links Producto/Precios/FAQ (center, hidden mobile), botón "Comenzar gratis" pill (right). Hamburger mobile. Header cambia opacidad en scroll.

2. HERO — max-w-[680px] centrado. Particles (15-20 divs flotantes, 2-6px, @keyframes float). Eyebrow pill: "✨ Usado por +2,700 equipos" (11px, uppercase, letter-spacing 0.15em, bg rgba(139,92,246,0.15), border rgba(139,92,246,0.30)). Headline con gradient text. Subheadline: "Automatiza tus flujos de trabajo con inteligencia artificial avanzada. Más rápido, más inteligente, sin fricción." (18px, max-w-[512px], rgba(255,255,255,0.65)). Dos botones: "Empezar ahora" (pill gradient #8B5CF6→#06B6D4, sombra glow 0 0 40px rgba(139,92,246,0.35), hover translateY(-2px)) + "Ver demo" (ghost, border rgba(255,255,255,0.15)). Social proof: 5 estrellas doradas + "4.9/5 — 2,700+ usuarios".

3. LOGOS — Marquee infinito. 6 logos como texto estilizado (Stripe, Notion, Vercel, Linear, Figma, Slack). @keyframes marquee translateX(0)→translateX(-50%), 25s linear infinite. Items duplicados. Pause on hover.

4. FEATURES — Título de sección: "Todo lo que necesitas" (clamp 1.8rem-2.8rem, font-weight 700). Grid 1-col mobile → 3-col desktop, gap-24px. 6 cards: bg rgba(255,255,255,0.03), border 1px rgba(255,255,255,0.06), border-radius 20px, padding 32px. Hover: translateY(-6px), border-color rgba(139,92,246,0.30), box-shadow 0 20px 60px rgba(0,0,0,0.3). Cada card: ícono Lucide (24px, color accent), título (18px, font-weight 600), descripción (14px, rgba(255,255,255,0.60)). Features: Automatización IA, Analítica en Tiempo Real, Integraciones, Seguridad Empresarial, Colaboración, API Abierta.

5. PRICING — Título: "Precios simples, sin sorpresas". Grid 1→3 col. 3 planes: Free ($0/mes), Pro ($49/mes, badge "Popular"), Enterprise ($149/mes). Cards: rounded-[32px], padding 40px. Plan Pro destacado con border 2px solid #8B5CF6 y glow sutil. Cada plan: nombre, precio (text-4xl), período, lista de 5 features con checkmarks, botón CTA. Toggle mensual/anual (anual = 20% descuento).

6. FAQ — Título: "Preguntas frecuentes". 4 preguntas con accordion (click para expandir, transición max-height 0.4s ease). Preguntas realistas sobre el producto SaaS.

7. FOOTER — Simple. Logo "NexusAI" (left). 2 columnas de links (Producto, Empresa). Copyright bar. Max 3-4 links por columna.

IMAGES: Genera UNA imagen hero con generate_image: "Abstract futuristic AI neural network visualization, glowing violet and cyan nodes connected by luminous threads on deep dark background, 8K quality, cinematic depth of field" (aspect_ratio: "16:9").

MOTION: fadeInUp en todas las secciones (IntersectionObserver, threshold 0.1, stagger 0.1s). Header scroll behavior. Smooth scroll para anchor links. Marquee infinito.

RESPONSIVE: 3 breakpoints exactos según §14 del Design System.`,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    icon: '🎨',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    accent: '#F59E0B',
    description: 'Portfolio estudio creativo estilo Viktor Oddy — serif accents, scroll storytelling',
    descriptionEn: 'Creative studio portfolio — serif accents, scroll storytelling',
    category: 'frontend',
    techStack: ['HTML', 'CSS', 'JS'],
    prompt: `Construye un portfolio de estudio creativo en portfolio/index.html + portfolio/style.css + portfolio/script.js.

DESIGN SYSTEM:
- Fondo: #FFFFFF. Texto primario: #051A24. Texto secundario: rgba(5,26,36,0.65).
- Tipografía: Inter (body, Google Fonts wght 400;500;600;700) + "Playfair Display" (accent serif, Google Fonts wght 400;700, italic).
- Hero headline: text-[36px] md:text-[48px] lg:text-[56px], font-weight 700, line-height 1.1, letter-spacing -0.03em.
- Palabras clave en Playfair Display italic para contraste tipográfico elegante.

SECCIONES (con <!--SECTION:name--> markers):

1. HEADER — absolute top-0, z-50, transparent sobre hero. Logo "Vortex Studio" en Playfair Display (left), links Proyectos/Sobre/Contacto (center, hidden mobile), botón "Iniciar proyecto" pill negro bg-[#051A24] text-white rounded-full px-28px py-12px (right). Box-shadow premium tactile (6 capas).

2. HERO — max-w-[480px] centrado, pt-80px. Logo "V" en Playfair Display (text-[40px]). Tagline: "El estudio creativo de Vortex" (font-mono, 12px). Headline: "Diseñamos la próxima ola, con audacia." donde "próxima ola" y "audacia" van en Playfair Display italic. 3 párrafos descriptivos (text-[15px], leading-relaxed, gap-24px entre párrafos): sobre experiencia, equipo compacto, precio "Proyectos desde $5,000/mes". Dos botones: "Iniciar chat" (pill negro con shadow tactile 6-layer) + "Ver proyectos" (pill blanco, shadow sutil 0 0 0 0.5px rgba(0,0,0,0.05), 0 4px 30px rgba(0,0,0,0.08)).

3. MARQUEE — mt-64px. Strip horizontal de imágenes. Genera 3 imágenes con IA (16:9 cada una): "Modern SaaS dashboard dark theme with glassmorphism cards, violet accent lighting, professional UI screenshot", "Elegant e-commerce product page with minimalist design, warm lighting, luxury feel", "Creative portfolio website with bold typography and cinematic hero image". h-[280px] md:h-[500px], rounded-2xl, shadow-lg, gap-12px. @keyframes marquee 30s desktop, 12s mobile.

4. TESTIMONIAL — Ícono quote (SVG). Cita grande: 'Dejé Apple para construir el estudio con el que siempre quise trabajar' donde "Apple" va en Playfair Display. text-[36px] md:text-[48px], leading-1.1, color #0D212C. Autor: "Viktor Oddy" italic. 3 logos como texto: "Apple" (Georgia serif), "IDEO", "Polygon".

5. PRICING — Grid 1-col → 2-col. 2 cards rounded-[40px], px-40px pt-12px pb-40px. Card 1 (dark): bg-[#051A24], text #F6FCFF. "Membresía Mensual", "$5,000/mes". Card 2 (light): bg-white, shadow 0 4px 16px rgba(0,0,0,0.08). "Proyecto Custom", "Desde $5,000".

6. PROJECTS — Stack vertical, gap-80px. 3 proyectos. Cada uno: texto con ml-80px md:ml-112px (nombre en Playfair Display 28px font-semibold + descripción 15px text-secondary), imagen full-width debajo (usa las mismas imágenes generadas del marquee, reutiliza PUBLIC_URLs). fadeInUp individual por proyecto.

7. FOOTER — Botón "Iniciar chat" (left). 2 columnas de links: Servicios/Proyectos/Sobre (col 1), x.com/LinkedIn (col 2, target _blank).

8. COPYRIGHT — "Vortex Studio Limited" (left), "Austin, USA" (right). text-sm.

MOTION: fadeInUp en todas las secciones (0.8s ease-out, stagger 0.1s increments). Marquee infinito. Smooth scroll. Header scroll behavior (bg cambia a blanco con opacity en scroll).

RESPONSIVE: §14 completo. Mobile hamburger overlay.`,
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    icon: '🛒',
    gradient: 'from-emerald-500 via-teal-500 to-cyan-600',
    accent: '#10B981',
    description: 'Tienda online premium — product grid, hero cinematográfico, carrito',
    descriptionEn: 'Premium online store — product grid, cinematic hero, cart',
    category: 'frontend',
    techStack: ['HTML', 'CSS', 'JS'],
    prompt: `Construye una landing de tienda online premium en tienda/index.html + tienda/style.css + tienda/script.js.

DESIGN SYSTEM:
- Fondo: #0C1222 (azul muy oscuro). Accent: #F97316 (naranja vibrante). Secundario: #10B981 (verde para badges).
- Tipografía: Inter (Google Fonts wght 400;500;600;700;800). Headlines 800, body 400.
- Hero headline: clamp(2.5rem, 5vw + 1rem, 4rem), font-weight 800, line-height 1.1, letter-spacing -0.02em.

SECCIONES (con <!--SECTION:name--> markers):

1. HEADER — sticky top-0 z-50, glassmorphism dark (blur 20px, bg rgba(12,18,34,0.85)). Logo "LUMINA" text-xl font-bold (left). Links: Colecciones/Ofertas/Nuevos (center). Derecha: ícono búsqueda (Lucide Search) + ícono carrito con badge numérico naranja (Lucide ShoppingBag) + hamburger mobile.

2. HERO — Full-width. CSS mesh gradient: radial-gradient(at 20% 80%, rgba(249,115,22,0.12) 0%, transparent 50%), radial-gradient(at 80% 20%, rgba(16,185,129,0.08) 0%, transparent 50%). Contenido 2 columnas md: Izquierda: eyebrow "🔥 Colección 2025" (11px uppercase ls 0.15em, color #F97316), headline "Tecnología que transforma tu vida", subheadline "Descubre productos seleccionados con diseño excepcional y rendimiento superior." (16px, rgba(255,255,255,0.65)), botón "Explorar colección" (pill gradient naranja→ámbar, arrow icon). Derecha: imagen generada.

3. CATEGORIES — 4 cards en grid 2×2 mobile, 4-col desktop. Cada card: rounded-[24px], bg rgba(255,255,255,0.04), border rgba(255,255,255,0.06), padding 32px, hover translateY(-6px). Categorías con ícono Lucide + nombre + "X productos": Electrónica (Smartphone), Audio (Headphones), Hogar (Home), Deportes (Dumbbell). Texto 16px font-semibold.

4. PRODUCTS — Título: "Productos Destacados" (gradient text naranja→ámbar). Grid 1→2→3 col. 6 producto cards: rounded-[20px], bg rgba(255,255,255,0.03), overflow hidden. Imagen (genera 3 con IA + reutiliza URLs para los 6): "Premium wireless headphones on matte black surface, soft studio lighting, product photography, 4K" (1:1), "Sleek smartwatch with dark face on marble surface, dramatic side lighting" (1:1), "Modern minimalist desk lamp, warm glow, lifestyle product shot" (1:1). Badges: "-30%" (bg #10B981 text white, absolute top-12 right-12), "Nuevo" (bg #F97316). Nombre producto (16px, font-semibold), precio actual ($X) en blanco + precio tachado ($X) en rgba(255,255,255,0.40). Botón "Agregar" (pill naranja, full-width, hover glow). Productos: AirPods Max Pro ($349, antes $499), Galaxy Watch Ultra ($299), Lámpara Dyson Soleil ($189), Teclado Mecánico MX ($159, antes $219), Cámara Instant Retro ($129), Altavoz Bang & Olufsen ($449).

5. BENEFITS — 3 columnas con íconos. "Envío gratis en 24h" (Truck), "Garantía de 2 años" (Shield), "Soporte 24/7" (Headset). Cada beneficio: ícono en círculo con bg gradient naranja (48px), título 16px font-semibold, descripción 14px rgba(255,255,255,0.55).

6. NEWSLETTER — bg rgba(249,115,22,0.06), border rgba(249,115,22,0.15), rounded-[32px], padding 48px. Título: "Ofertas exclusivas en tu inbox". Input email (bg rgba(255,255,255,0.05), rounded-full, padding 16px) + botón "Suscribirme" (pill naranja).

7. FOOTER — Logo "LUMINA", 3 columnas: Tienda (Colecciones/Ofertas/Nuevos), Ayuda (Envíos/Devoluciones), Legal (Términos/Privacidad). Copyright bar.

IMAGES: Genera 3 product images + 1 hero image (4 generate_image actions total). Hero: "Modern tech lifestyle flat lay with premium gadgets on dark surface, warm accent lighting, cinematic composition, 4K" (16:9).

MOTION: fadeInUp. Marquee con logos "Envío 24h • Garantía 2 años • +50K clientes • Devolución gratis" en loop. Header scroll. Cards hover elevation.

RESPONSIVE: §14 completo.`,
  },
  // ═══════════════════════════════════ FULL-STACK TEMPLATES ═══════════════════════════════════
  {
    id: 'saas-dashboard',
    name: 'SaaS Dashboard',
    icon: '📊',
    gradient: 'from-violet-600 via-purple-600 to-indigo-700',
    accent: '#8B5CF6',
    description: 'App SaaS completa: auth, dashboard analytics, gestión de usuarios, suscripciones y API REST. Full-stack con base de datos.',
    descriptionEn: 'Complete SaaS app: auth, analytics dashboard, user management, subscriptions and REST API. Full-stack with database.',
    category: 'fullstack',
    techStack: ['Next.js', 'Prisma', 'Auth'],
    prompt: `Crea una aplicación SaaS Dashboard full-stack con las siguientes páginas y funcionalidad:

## MODELOS DE BASE DE DATOS (Prisma)
Crea estos modelos en un archivo schema.prisma parcial:
- SaasUser: id, email, name, role (ADMIN/USER), avatarUrl, createdAt, updatedAt
- Subscription: id, saasUserId (relación), plan (FREE/PRO/ENTERPRISE), status (ACTIVE/CANCELLED/PAST_DUE), currentPeriodEnd, createdAt
- AnalyticsEvent: id, saasUserId (relación), eventType, metadata (Json), createdAt
- Invoice: id, subscriptionId (relación), amount (Float), currency, status (PAID/PENDING/FAILED), paidAt, createdAt

Después de crear los archivos de schema, ejecuta: yarn prisma db push && yarn prisma generate

## API ROUTES
Crea estos endpoints en app/api/saas/:
- GET/POST /api/saas/users — listar usuarios con paginación y filtros, crear usuario
- GET/PUT /api/saas/users/[id] — detalle y actualización de usuario
- GET/POST /api/saas/subscriptions — listar y crear suscripciones
- GET /api/saas/analytics/overview — métricas: MRR, usuarios activos, churn rate, revenue growth
- GET /api/saas/analytics/events — eventos con filtros por tipo y fecha
- GET /api/saas/invoices — listar facturas con filtros

Todos los endpoints deben usar try/catch, validar inputs, y devolver respuestas JSON consistentes.

## PÁGINAS FRONTEND
1. /saas/dashboard — Dashboard principal con 4 KPI cards (MRR, Active Users, Churn, Revenue), gráfico de líneas (últimos 12 meses), tabla de actividad reciente, distribución de planes (donut chart)
2. /saas/users — Tabla de usuarios con búsqueda, filtros por rol/plan, paginación. Botón para crear usuario (modal)
3. /saas/subscriptions — Vista de suscripciones activas, métricas de planes, tabla con filtros
4. /saas/invoices — Lista de facturas con estado, filtros por fecha y estado

## COMPONENTES
- KPICard: ícono, título, valor, porcentaje de cambio (verde/rojo), sparkline mini
- DataTable: genérica, con sorting, paginación, búsqueda
- Chart wrappers: usar recharts (LineChart, PieChart, BarChart)
- Modal de creación/edición de usuario
- Sidebar de navegación para /saas/* con íconos Lucide

## DISEÑO
- Estilo: dark theme con sidebar colapsable, bg slate-950, cards con bg slate-900/50 y border slate-800
- Gradientes violeta/púrpura para acentos
- Responsive: sidebar → bottom nav en mobile
- Animaciones suaves en cards y transiciones de página

## SEED DATA
Genera datos realistas de ejemplo directamente en el dashboard (fetch on mount, si no hay datos crear samples via API).`,
  },
  {
    id: 'blog-cms',
    name: 'Blog CMS',
    icon: '✍️',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
    accent: '#10B981',
    description: 'Blog con panel admin, editor Markdown, categorías, tags, borradores y publicación. Full-stack con API y base de datos.',
    descriptionEn: 'Blog with admin panel, Markdown editor, categories, tags, drafts and publishing. Full-stack with API and database.',
    category: 'fullstack',
    techStack: ['Next.js', 'Prisma', 'Auth'],
    prompt: `Crea un sistema Blog CMS full-stack con panel de administración:

## MODELOS DE BASE DE DATOS (Prisma)
Crea estos modelos en un archivo schema.prisma parcial:
- BlogPost: id, title, slug (unique), content (texto largo), excerpt, coverImage, status (DRAFT/PUBLISHED/ARCHIVED), authorId (relación a BlogAuthor), categoryId (relación), publishedAt, viewCount (Int default 0), createdAt, updatedAt
- BlogAuthor: id, name, email, bio, avatarUrl, createdAt
- BlogCategory: id, name, slug (unique), description, color (hex), postCount (Int default 0)
- BlogTag: id, name, slug (unique)
- BlogPostTag: id, postId, tagId (relación many-to-many)
- BlogComment: id, postId (relación), authorName, authorEmail, content, approved (Boolean default false), createdAt

Después de crear los archivos de schema, ejecuta: yarn prisma db push && yarn prisma generate

## API ROUTES
Crea estos endpoints en app/api/blog/:
- GET/POST /api/blog/posts — listar posts (con filtros: status, category, tag, search) y crear post
- GET/PUT/DELETE /api/blog/posts/[slug] — CRUD por slug
- GET/POST /api/blog/categories — listar y crear categorías
- GET/POST /api/blog/tags — listar y crear tags
- GET/PUT /api/blog/comments — listar comentarios (pendientes de aprobación) y aprobar/rechazar
- POST /api/blog/posts/[slug]/comments — añadir comentario público
- GET /api/blog/stats — estadísticas: total posts, vistas, comentarios pendientes, posts por mes

## PÁGINAS FRONTEND

### Blog Público (lectura)
1. /blog — Lista de posts publicados: cards con imagen, título, excerpt, autor, fecha, categoría. Sidebar con categorías y tags populares. Paginación
2. /blog/[slug] — Post completo: renderizado Markdown→HTML, imagen cover, info autor, tags, sección de comentarios, posts relacionados
3. /blog/category/[slug] — Posts filtrados por categoría

### Panel Admin
4. /blog/admin — Dashboard: stats cards (total posts, vistas totales, borradores, comentarios pendientes), gráfico de posts por mes, actividad reciente
5. /blog/admin/posts — Tabla de todos los posts con filtros, búsqueda, acciones (editar, eliminar, cambiar status)
6. /blog/admin/posts/new — Editor de post: campo título, editor Markdown con preview en tiempo real, selector de categoría, input de tags (autocomplete), upload de imagen cover, botones Guardar Borrador / Publicar
7. /blog/admin/posts/[slug]/edit — Editar post existente (mismo form que new, precargado)
8. /blog/admin/categories — CRUD de categorías con color picker
9. /blog/admin/comments — Moderación: lista de comentarios pendientes con aprobar/rechazar

## COMPONENTES
- MarkdownEditor: textarea con toolbar (bold, italic, headers, link, image, code block) + preview panel lado a lado
- PostCard: imagen, categoría badge, título, excerpt, autor avatar+nombre, fecha
- StatsCard: ícono, label, valor, trend
- CommentSection: lista de comentarios aprobados + formulario para nuevo comentario
- TagInput: input con autocomplete y chips removibles
- CategoryBadge: pill con color de la categoría

## DISEÑO
- Blog público: clean, tipografía serif para contenido, fondo blanco/slate-50, acentos emerald
- Admin panel: dark sidebar, contenido en fondo slate-50, cards blancas con shadow-sm
- Responsive: grid adaptable, editor stack en mobile
- Transiciones suaves, skeleton loaders

## SEED DATA
Genera 6 posts de ejemplo (3 publicados, 2 borradores, 1 archivado), 4 categorías (Tech, Design, Business, Tutorial), 8 tags, 2 autores, y 5 comentarios.`,
  },
  {
    id: 'crm-mini',
    name: 'CRM Pipeline',
    icon: '🤝',
    gradient: 'from-amber-500 via-orange-600 to-red-600',
    accent: '#F59E0B',
    description: 'Mini CRM: gestión de contactos, deals con pipeline drag-and-drop, actividades y reportes. Full-stack con API y base de datos.',
    descriptionEn: 'Mini CRM: contact management, deals with drag-and-drop pipeline, activities and reports. Full-stack with API and database.',
    category: 'fullstack',
    techStack: ['Next.js', 'Prisma', 'Auth'],
    prompt: `Crea un sistema CRM Mini full-stack con pipeline de ventas:

## MODELOS DE BASE DE DATOS (Prisma)
Crea estos modelos en un archivo schema.prisma parcial:
- CrmContact: id, firstName, lastName, email (unique), phone, company, position, source (WEB/REFERRAL/SOCIAL/COLD), notes, createdAt, updatedAt
- CrmDeal: id, title, value (Float), currency (default "USD"), stage (LEAD/QUALIFIED/PROPOSAL/NEGOTIATION/WON/LOST), contactId (relación), probability (Int), expectedCloseDate, notes, createdAt, updatedAt
- CrmActivity: id, type (CALL/EMAIL/MEETING/NOTE/TASK), title, description, dealId (relación opcional), contactId (relación), completed (Boolean default false), dueDate, createdAt
- CrmPipelineStage: id, name, order (Int), color (hex), dealCount (Int default 0), totalValue (Float default 0)

Después de crear los archivos de schema, ejecuta: yarn prisma db push && yarn prisma generate

## API ROUTES
Crea estos endpoints en app/api/crm/:
- GET/POST /api/crm/contacts — listar contactos (búsqueda, filtros por source) y crear contacto
- GET/PUT/DELETE /api/crm/contacts/[id] — CRUD de contacto
- GET/POST /api/crm/deals — listar deals (filtros por stage, contacto) y crear deal
- PUT /api/crm/deals/[id] — actualizar deal (incluyendo cambio de stage para drag-and-drop)
- PATCH /api/crm/deals/[id]/stage — endpoint específico para mover deal entre stages
- GET/POST /api/crm/activities — listar y crear actividades
- PUT /api/crm/activities/[id] — marcar actividad completada
- GET /api/crm/dashboard/stats — KPIs: pipeline total value, win rate, deals por stage, revenue mensual
- GET /api/crm/dashboard/forecast — pronóstico: deals ponderados por probabilidad

## PÁGINAS FRONTEND
1. /crm/dashboard — KPI cards (Pipeline Value, Win Rate, Deals Activos, Revenue Mes), gráfico de barras (deals por stage), gráfico de líneas (revenue últimos 6 meses), lista de actividades pendientes, deals por cerrar esta semana
2. /crm/pipeline — Vista Kanban drag-and-drop: columnas por stage (Lead→Qualified→Proposal→Negotiation→Won/Lost), cada deal card muestra título, contacto, valor, probabilidad. Drag entre columnas actualiza el stage via API
3. /crm/contacts — Tabla de contactos con búsqueda, filtros, click para ver detalle. Modal/drawer de creación rápida
4. /crm/contacts/[id] — Perfil de contacto: info completa, deals asociados, historial de actividades, timeline
5. /crm/activities — Lista de actividades con filtros (tipo, completadas/pendientes), calendario mini, crear actividad rápida

## COMPONENTES
- KanbanBoard: columnas draggables con CSS-based drag. Columnas con header (nombre stage, count, total value)
- DealCard: compact card con título, empresa, valor formateado, badge probabilidad (color coded), días en stage
- ContactCard: avatar placeholder (iniciales), nombre, empresa, email, fuente badge
- ActivityItem: ícono por tipo, título, descripción truncada, fecha, checkbox completar
- StatsCard: ícono, label, valor con formato moneda, trend arrow
- QuickAddModal: formulario rápido para crear deal/contacto/actividad

## DISEÑO
- Estilo: fondo slate-50, sidebar dark (slate-900), cards blancas con shadow y rounded-xl
- Kanban: columnas con bg slate-100, deal cards blancas con left-border color del stage
- Acentos amber/orange para CTA y highlights
- Responsive: kanban horizontal scroll en mobile, tablas → cards en mobile
- Hover effects suaves, transiciones de drag, skeleton loaders

## SEED DATA
Genera 8 contactos, 12 deals distribuidos en todos los stages, 15 actividades (mix de tipos, algunas completadas), y 6 stages de pipeline con colores.`,
  },
]
