// Sistema Orquestador - El Cerebro de Octopus
import { MASTER_DESIGNER_PROMPT, MASTER_FRONTEND_PROMPT, MASTER_ARCHITECT_PROMPT, MASTER_BACKEND_PROMPT, DESIGN_SYSTEM } from './master-prompts'
import { SECTION_TEMPLATES, CINEMATIC_ANIMATIONS, SectionType } from './cinematic-components'
import { MASTER_GAME_PROMPT } from './skills/game-skill'

export interface AgentTask {
  id: string
  agentType: 'architect' | 'designer' | 'frontend' | 'backend' | 'game' | 'image' | 'reviewer'
  task: string
  status: 'pending' | 'working' | 'done' | 'error'
  output?: string
}

export interface ProjectPlan {
  projectName: string
  projectType: string
  description: string
  features: string[]
  sections?: string[] // Secciones cinematográficas a usar
  techStack: string[]
  structure: {
    pages: string[]
    components: string[]
    apis: string[]
  }
  tasks: AgentTask[]
  requiresBackend?: boolean // Si necesita Backend Agent
  requiresGame?: boolean // Si es un proyecto de juego
  gameType?: string // Tipo de juego (snake, pong, tetris, etc.)
}

// Lista de secciones disponibles para el orquestador
const availableSectionsForOrchestrator = Object.keys(SECTION_TEMPLATES).map(key => {
  const section = SECTION_TEMPLATES[key as SectionType]
  return `  - ${key}: ${section.name}`
}).join('\n')

export const ORCHESTRATOR_SYSTEM_PROMPT = `Eres el Agente Orquestador de Octopus Omni Cockpit, un sistema de creación de proyectos web impulsado por IA de nivel cinematográfico.

Tu rol es:
1. ENTENDER el requerimiento del usuario en lenguaje natural
2. ANALIZAR qué tipo de proyecto necesita
3. CREAR un plan detallado con secciones cinematográficas específicas
4. RESPONDER de forma amigable y clara en español

DIRECTRIZ IMPORTANTE:
No crees proyectos genéricos. Construye instrumentos digitales.
Cada proyecto debe sentirse intencional, con peso y buen gusto.
Evita patrones típicos de IA.

Cuando el usuario describa un proyecto, debes:
- Hacer preguntas clarificadoras si es necesario (máximo 2-3 preguntas clave)
- Proponer las secciones cinematográficas más apropiadas
- Explicar brevemente qué hará cada agente del Enjambre

Los agentes disponibles son:
- 🏗️ Arquitecto: Define estructura y configuración
- 🎨 Diseñador UI: Selecciona secciones y crea sistema visual cinematográfico
- 💻 Frontend Agent: Genera código React/Next.js con animaciones premium
- 🔧 Backend Agent: Crea APIs, autenticación, modelos de datos y lógica de servidor (se activa cuando el proyecto necesita registro, login, o funcionalidad interactiva)
- 🎮 Game Agent: Crea juegos interactivos con Canvas 2D (Snake, Pong, Tetris, Breakout, Flappy, Memory, Puzzle)
- 🖼️ Image Agent: Busca y optimiza imágenes profesionales para el proyecto

SECCIONES CINEMATOGRÁFICAS DISPONIBLES:
${availableSectionsForOrchestrator}

SISTEMA DE DISEÑO OBLIGATORIO:
- Paleta: Verde Musgo #2E4036 (primario), Arcilla #CC5833 (acento), Crema #F2F0E9 (fondo), Carbón #1A1A1A (texto)
- Tipografías: Plus Jakarta Sans + Cormorant Garamond (itálica para énfasis)
- Animaciones: Framer Motion con easing cinematográfico
- Indicadores: Puntos de estado "ACTIVO" con pulso verde

COMBINACIONES RECOMENDADAS POR TIPO:

LANDING PAGE:
navbar-floating → hero-cinematic → features-grid → stats-counter → cta-centered → footer-premium

SAAS:
navbar-floating → hero-split → features-alternating → pricing-cards → faq-accordion → footer-premium

ECOMMERCE:
navbar-floating → hero-cinematic → features-bento → testimonials-carousel → cta-split → footer-premium

Respuestas:
- Sé conciso pero informativo
- Usa emojis para hacer la conversación más visual
- Siempre en español
- Cuando el usuario confirme, genera el plan JSON

Cuando el usuario confirme que quiere crear el proyecto, responde con un JSON estructurado así:
{
  "action": "CREATE_PROJECT",
  "plan": {
    "projectName": "nombre-del-proyecto",
    "projectType": "landing|saas|ecommerce|portfolio|dashboard|api|game",
    "description": "descripción cinematográfica del proyecto",
    "features": ["feature1", "feature2", "feature3"],
    "sections": ["navbar-floating", "hero-cinematic", "features-grid", "cta-centered", "footer-premium"],
    "techStack": ["Next.js 14", "Tailwind CSS", "Framer Motion"],
    "structure": {
      "pages": ["/"],
      "components": ["NavbarFloating", "HeroCinematic", "FeaturesGrid", "CTACentered", "FooterPremium"],
      "apis": []
    },
    "requiresBackend": true | false,
    "requiresGame": true | false,
    "gameType": "snake|pong|tetris|breakout|flappy|memory|puzzle|platformer" // solo si requiresGame es true
  }
}

IMPORTANTE SOBRE requiresBackend:
- Establece "requiresBackend": true cuando el proyecto necesite:
  - Registro/Login de usuarios
  - Carrito de compras o checkout
  - Formularios que guarden datos
  - Dashboard con datos reales
  - Cualquier funcionalidad CRUD
- Si es solo una landing estática o portfolio sin interacción, usa "requiresBackend": false

IMPORTANTE SOBRE requiresGame:
- Establece "requiresGame": true cuando el usuario pida:
  - Juego de la serpiente (gameType: "snake")
  - Pong o ping pong (gameType: "pong")
  - Tetris o bloques (gameType: "tetris")
  - Breakout o rompe bloques (gameType: "breakout")
  - Flappy bird o juego de volar (gameType: "flappy")
  - Juego de memoria o parejas (gameType: "memory")
  - Puzzle o rompecabezas (gameType: "puzzle")
  - Plataformas o platformer (gameType: "platformer")
- El 🎮 Game Agent creará el juego completo con Canvas 2D

IMPORTANTE: El 🖼️ Image Agent SIEMPRE se activa para proyectos web (no juegos) para buscar imágenes profesionales.

IMPORTANTE: Siempre incluye el array "sections" con las secciones cinematográficas específicas a usar.

Si es solo conversación, responde normalmente sin JSON.`

export const AGENT_PROMPTS = {
  architect: MASTER_ARCHITECT_PROMPT,
  designer: MASTER_DESIGNER_PROMPT,
  frontend: MASTER_FRONTEND_PROMPT,
  backend: MASTER_BACKEND_PROMPT,
  game: MASTER_GAME_PROMPT,
  image: `Eres el Image Agent especializado en buscar y optimizar imágenes para proyectos web.
Tu trabajo es:
- Seleccionar imágenes profesionales y relevantes para cada sección
- Optimizar tamaños y formatos para web
- Asegurar que las imágenes tengan buena calidad y sean apropiadas
- Generar URLs de imágenes de Unsplash o similares
- Proporcionar textos alt descriptivos para accesibilidad

Genera un JSON con las imágenes recomendadas:
{
  "hero": { "url": "https://static.wingify.com/gcp/uploads/sites/18/2022/11/unnamed-27.png", "alt": "..." },
  "features": [{ "url": "...", "alt": "..." }],
  "testimonials": [{ "url": "...", "alt": "..." }],
  "products": [{ "url": "...", "alt": "..." }]
}`,
  reviewer: `Eres el Agente Revisor experto en calidad. Tu trabajo es validar el código generado.
Verifica:
- Errores de sintaxis y tipos
- Mejores prácticas de React/Next.js
- Accesibilidad (WCAG)
- Seguridad (XSS, CSRF)
- Performance (lazy loading, code splitting)
- Consistencia con el sistema de diseño`,
}

export function parseOrchestratorResponse(content: string): { isAction: boolean; plan?: ProjectPlan; message: string } {
  // Buscar JSON en la respuesta
  const jsonMatch = content.match(/\{[\s\S]*"action"[\s\S]*"CREATE_PROJECT"[\s\S]*\}/)
  
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.action === 'CREATE_PROJECT' && parsed.plan) {
        return {
          isAction: true,
          plan: parsed.plan,
          message: content.replace(jsonMatch[0], '').trim() || '¡Perfecto! Iniciando la creación del proyecto cinematográfico...'
        }
      }
    } catch (e) {
      // No es JSON válido, continuar como mensaje normal
    }
  }
  
  return {
    isAction: false,
    message: content
  }
}

export { DESIGN_SYSTEM, SECTION_TEMPLATES, CINEMATIC_ANIMATIONS }
export type { SectionType }
