// MCP Factory Types - Model Context Protocol tools for Octopus

export type MCPCategory = 'communication' | 'storage' | 'development' | 'ai' | 'productivity' | 'custom'

export interface MCPServer {
  id: string
  name: string
  description: string
  category: MCPCategory
  icon: string
  color: string
  endpoint: string
  apiKey?: string
  isConnected: boolean
  capabilities: string[]
  version: string
  lastSync?: Date
}

export interface MCPTool {
  id: string
  serverId: string
  name: string
  description: string
  parameters: MCPParameter[]
  returnType: string
}

export interface MCPParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description: string
  required: boolean
  default?: unknown
}

export const MCP_CATEGORIES: Record<MCPCategory, { name: string; description: string; icon: string; color: string }> = {
  communication: {
    name: 'Comunicación',
    description: 'MCPs para email, mensajería y notificaciones',
    icon: 'MessageCircle',
    color: '#2D4A3E',
  },
  storage: {
    name: 'Almacenamiento',
    description: 'MCPs para archivos, bases de datos y cloud storage',
    icon: 'HardDrive',
    color: '#C4622D',
  },
  development: {
    name: 'Desarrollo',
    description: 'MCPs para GitHub, CI/CD y herramientas de dev',
    icon: 'GitBranch',
    color: '#4A90D9',
  },
  ai: {
    name: 'Inteligencia Artificial',
    description: 'MCPs para modelos de lenguaje, visión y más',
    icon: 'Brain',
    color: '#9B59B6',
  },
  productivity: {
    name: 'Productividad',
    description: 'MCPs para calendarios, tareas y documentos',
    icon: 'Calendar',
    color: '#E67E22',
  },
  custom: {
    name: 'Personalizado',
    description: 'MCPs con endpoints personalizados',
    icon: 'Plug',
    color: '#1ABC9C',
  },
}

export const MCP_TEMPLATES: Partial<MCPServer>[] = [
  {
    id: 'github-mcp',
    name: 'GitHub MCP',
    description: 'Acceso completo a repositorios, issues, PRs y Actions',
    category: 'development',
    icon: 'Github',
    color: '#24292e',
    capabilities: ['repos', 'issues', 'pull-requests', 'actions', 'gists'],
    version: '1.0.0',
  },
  {
    id: 'gmail-mcp',
    name: 'Gmail MCP',
    description: 'Enviar, recibir y gestionar correos electrónicos',
    category: 'communication',
    icon: 'Mail',
    color: '#EA4335',
    capabilities: ['send', 'read', 'search', 'labels', 'attachments'],
    version: '1.0.0',
  },
  {
    id: 'telegram-mcp',
    name: 'Telegram MCP',
    description: 'Bots y mensajería a través de Telegram',
    category: 'communication',
    icon: 'Send',
    color: '#0088cc',
    capabilities: ['send-message', 'receive', 'groups', 'bots', 'media'],
    version: '1.0.0',
  },
  {
    id: 'openai-mcp',
    name: 'OpenAI MCP',
    description: 'Acceso a GPT-4, DALL-E y Whisper',
    category: 'ai',
    icon: 'Sparkles',
    color: '#00A67E',
    capabilities: ['chat', 'completions', 'embeddings', 'images', 'audio'],
    version: '1.0.0',
  },
  {
    id: 'notion-mcp',
    name: 'Notion MCP',
    description: 'Gestión de documentos, bases de datos y wikis',
    category: 'productivity',
    icon: 'FileText',
    color: '#000000',
    capabilities: ['pages', 'databases', 'blocks', 'search', 'comments'],
    version: '1.0.0',
  },
  {
    id: 's3-mcp',
    name: 'AWS S3 MCP',
    description: 'Almacenamiento de archivos en la nube',
    category: 'storage',
    icon: 'Cloud',
    color: '#FF9900',
    capabilities: ['upload', 'download', 'list', 'delete', 'presigned-urls'],
    version: '1.0.0',
  },
]
