// Agent Factory Types - Define custom agents for Octopus Enjambre

export type AgentCategory = 'code' | 'design' | 'data' | 'automation' | 'custom'

export interface AgentCapability {
  id: string
  name: string
  description: string
  type: 'skill' | 'mcp' | 'api'
}

export interface CustomAgent {
  id: string
  name: string
  description: string
  category: AgentCategory
  icon: string
  color: string
  systemPrompt: string
  capabilities: AgentCapability[]
  model: string
  temperature: number
  maxTokens: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AgentTemplate {
  id: string
  name: string
  description: string
  category: AgentCategory
  icon: string
  color: string
  systemPrompt: string
  suggestedCapabilities: string[]
}

export const AGENT_CATEGORIES: Record<AgentCategory, { name: string; description: string; icon: string; color: string }> = {
  code: {
    name: 'Código',
    description: 'Agentes especializados en desarrollo y programación',
    icon: 'Code',
    color: '#2D4A3E',
  },
  design: {
    name: 'Diseño',
    description: 'Agentes para UI/UX y diseño visual',
    icon: 'Palette',
    color: '#C4622D',
  },
  data: {
    name: 'Datos',
    description: 'Agentes para análisis y procesamiento de datos',
    icon: 'Database',
    color: '#4A90D9',
  },
  automation: {
    name: 'Automatización',
    description: 'Agentes para tareas repetitivas y workflows',
    icon: 'Workflow',
    color: '#9B59B6',
  },
  custom: {
    name: 'Personalizado',
    description: 'Agentes con configuración personalizada',
    icon: 'Sparkles',
    color: '#E67E22',
  },
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'fullstack-dev',
    name: 'Fullstack Developer',
    description: 'Agente experto en desarrollo web completo (frontend + backend)',
    category: 'code',
    icon: 'Layers',
    color: '#2D4A3E',
    systemPrompt: 'Eres un desarrollador fullstack experto en React, Next.js, Node.js, TypeScript y bases de datos. Generas código limpio, modular y siguiendo mejores prácticas.',
    suggestedCapabilities: ['github', 'npm', 'database'],
  },
  {
    id: 'ui-specialist',
    name: 'UI Specialist',
    description: 'Agente especializado en interfaces modernas y animaciones',
    category: 'design',
    icon: 'Paintbrush',
    color: '#C4622D',
    systemPrompt: 'Eres un especialista en UI/UX con dominio de Tailwind CSS, Framer Motion y diseño de sistemas. Creas interfaces elegantes, accesibles y con animaciones cinematográficas.',
    suggestedCapabilities: ['figma', 'image-gen', 'css-tools'],
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Agente para análisis de datos y visualizaciones',
    category: 'data',
    icon: 'BarChart3',
    color: '#4A90D9',
    systemPrompt: 'Eres un analista de datos experto en Python, SQL y visualización. Transforms datos crudos en insights actionables y dashboards interactivos.',
    suggestedCapabilities: ['database', 'python', 'charts'],
  },
  {
    id: 'workflow-bot',
    name: 'Workflow Bot',
    description: 'Agente para automatizar procesos y flujos de trabajo',
    category: 'automation',
    icon: 'Workflow',
    color: '#9B59B6',
    systemPrompt: 'Eres un experto en automatización de procesos. Diseñas workflows eficientes, integras servicios y optimizas operaciones repetitivas.',
    suggestedCapabilities: ['zapier', 'email', 'scheduler'],
  },
]
