// Tipos para Project Foundry

export type ProjectType = 'landing' | 'saas' | 'ecommerce' | 'portfolio' | 'dashboard' | 'api'

// Industry Templates
export interface IndustryTemplate {
  id: string
  name: string
  industry: string
  icon: string
  color: string
  gradient: string
  description: string
  sections: string[]
  projectType: ProjectType
  previewColors: { primary: string; accent: string; bg: string }
}

export const INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    id: 'restaurant',
    name: 'Restaurante Digital',
    industry: 'Gastronomía',
    icon: '🍽️',
    color: '#C4622D',
    gradient: 'from-[#C4622D] to-[#8B4513]',
    description: 'Menú digital, reservas online, galería de platos y opiniones',
    sections: ['Hero con foto principal', 'Menú interactivo', 'Galería de platos', 'Reservas', 'Ubicación y horarios', 'Opiniones'],
    projectType: 'landing',
    previewColors: { primary: '#C4622D', accent: '#FFD700', bg: '#1A1A1A' },
  },
  {
    id: 'realestate',
    name: 'Inmobiliaria Pro',
    industry: 'Bienes Raíces',
    icon: '🏠',
    color: '#2D4A3E',
    gradient: 'from-[#2D4A3E] to-[#1a2e27]',
    description: 'Listings de propiedades, búsqueda avanzada, tours virtuales',
    sections: ['Hero con búsqueda', 'Propiedades destacadas', 'Filtros avanzados', 'Detalle de propiedad', 'Agentes', 'Contacto'],
    projectType: 'landing',
    previewColors: { primary: '#2D4A3E', accent: '#C4622D', bg: '#F5F0E8' },
  },
  {
    id: 'fitness',
    name: 'Fitness Studio',
    industry: 'Salud & Fitness',
    icon: '💪',
    color: '#6366F1',
    gradient: 'from-[#6366F1] to-[#4338CA]',
    description: 'Horarios de clases, membresías, entrenadores y reservas',
    sections: ['Hero motivacional', 'Clases y horarios', 'Entrenadores', 'Planes y precios', 'Testimonios', 'Registro'],
    projectType: 'landing',
    previewColors: { primary: '#6366F1', accent: '#F59E0B', bg: '#0F0F0F' },
  },
  {
    id: 'agency',
    name: 'Agencia Creativa',
    industry: 'Marketing & Diseño',
    icon: '🎨',
    color: '#EC4899',
    gradient: 'from-[#EC4899] to-[#BE185D]',
    description: 'Portafolio de trabajos, servicios, equipo y caso de estudio',
    sections: ['Hero creativo', 'Servicios', 'Portafolio', 'Equipo', 'Casos de éxito', 'Contacto'],
    projectType: 'portfolio',
    previewColors: { primary: '#EC4899', accent: '#FFD700', bg: '#0A0A0A' },
  },
  {
    id: 'saas_startup',
    name: 'SaaS Startup',
    industry: 'Tecnología',
    icon: '🚀',
    color: '#14B8A6',
    gradient: 'from-[#14B8A6] to-[#0D9488]',
    description: 'Landing de producto SaaS con features, pricing y signup',
    sections: ['Hero con demo', 'Problema/Solución', 'Features', 'Pricing', 'Testimonios', 'CTA final'],
    projectType: 'saas',
    previewColors: { primary: '#14B8A6', accent: '#F59E0B', bg: '#111827' },
  },
  {
    id: 'ecommerce_store',
    name: 'Tienda Online',
    industry: 'E-Commerce',
    icon: '🛍️',
    color: '#F59E0B',
    gradient: 'from-[#F59E0B] to-[#D97706]',
    description: 'Catálogo de productos, carrito, checkout y gestión de pedidos',
    sections: ['Hero con ofertas', 'Categorías', 'Productos destacados', 'Carrito', 'Checkout', 'Newsletter'],
    projectType: 'ecommerce',
    previewColors: { primary: '#F59E0B', accent: '#1A1A1A', bg: '#FFFFFF' },
  },
  {
    id: 'consulting',
    name: 'Consultoría Pro',
    industry: 'Negocios',
    icon: '📊',
    color: '#1E40AF',
    gradient: 'from-[#1E40AF] to-[#1E3A8A]',
    description: 'Servicios de consultoría, equipo experto, casos de éxito',
    sections: ['Hero profesional', 'Servicios', 'Metodología', 'Equipo', 'Resultados', 'Agendar llamada'],
    projectType: 'landing',
    previewColors: { primary: '#1E40AF', accent: '#FFD700', bg: '#0F172A' },
  },
  {
    id: 'landing_page',
    name: 'Landing Page Pro',
    industry: 'Marketing Digital',
    icon: '🎯',
    color: '#0EA5E9',
    gradient: 'from-[#0EA5E9] to-[#0369A1]',
    description: 'Landing page de alta conversión con hero impactante, social proof, beneficios y CTA optimizado',
    sections: ['Hero con headline magnético', 'Logos de clientes / Social proof', 'Beneficios con íconos', 'Cómo funciona (3 pasos)', 'Testimonios con foto', 'Pricing / Oferta', 'FAQ acordeón', 'CTA final con urgencia'],
    projectType: 'landing',
    previewColors: { primary: '#0EA5E9', accent: '#F97316', bg: '#0C1222' },
  },
  {
    id: 'blank',
    name: 'Proyecto en Blanco',
    industry: 'Personalizado',
    icon: '✨',
    color: '#8B5CF6',
    gradient: 'from-[#8B5CF6] to-[#7C3AED]',
    description: 'Empieza desde cero — tú defines todo con ayuda de OCTOPUS',
    sections: [],
    projectType: 'landing',
    previewColors: { primary: '#8B5CF6', accent: '#C4622D', bg: '#1A1A1A' },
  },
]

export interface ProjectConfig {
  type: ProjectType
  name: string
  description: string
  icon: string
  color: string
  features: string[]
}

export const PROJECT_TYPES: Record<ProjectType, ProjectConfig> = {
  landing: {
    type: 'landing',
    name: 'Landing Page',
    description: 'Página de aterrizaje con sección hero, features y CTA',
    icon: 'layout',
    color: '#2D4A3E',
    features: ['Hero Section', 'Features Grid', 'Testimonials', 'CTA', 'Footer'],
  },
  saas: {
    type: 'saas',
    name: 'SaaS Application',
    description: 'Aplicación SaaS con dashboard, auth y billing',
    icon: 'cloud',
    color: '#C4622D',
    features: ['Auth System', 'Dashboard', 'User Settings', 'Billing', 'API'],
  },
  ecommerce: {
    type: 'ecommerce',
    name: 'E-Commerce',
    description: 'Tienda online con carrito y checkout',
    icon: 'shopping-cart',
    color: '#22c55e',
    features: ['Product Catalog', 'Shopping Cart', 'Checkout', 'Orders', 'Admin'],
  },
  portfolio: {
    type: 'portfolio',
    name: 'Portfolio',
    description: 'Sitio personal o de agencia con proyectos',
    icon: 'briefcase',
    color: '#8b5cf6',
    features: ['About Section', 'Projects Gallery', 'Contact Form', 'Blog'],
  },
  dashboard: {
    type: 'dashboard',
    name: 'Admin Dashboard',
    description: 'Panel de administración con analytics',
    icon: 'bar-chart',
    color: '#f59e0b',
    features: ['Overview', 'Charts', 'Tables', 'Settings', 'Users'],
  },
  api: {
    type: 'api',
    name: 'API Backend',
    description: 'Backend REST API con documentación',
    icon: 'server',
    color: '#ef4444',
    features: ['REST Endpoints', 'Authentication', 'Database', 'Documentation'],
  },
}

export interface Agent {
  id: string
  name: string
  type: 'github' | 'designer' | 'frontend' | 'backend' | 'game' | 'image'
  description: string
  icon: string
  color: string
  status: 'idle' | 'working' | 'done' | 'error'
  progress: number
  currentTask?: string
}

export const ENJAMBRE_AGENTS: Agent[] = [
  {
    id: 'github-agent',
    name: 'GitHub Agent',
    type: 'github',
    description: 'Crea repositorio, estructura y configuración inicial',
    icon: 'github',
    color: '#24292e',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'ui-designer',
    name: 'UI Designer',
    type: 'designer',
    description: 'Diseña componentes y sistema visual',
    icon: 'palette',
    color: '#C4622D',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'frontend-agent',
    name: 'Frontend Agent',
    type: 'frontend',
    description: 'Genera código React/Next.js y estilos',
    icon: 'code',
    color: '#2D4A3E',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'backend-agent',
    name: 'Backend Agent',
    type: 'backend',
    description: 'Crea APIs, autenticación y lógica de servidor',
    icon: 'database',
    color: '#6366f1',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'game-agent',
    name: 'Game Agent',
    type: 'game',
    description: 'Crea juegos interactivos con Canvas 2D',
    icon: 'gamepad-2',
    color: '#ec4899',
    status: 'idle',
    progress: 0,
  },
  {
    id: 'image-agent',
    name: 'Image Agent',
    type: 'image',
    description: 'Busca y optimiza imágenes para el proyecto',
    icon: 'image',
    color: '#f59e0b',
    status: 'idle',
    progress: 0,
  },
]
