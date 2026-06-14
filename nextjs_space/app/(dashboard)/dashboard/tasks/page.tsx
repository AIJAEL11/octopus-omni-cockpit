'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  X,
  ListTodo,
  BarChart3,
  Flame,
  Target,
  TrendingUp,
  Loader2,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/* ───── types ───── */
interface Task {
  id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'pending' | 'in_progress' | 'completed'
  category: string | null
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  pending: number
  inProgress: number
  completed: number
  overdue: number
}

const PRIORITY_CONFIG = {
  low: { color: 'emerald', label: 'Low', labelEs: 'Baja', icon: '🟢' },
  medium: { color: 'amber', label: 'Medium', labelEs: 'Media', icon: '🟡' },
  high: { color: 'orange', label: 'High', labelEs: 'Alta', icon: '🟠' },
  urgent: { color: 'red', label: 'Urgent', labelEs: 'Urgente', icon: '🔴' },
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', labelEs: 'Pendiente', icon: Circle, color: 'zinc' },
  in_progress: { label: 'In Progress', labelEs: 'En Progreso', icon: Clock, color: 'blue' },
  completed: { label: 'Completed', labelEs: 'Completada', icon: CheckCircle2, color: 'emerald' },
}

const CATEGORIES = ['general', 'work', 'personal', 'health', 'finance', 'learning']
const CATEGORY_LABELS: Record<string, { en: string; es: string }> = {
  general: { en: 'General', es: 'General' },
  work: { en: 'Work', es: 'Trabajo' },
  personal: { en: 'Personal', es: 'Personal' },
  health: { en: 'Health', es: 'Salud' },
  finance: { en: 'Finance', es: 'Finanzas' },
  learning: { en: 'Learning', es: 'Aprendizaje' },
}

export default function TasksPage() {
  const { t, locale } = useI18n()
  const isEn = locale === 'en'

  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
    dueDate: '',
  })

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterPriority !== 'all') params.set('priority', filterPriority)
      if (search) params.set('search', search)
      const res = await fetch(`/api/tasks?${params}`)
      const data = await res.json()
      if (data.tasks) setTasks(data.tasks)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    }
  }, [filterStatus, filterPriority, search])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/stats')
      const data = await res.json()
      if (data.total !== undefined) setStats(data)
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchTasks(), fetchStats()]).finally(() => setLoading(false))
  }, [fetchTasks, fetchStats])

  const openCreate = () => {
    setEditingTask(null)
    setForm({ title: '', description: '', priority: 'medium', category: 'general', dueDate: '' })
    setShowModal(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      category: task.category || 'general',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      if (editingTask) {
        await fetch(`/api/tasks/${editingTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      } else {
        await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
      }
      setShowModal(false)
      await Promise.all([fetchTasks(), fetchStats()])
    } catch (err) {
      console.error('Save failed:', err)
    }
    setSaving(false)
  }

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'completed' ? 'pending' : task.status === 'pending' ? 'in_progress' : 'completed'
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      await Promise.all([fetchTasks(), fetchStats()])
    } catch (err) {
      console.error('Status toggle failed:', err)
    }
  }

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      await Promise.all([fetchTasks(), fetchStats()])
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const isOverdue = (task: Task) => {
    if (!task.dueDate || task.status === 'completed') return false
    return new Date(task.dueDate) < new Date()
  }

  const formatDate = (d: string | null) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString(isEn ? 'en-US' : 'es-ES', {
      month: 'short',
      day: 'numeric',
    })
  }

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-white" />
              </div>
              Task Manager Pro
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              {isEn ? 'Organize, prioritize and track your tasks' : 'Organiza, prioriza y rastrea tus tareas'}
            </p>
          </div>
          <Button onClick={openCreate} className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-violet-500/25">
            <Plus className="w-4 h-4" />
            {isEn ? 'New Task' : 'Nueva Tarea'}
          </Button>
        </motion.div>

        {/* ── Stats Row ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3"
        >
          {[
            { label: isEn ? 'Total' : 'Total', value: stats.total, icon: BarChart3, gradient: 'from-zinc-700 to-zinc-800', text: 'text-white' },
            { label: isEn ? 'Pending' : 'Pendientes', value: stats.pending, icon: Circle, gradient: 'from-amber-500/20 to-amber-600/10', text: 'text-amber-400' },
            { label: isEn ? 'In Progress' : 'En Progreso', value: stats.inProgress, icon: Clock, gradient: 'from-blue-500/20 to-blue-600/10', text: 'text-blue-400' },
            { label: isEn ? 'Completed' : 'Completadas', value: stats.completed, icon: CheckCircle2, gradient: 'from-emerald-500/20 to-emerald-600/10', text: 'text-emerald-400' },
            { label: isEn ? 'Overdue' : 'Vencidas', value: stats.overdue, icon: AlertTriangle, gradient: 'from-red-500/20 to-red-600/10', text: 'text-red-400' },
          ].map((s, i) => (
            <Card key={i} className={`bg-gradient-to-br ${s.gradient} border-zinc-800 p-4 rounded-2xl`}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.text}`} />
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wide">{s.label}</span>
              </div>
              <span className={`text-2xl font-bold ${s.text}`}>{s.value}</span>
            </Card>
          ))}
        </motion.div>

        {/* ── Progress Bar ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {isEn ? 'Completion Rate' : 'Tasa de Completado'}
            </span>
            <span className="text-sm font-bold text-violet-400">{completionRate}%</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionRate}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
            />
          </div>
        </motion.div>

        {/* ── Filters Bar ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-3"
        >
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isEn ? 'Search tasks...' : 'Buscar tareas...'}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <Filter className="w-3.5 h-3.5 text-zinc-500 ml-2" />
            {['all', 'pending', 'in_progress', 'completed'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterStatus === s
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {s === 'all'
                  ? (isEn ? 'All' : 'Todas')
                  : (isEn ? STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].label : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].labelEs)}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <Flame className="w-3.5 h-3.5 text-zinc-500 ml-2" />
            {['all', 'low', 'medium', 'high', 'urgent'].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterPriority === p
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p === 'all'
                  ? (isEn ? 'All' : 'Todas')
                  : PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG].icon}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Task List ── */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            </div>
          ) : tasks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800 flex items-center justify-center mb-4">
                <ListTodo className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-400 text-sm">
                {isEn ? 'No tasks yet. Create your first one!' : '¡No hay tareas aún. Crea la primera!'}
              </p>
              <Button onClick={openCreate} className="mt-4 bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 rounded-xl px-5">
                <Plus className="w-4 h-4 mr-1" /> {isEn ? 'Create Task' : 'Crear Tarea'}
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {tasks.map((task, idx) => {
                const prio = PRIORITY_CONFIG[task.priority]
                const stat = STATUS_CONFIG[task.status]
                const StatIcon = stat.icon
                const overdue = isOverdue(task)

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ delay: idx * 0.03 }}
                    layout
                    className={`group relative bg-zinc-900/80 border rounded-2xl p-4 transition-all hover:border-zinc-700 ${
                      task.status === 'completed' ? 'border-zinc-800/50 opacity-60' : overdue ? 'border-red-500/40' : 'border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status toggle button */}
                      <button
                        onClick={() => toggleStatus(task)}
                        className={`mt-0.5 flex-shrink-0 transition-all ${
                          task.status === 'completed' ? 'text-emerald-400' : task.status === 'in_progress' ? 'text-blue-400' : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                        title={isEn ? 'Toggle status' : 'Cambiar estado'}
                      >
                        <StatIcon className="w-5 h-5" />
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-zinc-500' : 'text-white'}`}>
                            {task.title}
                          </span>
                          {/* Priority badge */}
                          <span className="text-[10px]">{prio.icon}</span>
                          {/* Category badge */}
                          {task.category && task.category !== 'general' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-medium">
                              {isEn ? CATEGORY_LABELS[task.category]?.en : CATEGORY_LABELS[task.category]?.es || task.category}
                            </span>
                          )}
                          {overdue && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              {isEn ? 'OVERDUE' : 'VENCIDA'}
                            </span>
                          )}
                        </div>
                        {task.description && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{task.description}</p>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openEdit(task)}
                          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                          title={isEn ? 'Edit' : 'Editar'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                          title={isEn ? 'Delete' : 'Eliminar'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">
                  {editingTask
                    ? (isEn ? 'Edit Task' : 'Editar Tarea')
                    : (isEn ? 'New Task' : 'Nueva Tarea')}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                    {isEn ? 'Title' : 'Título'} *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={isEn ? 'What needs to be done?' : '¿Qué necesitas hacer?'}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                    {isEn ? 'Description' : 'Descripción'}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={isEn ? 'Add details...' : 'Agregar detalles...'}
                    rows={3}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                  />
                </div>

                {/* Priority + Category row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                      {isEn ? 'Priority' : 'Prioridad'}
                    </label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value })}
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    >
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {isEn ? v.label : v.labelEs}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                      {isEn ? 'Category' : 'Categoría'}
                    </label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{isEn ? CATEGORY_LABELS[c].en : CATEGORY_LABELS[c].es}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Due Date */}
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {isEn ? 'Due Date' : 'Fecha Límite'}
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  {isEn ? 'Cancel' : 'Cancelar'}
                </button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim()}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {editingTask
                    ? (isEn ? 'Update' : 'Actualizar')
                    : (isEn ? 'Create' : 'Crear')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
