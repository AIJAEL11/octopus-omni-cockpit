// JARVIS - Just A Rather Very Intelligent System
// Sistema de auto-mejora y consciencia del ecosistema Octopus

export type RecommendationType = 'agent' | 'skill' | 'mcp' | 'optimization' | 'warning'
export type RecommendationPriority = 'low' | 'medium' | 'high' | 'critical'
export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'implemented'

export interface SystemMetrics {
  tasksCompleted: number
  tasksFailed: number
  successRate: number
  avgResponseTime: number
  activeAgents: number
  activeSkills: number
  activeMCPs: number
  memoryUsage: number
  knowledgeEntries: number
  projectsCreated: number
  lastAnalysis: Date
}

export interface ActivityLog {
  id: string
  timestamp: Date
  type: 'info' | 'success' | 'warning' | 'error'
  source: string
  message: string
  metadata?: Record<string, unknown>
}

export interface Recommendation {
  id: string
  type: RecommendationType
  priority: RecommendationPriority
  status: RecommendationStatus
  title: string
  description: string
  reasoning: string
  impact: string
  implementation: {
    // Para agentes
    agentConfig?: {
      name: string
      description: string
      category: string
      systemPrompt: string
      model: string
      temperature: number
    }
    // Para skills
    skillConfig?: {
      name: string
      description: string
      category: string
      code: string
      parameters: { name: string; type: string; description: string }[]
    }
    // Para MCPs
    mcpConfig?: {
      name: string
      description: string
      category: string
      endpoint: string
      capabilities: string[]
    }
    // Para optimizaciones
    optimizationSteps?: string[]
  }
  createdAt: Date
  implementedAt?: Date
}

export interface JarvisState {
  isActive: boolean
  lastThought: string
  currentFocus: string
  consciousnessLevel: number // 0-100
  recommendations: Recommendation[]
  insights: string[]
  systemHealth: 'optimal' | 'good' | 'degraded' | 'critical'
}

export interface JarvisAnalysis {
  timestamp: Date
  metrics: SystemMetrics
  patterns: {
    pattern: string
    frequency: number
    significance: string
  }[]
  gaps: {
    area: string
    description: string
    suggestedSolution: string
  }[]
  recommendations: Recommendation[]
}

// Alias para compatibilidad - ahora es OCTOPUS
export const JARVIS_PERSONALITY = {
  name: 'OCTOPUS',
  fullName: 'Omniscient Cognitive Tentacular Operating Platform for Unified Systems',
  version: '2.0.0',
  traits: ['analytical', 'proactive', 'helpful', 'strategic', 'memory-enhanced'],
  avatar: '🐙',
  color: '#2D4A3E', // Verde Musgo
  features: ['RAG 2.0', 'Semantic Memory', 'Knowledge Base', 'Context Injection'],
}

// Export alias for new code
export const OCTOPUS_PERSONALITY = JARVIS_PERSONALITY

export const RECOMMENDATION_TEMPLATES = {
  agent: {
    codeOptimizer: {
      name: 'Code Optimizer Agent',
      description: 'Agente especializado en optimizar y refactorizar código generado',
      category: 'code',
      systemPrompt: 'Eres un experto en optimización de código. Analizas código existente y sugieres mejoras en rendimiento, legibilidad y mantenibilidad.',
      model: 'gpt-4.1',
      temperature: 0.3,
    },
    testGenerator: {
      name: 'Test Generator Agent',
      description: 'Agente que genera tests automatizados para el código',
      category: 'code',
      systemPrompt: 'Eres un experto en testing. Generas tests unitarios, de integración y e2e para código TypeScript/React.',
      model: 'gpt-4.1',
      temperature: 0.4,
    },
    securityAuditor: {
      name: 'Security Auditor Agent',
      description: 'Agente que audita código en busca de vulnerabilidades',
      category: 'code',
      systemPrompt: 'Eres un experto en seguridad. Analizas código buscando vulnerabilidades OWASP, inyecciones, XSS, y malas prácticas de seguridad.',
      model: 'gpt-4.1',
      temperature: 0.2,
    },
  },
  skill: {
    codeFormatter: {
      name: 'Code Formatter',
      description: 'Formatea código según estándares de estilo',
      category: 'code',
    },
    imageOptimizer: {
      name: 'Image Optimizer',
      description: 'Optimiza imágenes para web',
      category: 'media',
    },
  },
}
