'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FolderOpen,
  Plus,
  Eye,
  Trash2,
  Calendar,
  Loader2,
  Image as ImageIcon,
  FileText,
  Search,
  MoreVertical,
  Pencil,
  FolderPlus,
  X,
  Tag,
  Filter,
  ArrowUpDown,
  Clock,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n-context'

interface Project {
  id: string
  name: string
  description: string | null
  projectType: string
  status: string
  progress: number
  createdAt: string
  updatedAt: string
  files: Array<{ id: string; name: string }>
  _count?: { creativeAssets: number }
}

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string; labelEn: string }> = {
  campaña: { icon: '📢', color: '#C4622D', label: 'Campaña', labelEn: 'Campaign' },
  contenido: { icon: '✍️', color: '#2D4A3E', label: 'Contenido', labelEn: 'Content' },
  branding: { icon: '🎨', color: '#8B5CF6', label: 'Branding', labelEn: 'Branding' },
  investigacion: { icon: '🔍', color: '#3B82F6', label: 'Investigación', labelEn: 'Research' },
  landing: { icon: '🚀', color: '#C4622D', label: 'Landing Page', labelEn: 'Landing Page' },
  saas: { icon: '🌐', color: '#2D4A3E', label: 'SaaS', labelEn: 'SaaS' },
  ecommerce: { icon: '🛒', color: '#8B5CF6', label: 'E-commerce', labelEn: 'E-commerce' },
  general: { icon: '📁', color: '#6B7280', label: 'General', labelEn: 'General' },
}

function getCategoryForType(type: string) {
  return CATEGORY_CONFIG[type] || CATEGORY_CONFIG['general']
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'assets'>('recent')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [newProjectType, setNewProjectType] = useState('general')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const createProject = async () => {
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null,
          projectType: newProjectType,
          status: 'active',
        }),
      })
      if (res.ok) {
        setShowCreateModal(false)
        setNewProjectName('')
        setNewProjectDesc('')
        setNewProjectType('general')
        fetchProjects()
      }
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto y todos sus contenidos?')) return
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  // Filter and sort
  const filteredProjects = projects
    .filter(p => {
      if (filterCategory !== 'all' && p.projectType !== filterCategory) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'assets') {
        const aCount = (a._count?.creativeAssets || 0) + (a.files?.length || 0)
        const bCount = (b._count?.creativeAssets || 0) + (b.files?.length || 0)
        return bCount - aCount
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const totalAssets = projects.reduce((sum, p) => sum + (p._count?.creativeAssets || 0), 0)
  const totalFiles = projects.reduce((sum, p) => sum + (p.files?.length || 0), 0)

  // Get unique categories from existing projects
  const usedCategories = [...new Set(projects.map(p => p.projectType))]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#2D4A3E] to-[#1A1A1A] rounded-3xl p-6 text-[#F5F0E8]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#C4622D]/20 rounded-2xl flex items-center justify-center">
              <FolderOpen className="w-6 h-6 text-[#C4622D]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('projects.title')}</h1>
              <p className="text-[#F5F0E8]/70 text-sm">
                {projects.length} {locale === 'en' ? (projects.length !== 1 ? 'projects' : 'project') : (projects.length !== 1 ? 'proyectos' : 'proyecto')}
                {totalAssets > 0 && <span className="mx-1">·</span>}
                {totalAssets > 0 && <span>{totalAssets} {locale === 'en' ? 'images' : 'imágenes'}</span>}
                {totalFiles > 0 && <span className="mx-1">·</span>}
                {totalFiles > 0 && <span>{totalFiles} {locale === 'en' ? 'files' : 'archivos'}</span>}
              </p>
            </div>
          </div>
          <Button 
            className="bg-[#C4622D] hover:bg-[#A54D20]"
            onClick={() => setShowCreateModal(true)}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            {t('projects.create')}
          </Button>
        </div>
      </motion.div>

      {/* Search & Filters Bar */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={locale === 'en' ? 'Search projects...' : 'Buscar proyectos...'}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D4A3E] focus:ring-1 focus:ring-[#2D4A3E]/20 transition-all"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D4A3E]"
            >
              <option value="all">{locale === 'en' ? 'All categories' : 'Todas las categorías'}</option>
              {Object.entries(CATEGORY_CONFIG).map(([key, cat]) => (
                <option key={key} value={key}>{cat.icon} {locale === 'en' ? cat.labelEn : cat.label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as 'recent' | 'name' | 'assets')}
              className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D4A3E]"
            >
              <option value="recent">{locale === 'en' ? 'Most recent' : 'Más recientes'}</option>
              <option value="name">{locale === 'en' ? 'Name A-Z' : 'Nombre A-Z'}</option>
              <option value="assets">{locale === 'en' ? 'Most content' : 'Más contenido'}</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D4A3E]" />
        </div>
      ) : filteredProjects.length === 0 && projects.length > 0 ? (
        <Card className="text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-1">{locale === 'en' ? 'No results' : 'Sin resultados'}</h3>
          <p className="text-sm text-[#1A1A1A]/60">{locale === 'en' ? 'No projects found matching your search' : 'No se encontraron proyectos con esa búsqueda'}</p>
        </Card>
      ) : projects.length === 0 ? (
        <Card className="text-center py-16">
          <FolderOpen className="w-16 h-16 text-[#2D4A3E]/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">{t('projects.no_projects')}</h3>
          <p className="text-[#1A1A1A]/60 mb-2 max-w-md mx-auto">
            {locale === 'en' 
              ? 'Create folders to organize your work. OCTOPUS can create projects for you and save images, texts, and files automatically.'
              : 'Crea carpetas para organizar tu trabajo. OCTOPUS puede crear proyectos por ti y guardar imágenes, textos y archivos automáticamente.'}
          </p>
          <p className="text-sm text-[#1A1A1A]/40 mb-6">
            {locale === 'en'
              ? 'Example: "OCTOPUS, create a project for the Black Friday campaign"'
              : 'Ejemplo: "OCTOPUS, crea un proyecto para la campaña de Black Friday"'}
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <FolderPlus className="w-4 h-4 mr-2" />
            {locale === 'en' ? 'Create my first project' : 'Crear mi primer proyecto'}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((project, index) => {
            const category = getCategoryForType(project.projectType)
            const assetCount = project._count?.creativeAssets || 0
            const fileCount = project.files?.length || 0
            const totalItems = assetCount + fileCount
            const isRecent = Date.now() - new Date(project.createdAt).getTime() < 86400000 * 2 // 2 days

            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/dashboard/projects/${project.id}`}>
                  <Card className="card-shine overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group border border-gray-100 hover:border-[#2D4A3E]/20">
                    {/* Color accent top */}
                    <div className="h-1.5" style={{ backgroundColor: category.color }} />
                    
                    <div className="p-5">
                      {/* Category + Date Row */}
                      <div className="flex items-center justify-between mb-3">
                        <span 
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${category.color}12`, color: category.color }}
                        >
                          <span>{category.icon}</span>
                          {locale === 'en' ? category.labelEn : category.label}
                        </span>
                        {isRecent && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">{locale === 'en' ? 'New' : 'Nuevo'}</span>
                        )}
                      </div>

                      {/* Name */}
                      <h3 className="font-bold text-[#1A1A1A] mb-1 group-hover:text-[#2D4A3E] transition-colors line-clamp-1">
                        {project.name}
                      </h3>
                      <p className="text-sm text-[#1A1A1A]/50 mb-4 line-clamp-2 min-h-[2.5rem]">
                        {project.description || (locale === 'en' ? 'No description' : 'Sin descripción')}
                      </p>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-xs text-[#1A1A1A]/50">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(project.createdAt).toLocaleDateString()}
                        </span>
                        {assetCount > 0 && (
                          <span className="flex items-center gap-1 text-[#C4622D] font-medium">
                            <ImageIcon className="w-3 h-3" />
                            {assetCount}
                          </span>
                        )}
                        {fileCount > 0 && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {fileCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover Actions Bar */}
                    <div className="px-5 pb-4 pt-0 flex justify-between items-center">
                      <span className="text-xs text-[#2D4A3E] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {locale === 'en' ? 'Open project →' : 'Abrir proyecto →'}
                      </span>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteProject(project.id) }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#1A1A1A]">{locale === 'en' ? 'New Project' : 'Nuevo Proyecto'}</h2>
                <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">{locale === 'en' ? 'Project name' : 'Nombre del proyecto'}</label>
                  <input
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder={locale === 'en' ? 'E.g.: Black Friday Campaign 2026' : 'Ej: Campaña Black Friday 2026'}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D4A3E] focus:ring-1 focus:ring-[#2D4A3E]/20"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1.5">{locale === 'en' ? 'Description' : 'Descripción'} <span className="text-gray-400 font-normal">({locale === 'en' ? 'optional' : 'opcional'})</span></label>
                  <textarea
                    value={newProjectDesc}
                    onChange={e => setNewProjectDesc(e.target.value)}
                    placeholder={locale === 'en' ? 'What is this project about?' : '¿De qué trata este proyecto?'}
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-[#1A1A1A] focus:outline-none focus:border-[#2D4A3E] focus:ring-1 focus:ring-[#2D4A3E]/20 resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-2">{locale === 'en' ? 'Category' : 'Categoría'}</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.entries(CATEGORY_CONFIG).map(([key, cat]) => (
                      <button
                        key={key}
                        onClick={() => setNewProjectType(key)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
                          newProjectType === key
                            ? 'border-[#2D4A3E] bg-[#2D4A3E]/5'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span className="text-[10px] font-medium text-[#1A1A1A]/70 leading-tight">{locale === 'en' ? cat.labelEn : cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setShowCreateModal(false)}
                >
                  {locale === 'en' ? 'Cancel' : 'Cancelar'}
                </Button>
                <Button
                  className="flex-1 bg-[#2D4A3E] hover:bg-[#1A1A1A]"
                  onClick={createProject}
                  disabled={!newProjectName.trim() || creating}
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <FolderPlus className="w-4 h-4 mr-2" />
                  )}
                  {locale === 'en' ? 'Create Project' : 'Crear Proyecto'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
