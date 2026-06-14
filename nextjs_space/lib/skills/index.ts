// 🛠️ SKILLS INDEX - Sistema de habilidades de Octopus
// Exporta todas las skills disponibles para el Enjambre

import { IMAGE_SKILL_INFO, searchImages, generateImage, getProjectImages } from './image-skill'
import { GAME_SKILL_INFO, MASTER_GAME_PROMPT, detectGameType, generateGameConfig, GAME_TEMPLATES } from './game-skill'
import { CODE_REFINER_SKILL_INFO, analyzeCode } from './code-refiner'
import { executeLeadToAsset, getProcessStatus, listUserProcesses } from './lead-to-asset-service'
import { leadAssetBus } from './lead-to-asset-events'
import { WEB_VISION_SKILL_INFO, captureScreenshots, analyzeDesign, formatDesignReference, detectDesignIntent } from './web-vision'

export interface SkillInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
  status: 'active' | 'inactive' | 'coming_soon'
}

// Registro de todas las skills disponibles
export const AVAILABLE_SKILLS: SkillInfo[] = [
  IMAGE_SKILL_INFO,
  GAME_SKILL_INFO,
  WEB_VISION_SKILL_INFO,
  {
    id: 'layout-analyzer',
    name: '📐 Layout Analyzer',
    description: 'Analiza wireframes y bocetos del usuario',
    capabilities: ['Detección de secciones', 'Sugerencia de componentes', 'Conversión a código'],
    status: 'coming_soon',
  },
  CODE_REFINER_SKILL_INFO,
  {
    id: 'test-agent',
    name: '🧪 Test Agent',
    description: 'Valida que el código funcione correctamente',
    capabilities: ['Unit tests', 'Integration tests', 'Visual regression'],
    status: 'coming_soon',
  },
  {
    id: 'deploy-agent',
    name: '🚀 Deploy Agent',
    description: 'Despliega proyectos a producción',
    capabilities: ['Vercel deploy', 'Netlify deploy', 'GitHub Pages'],
    status: 'coming_soon',
  },
  {
    id: 'lead-to-asset',
    name: '🐙 Lead-to-Asset',
    description: 'Motor de ejecución principal: captura un lead y genera un asset personalizado con IA',
    capabilities: [
      'Registro/actualización de leads',
      'Generación de video personalizado',
      'Generación de imágenes',
      'Envío automático de email',
      'Eventos en tiempo real (SSE)',
      'Estado persistente en DB',
    ],
    status: 'active',
  },
]

// Re-exportar funciones y constantes
export {
  // Image Skill
  IMAGE_SKILL_INFO,
  searchImages,
  generateImage,
  getProjectImages,

  // Code Refiner Skill
  CODE_REFINER_SKILL_INFO,
  analyzeCode,
  
  // Game Skill
  GAME_SKILL_INFO,
  MASTER_GAME_PROMPT,
  detectGameType,
  generateGameConfig,
  GAME_TEMPLATES,

  // Lead-to-Asset Skill
  executeLeadToAsset,
  getProcessStatus,
  listUserProcesses,
  leadAssetBus,

  // Web Vision Skill
  WEB_VISION_SKILL_INFO,
  captureScreenshots,
  analyzeDesign,
  formatDesignReference,
  detectDesignIntent,
}

// Función para obtener skills activas
export function getActiveSkills(): SkillInfo[] {
  return AVAILABLE_SKILLS.filter(s => s.status === 'active')
}

// Función para verificar si una skill está disponible
export function isSkillAvailable(skillId: string): boolean {
  const skill = AVAILABLE_SKILLS.find(s => s.id === skillId)
  return skill?.status === 'active'
}
