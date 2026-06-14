'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'
import {
  Monitor, Globe, MousePointerClick, Type, Camera, ChevronDown,
  Play, Pause, Trash2, Plus, Send, Download, Wifi, WifiOff,
  ArrowUp, ArrowDown, Eye, Code2, Loader2, X, CheckCircle2,
  AlertCircle, Clock, Zap, RefreshCw, Terminal, Sparkles,
  Image as ImageIcon, BookTemplate, Copy, Pencil, FolderOpen,
  Save, LayoutTemplate, Variable, PlayCircle, Circle, Square,
  Layers, CalendarClock, PauseCircle, TriangleAlert
} from 'lucide-react'

interface BrowserSession {
  id: string
  name: string
  status: string
  currentUrl?: string | null
  lastScreenshot?: string | null
  createdAt: string
  updatedAt: string
  _count?: { commands: number }
  commands?: BrowserCommandItem[]
}

interface BrowserCommandItem {
  id: string
  type: string
  status: string
  createdAt: string
  completedAt?: string | null
  screenshotUrl?: string | null
  result?: any
  error?: string | null
  duration?: number | null
  params?: Record<string, any> | null
}

interface BrowserTemplate {
  id: string
  name: string
  description?: string | null
  steps: Array<{ type: string; [k: string]: any }>
  variables?: Array<{ key: string; label?: string; defaultValue?: string }> | null
  category?: string | null
  lastUsed?: string | null
  useCount: number
  createdAt: string
  updatedAt: string
}

interface ScheduledTask {
  id: string
  name: string
  templateId: string
  template: { id: string; name: string; category?: string | null }
  schedule: string
  variables?: Record<string, string> | null
  status: string
  lastRun?: string | null
  nextRun?: string | null
  runCount: number
  lastResult?: string | null
  createdAt: string
}

export default function BrowserAutomationPage() {
  const { t, locale } = useI18n()
  const [sessions, setSessions] = useState<BrowserSession[]>([])
  const [activeSession, setActiveSession] = useState<BrowserSession | null>(null)
  const [bridgeConnected, setBridgeConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [commandMode, setCommandMode] = useState<'natural' | 'manual'>('natural')
  const [manualType, setManualType] = useState<string>('goto')
  const [manualParams, setManualParams] = useState<Record<string, string>>({ url: '' })
  const [showSetup, setShowSetup] = useState(false)
  const [aiParsing, setAiParsing] = useState(false)
  const [lastParsedCount, setLastParsedCount] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const fastPollRef = useRef<NodeJS.Timeout | null>(null)

  // Templates state
  const [leftTab, setLeftTab] = useState<'sessions' | 'templates' | 'scheduled'>('sessions')
  // Recorder state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedSteps, setRecordedSteps] = useState<any[]>([])
  const [showRecordingSaveModal, setShowRecordingSaveModal] = useState(false)
  const [recordingName, setRecordingName] = useState('')
  // Scheduled tasks state
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([])
  const [scheduledLoading, setScheduledLoading] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({ name: '', templateId: '', schedule: 'every 1h', variables: '{}' })
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [templates, setTemplates] = useState<BrowserTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<BrowserTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', category: '', steps: '' })
  const [showRunModal, setShowRunModal] = useState(false)
  const [runningTemplate, setRunningTemplate] = useState<BrowserTemplate | null>(null)
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({})
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [runningTemplateAction, setRunningTemplateAction] = useState(false)

  const isEs = locale === 'es'

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/browser-bridge/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
        if (!activeSession && data.sessions?.length > 0) {
          setActiveSession(data.sessions[0])
        } else if (activeSession) {
          const updated = data.sessions?.find((s: BrowserSession) => s.id === activeSession.id)
          if (updated) setActiveSession(updated)
        }
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e)
    } finally {
      setLoading(false)
    }
  }, [activeSession])

  // Check bridge connection
  const checkBridge = useCallback(async () => {
    try {
      const res = await fetch('/api/brazos')
      if (res.ok) {
        const data = await res.json()
        const browserArm = data.connections?.find((c: any) => c.armType === 'browser_automation')
        const ollamaArm = data.connections?.find((c: any) => c.armType === 'ollama')
        if (browserArm) {
          const lastUpdate = new Date(browserArm.updatedAt).getTime()
          const isRecent = Date.now() - lastUpdate < 120000
          if (isRecent && browserArm.status === 'connected') {
            setBridgeConnected(true)
            return
          }
        }
        if (ollamaArm) {
          const lastUpdate = new Date(ollamaArm.updatedAt).getTime()
          const isRecent = Date.now() - lastUpdate < 120000
          if (isRecent && ollamaArm.status === 'connected') {
            setBridgeConnected(true)
            return
          }
        }
        setBridgeConnected(false)
      }
    } catch { setBridgeConnected(false) }
  }, [])

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    try {
      const res = await fetch('/api/browser-bridge/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      }
    } catch (e) {
      console.error('Failed to fetch templates:', e)
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
    checkBridge()
    fetchTemplates()
    pollRef.current = setInterval(() => {
      fetchSessions()
      checkBridge()
    }, 8000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Create new session
  const createSession = async () => {
    try {
      const res = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_session', name: isEs ? 'Nueva Sesión' : 'New Session' }),
      })
      if (res.ok) {
        const data = await res.json()
        await fetchSessions()
        setActiveSession(data.session)
      }
    } catch (e) { console.error('Create session error:', e) }
  }

  // Delete session
  const deleteSession = async (sessionId: string) => {
    try {
      await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_session', sessionId }),
      })
      if (activeSession?.id === sessionId) setActiveSession(null)
      fetchSessions()
    } catch (e) { console.error('Delete session error:', e) }
  }

  // Send command (natural language)
  const sendNaturalCommand = async () => {
    if (!commandInput.trim() || !activeSession) return
    setSending(true)
    setAiParsing(true)
    try {
      const res = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ai_task', sessionId: activeSession.id, task: commandInput }),
      })
      if (res.ok) {
        const data = await res.json()
        setLastParsedCount(data.parsed || 0)
      }
      setCommandInput('')
      startFastPoll()
      setTimeout(fetchSessions, 500)
    } catch (e) { console.error('Send command error:', e) } finally {
      setSending(false)
      setAiParsing(false)
    }
  }

  // Fast polling while commands are executing
  const startFastPoll = () => {
    if (fastPollRef.current) clearInterval(fastPollRef.current)
    let ticks = 0
    fastPollRef.current = setInterval(() => {
      fetchSessions()
      ticks++
      if (ticks > 30) {
        if (fastPollRef.current) clearInterval(fastPollRef.current)
      }
    }, 1000)
  }

  useEffect(() => {
    return () => { if (fastPollRef.current) clearInterval(fastPollRef.current) }
  }, [])

  // Send manual command
  const sendManualCommand = async () => {
    if (!activeSession) return
    setSending(true)
    try {
      await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_command', sessionId: activeSession.id, type: manualType, params: manualParams }),
      })
      startFastPoll()
      setTimeout(fetchSessions, 500)
    } catch (e) { console.error('Send command error:', e) } finally { setSending(false) }
  }

  // Download the main Octopus Bridge
  const downloadBridge = async () => {
    try {
      const res = await fetch(`/api/browser-bridge/installer?locale=${locale}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'octopus-browser-bridge.js'
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) { console.error('Download error:', e) }
  }

  // ── Template Actions ──
  const saveSessionAsTemplate = async () => {
    if (!activeSession?.commands || activeSession.commands.length === 0) return
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/browser-bridge/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_from_session',
          sessionId: activeSession.id,
          name: activeSession.name + (isEs ? ' — Plantilla' : ' — Template'),
        }),
      })
      if (res.ok) {
        await fetchTemplates()
        setLeftTab('templates')
      }
    } catch (e) { console.error('Save template error:', e) } finally { setSavingTemplate(false) }
  }

  const deleteTemplate = async (id: string) => {
    try {
      await fetch('/api/browser-bridge/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      fetchTemplates()
    } catch (e) { console.error('Delete template error:', e) }
  }

  const duplicateTemplate = async (id: string) => {
    try {
      await fetch('/api/browser-bridge/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'duplicate', id }),
      })
      fetchTemplates()
    } catch (e) { console.error('Duplicate template error:', e) }
  }

  const openCreateTemplate = () => {
    setEditingTemplate(null)
    setTemplateForm({ name: '', description: '', category: '', steps: JSON.stringify([{ type: 'goto', url: 'https://{{site}}' }], null, 2) })
    setShowTemplateModal(true)
  }

  const openEditTemplate = (tpl: BrowserTemplate) => {
    setEditingTemplate(tpl)
    setTemplateForm({
      name: tpl.name,
      description: tpl.description || '',
      category: tpl.category || '',
      steps: JSON.stringify(tpl.steps, null, 2),
    })
    setShowTemplateModal(true)
  }

  const saveTemplateForm = async () => {
    let steps: any[]
    try {
      steps = JSON.parse(templateForm.steps)
      if (!Array.isArray(steps) || steps.length === 0) throw new Error('invalid')
    } catch {
      alert(isEs ? 'Steps JSON inválido — debe ser un array.' : 'Invalid steps JSON — must be an array.')
      return
    }
    // Auto-detect variables from {{var}} patterns
    const varsFound = new Set<string>()
    JSON.stringify(steps).replace(/\{\{(\w+)\}\}/g, (_, k) => { varsFound.add(k); return '' })
    const variables = varsFound.size > 0 ? Array.from(varsFound).map(k => ({ key: k, label: k })) : null

    setSavingTemplate(true)
    try {
      const body: any = {
        action: editingTemplate ? 'update' : 'create',
        name: templateForm.name,
        description: templateForm.description || null,
        category: templateForm.category || null,
        steps,
        variables,
      }
      if (editingTemplate) body.id = editingTemplate.id

      const res = await fetch('/api/browser-bridge/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowTemplateModal(false)
        fetchTemplates()
      }
    } catch (e) { console.error('Save template error:', e) } finally { setSavingTemplate(false) }
  }

  const openRunTemplate = (tpl: BrowserTemplate) => {
    setRunningTemplate(tpl)
    const vars: Record<string, string> = {}
    if (tpl.variables && Array.isArray(tpl.variables)) {
      tpl.variables.forEach((v: any) => { vars[v.key] = v.defaultValue || '' })
    }
    setTemplateVars(vars)
    setShowRunModal(true)
  }

  const executeTemplate = async () => {
    if (!runningTemplate || !activeSession) return
    setRunningTemplateAction(true)
    try {
      const res = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run_template',
          sessionId: activeSession.id,
          templateId: runningTemplate.id,
          variables: templateVars,
        }),
      })
      if (res.ok) {
        setShowRunModal(false)
        startFastPoll()
        setTimeout(fetchSessions, 500)
      }
    } catch (e) { console.error('Run template error:', e) } finally { setRunningTemplateAction(false) }
  }

  // ── Recorder Functions ──
  const startRecording = async () => {
    if (!activeSession) return
    try {
      const res = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_recording', sessionId: activeSession.id }),
      })
      if (res.ok) {
        setIsRecording(true)
        setRecordedSteps([])
      }
    } catch (e) { console.error('Start recording error:', e) }
  }

  const stopRecording = async () => {
    if (!activeSession) return
    try {
      const res = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_recording', sessionId: activeSession.id }),
      })
      if (res.ok) {
        setIsRecording(false)
        // Wait for Bridge to send recording, then fetch
        setTimeout(async () => {
          const rr = await fetch('/api/browser-bridge/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_recording', sessionId: activeSession.id }),
          })
          if (rr.ok) {
            const data = await rr.json()
            if (data.recording && data.recording.length > 0) {
              setRecordedSteps(data.recording)
              setShowRecordingSaveModal(true)
              setRecordingName(activeSession.name + (isEs ? ' — Grabación' : ' — Recording'))
            }
          }
        }, 3000) // Wait for Bridge to process
      }
    } catch (e) { console.error('Stop recording error:', e) }
  }

  const saveRecordingAsTemplate = async () => {
    if (recordedSteps.length === 0 || !recordingName.trim()) return
    setSavingTemplate(true)
    try {
      // Convert recorded steps to template format
      const steps = recordedSteps.map((s: any) => {
        if (s.type === 'click') return { type: 'click', params: { selector: s.selector, method: s.selector?.startsWith('#') || s.selector?.startsWith('.') ? 'css' : 'text' } }
        if (s.type === 'type') return { type: 'type', params: { text: `{{${s.selector?.replace(/[^a-zA-Z0-9]/g, '_') || 'input'}}}`, selector: s.selector } }
        if (s.type === 'goto') return { type: 'goto', params: { url: s.url } }
        return { type: s.type, params: s }
      })

      // Auto-detect variables
      const varsFound = new Set<string>()
      JSON.stringify(steps).replace(/\{\{(\w+)\}\}/g, (_, k) => { varsFound.add(k); return '' })
      const variables = varsFound.size > 0 ? Array.from(varsFound).map(k => ({ key: k, label: k })) : null

      const res = await fetch('/api/browser-bridge/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: recordingName,
          description: isEs ? `Grabada automáticamente (${steps.length} pasos)` : `Auto-recorded (${steps.length} steps)`,
          steps,
          variables,
          category: 'recorded',
        }),
      })
      if (res.ok) {
        setShowRecordingSaveModal(false)
        setRecordedSteps([])
        await fetchTemplates()
        setLeftTab('templates')
      }
    } catch (e) { console.error('Save recording error:', e) } finally { setSavingTemplate(false) }
  }

  // ── Scheduled Tasks Functions ──
  const fetchScheduledTasks = useCallback(async () => {
    setScheduledLoading(true)
    try {
      const res = await fetch('/api/browser-bridge/scheduled')
      if (res.ok) {
        const data = await res.json()
        setScheduledTasks(data.tasks || [])
      }
    } catch (e) { console.error('Fetch scheduled error:', e) } finally { setScheduledLoading(false) }
  }, [])

  const createScheduledTask = async () => {
    if (!scheduleForm.name || !scheduleForm.templateId || !scheduleForm.schedule) return
    setScheduleSaving(true)
    try {
      let variables: Record<string, string> | null = null
      try { variables = JSON.parse(scheduleForm.variables) } catch { variables = null }

      const res = await fetch('/api/browser-bridge/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: scheduleForm.name,
          templateId: scheduleForm.templateId,
          schedule: scheduleForm.schedule,
          variables,
        }),
      })
      if (res.ok) {
        setShowScheduleModal(false)
        fetchScheduledTasks()
      }
    } catch (e) { console.error('Create scheduled error:', e) } finally { setScheduleSaving(false) }
  }

  const toggleScheduledTask = async (id: string) => {
    try {
      await fetch('/api/browser-bridge/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', id }),
      })
      fetchScheduledTasks()
    } catch (e) { console.error('Toggle scheduled error:', e) }
  }

  const deleteScheduledTask = async (id: string) => {
    try {
      await fetch('/api/browser-bridge/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id }),
      })
      fetchScheduledTasks()
    } catch (e) { console.error('Delete scheduled error:', e) }
  }

  const triggerScheduledTask = async (id: string) => {
    try {
      await fetch('/api/browser-bridge/scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', id }),
      })
      fetchScheduledTasks()
      fetchSessions()
    } catch (e) { console.error('Trigger scheduled error:', e) }
  }

  const COMMAND_TYPES = [
    { value: 'goto', label: 'Navigate', icon: Globe, paramFields: [{ name: 'url', placeholder: 'https://...' }] },
    { value: 'click', label: 'Click', icon: MousePointerClick, paramFields: [{ name: 'selector', placeholder: isEs ? 'Texto del botón o selector CSS' : 'Button text or CSS selector' }, { name: 'method', placeholder: 'text' }] },
    { value: 'type', label: 'Type', icon: Type, paramFields: [{ name: 'text', placeholder: isEs ? 'Texto a escribir...' : 'Text to type...' }, { name: 'selector', placeholder: 'input[name="..."]' }] },
    { value: 'screenshot', label: 'Screenshot', icon: Camera, paramFields: [] },
    { value: 'scroll', label: 'Scroll', icon: ArrowDown, paramFields: [{ name: 'direction', placeholder: 'down' }, { name: 'amount', placeholder: '500' }] },
    { value: 'extract', label: 'Extract', icon: Eye, paramFields: [{ name: 'selector', placeholder: isEs ? 'Selector CSS (vacío = todo)' : 'CSS selector (empty = all)' }] },
    { value: 'evaluate', label: 'JS Eval', icon: Code2, paramFields: [{ name: 'script', placeholder: 'document.title' }] },
  ]

  const cmdStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
      case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      case 'sent': return <Loader2 className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
      case 'pending': return <Clock className="w-3.5 h-3.5 text-gray-400" />
      default: return <Clock className="w-3.5 h-3.5 text-gray-400" />
    }
  }

  const getCategoryColor = (cat?: string | null) => {
    switch (cat) {
      case 'social': return 'text-pink-400 bg-pink-500/10 border-pink-500/20'
      case 'scraping': return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'
      case 'forms': return 'text-green-400 bg-green-500/10 border-green-500/20'
      default: return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    }
  }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {isEs ? 'Browser Automation' : 'Browser Automation'}
            </h1>
            <p className="text-sm text-[var(--text-muted)]">
              {isEs ? 'Controla cualquier sitio web desde OCTOPUS' : 'Control any website from OCTOPUS'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            bridgeConnected
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {bridgeConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {bridgeConnected ? 'Bridge Online' : 'Bridge Offline'}
          </div>
          <Button
            onClick={() => setShowSetup(!showSetup)}
            variant="outline"
            className="text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {isEs ? 'Activar' : 'Setup'}
          </Button>
        </div>
      </div>

      {/* Setup Guide */}
      <AnimatePresence>
        {showSetup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="p-5 bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/20">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  {isEs ? 'Activar Browser Automation' : 'Enable Browser Automation'}
                </h3>
                <button onClick={() => setShowSetup(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">1</span>
                  <div>
                    <p className="text-[var(--text-primary)] font-medium text-sm">
                      {isEs ? 'Instala Puppeteer' : 'Install Puppeteer'}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">
                      {isEs ? 'En la carpeta donde tienes el Bridge:' : 'In the folder where you have the Bridge:'}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">
                      <code className="bg-black/20 px-1.5 py-0.5 rounded text-amber-300">npm install puppeteer</code>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">2</span>
                  <div>
                    <p className="text-[var(--text-primary)] font-medium text-sm">
                      {isEs ? 'Re-descarga el Bridge' : 'Re-download the Bridge'}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5">
                      {isEs ? 'La nueva versión incluye Browser Automation' : 'The new version includes Browser Automation'}
                    </p>
                    <button onClick={downloadBridge} className="text-xs text-amber-400 hover:text-amber-300 mt-1 flex items-center gap-1 font-medium">
                      <Download className="w-3 h-3" />
                      {isEs ? 'Descargar Bridge v3.1 Stealth' : 'Download Bridge v3.1 Stealth'}
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">3</span>
                  <div>
                    <p className="text-[var(--text-primary)] font-medium text-sm">
                      {isEs ? 'Reinicia el Bridge' : 'Restart the Bridge'}
                    </p>
                    <p className="text-[var(--text-muted)] text-xs mt-1">
                      {isEs ? 'Detén el bridge actual (Ctrl+C) y ejecuta: node octopus-browser-bridge.js' : 'Stop current bridge (Ctrl+C) and run: node octopus-browser-bridge.js'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-amber-500/10">
                <p className="text-xs text-[var(--text-muted)]">
                  {isEs
                    ? '💡 El Bridge v3.1 incluye anti-detección stealth (evita CAPTCHAs de Google). Las dependencias se instalan automáticamente la primera vez. Verás "🛡️ Anti-detección activada" en la consola.'
                    : '💡 Bridge v3.1 includes stealth anti-detection (bypasses Google CAPTCHAs). Dependencies auto-install on first run. You\'ll see "🛡️ Anti-detection active" in the console.'}
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel — Sessions + Templates */}
        <div className="lg:col-span-3 space-y-3">
          {/* Tab Toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] overflow-hidden">
            <button
              onClick={() => setLeftTab('sessions')}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap min-w-0 ${
                leftTab === 'sessions'
                  ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <Terminal className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{isEs ? 'Sesiones' : 'Sessions'}</span>
            </button>
            <button
              onClick={() => { setLeftTab('templates'); if (templates.length === 0) fetchTemplates() }}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap min-w-0 ${
                leftTab === 'templates'
                  ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <LayoutTemplate className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{isEs ? 'Plantillas' : 'Templates'}</span>
              {templates.length > 0 && (
                <span className="text-[9px] px-1 py-0 rounded-full bg-amber-500/20 text-amber-300 font-bold min-w-[14px] flex-shrink-0">
                  {templates.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setLeftTab('scheduled'); if (scheduledTasks.length === 0) fetchScheduledTasks() }}
              className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap min-w-0 ${
                leftTab === 'scheduled'
                  ? 'bg-amber-500/20 text-amber-400 shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              <CalendarClock className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">Cron</span>
              {scheduledTasks.filter(t => t.status === 'active').length > 0 && (
                <span className="text-[9px] px-1 py-0 rounded-full bg-green-500/20 text-green-300 font-bold min-w-[14px] flex-shrink-0">
                  {scheduledTasks.filter(t => t.status === 'active').length}
                </span>
              )}
            </button>
          </div>

          {/* Sessions List */}
          {leftTab === 'sessions' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
                  {isEs ? 'Sesiones' : 'Sessions'}
                </h3>
                <button
                  onClick={createSession}
                  className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : sessions.length === 0 ? (
                <Card className="p-4 text-center">
                  <Monitor className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {isEs ? 'No hay sesiones aún' : 'No sessions yet'}
                  </p>
                  <button
                    onClick={createSession}
                    className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                  >
                    {isEs ? '+ Crear primera sesión' : '+ Create first session'}
                  </button>
                </Card>
              ) : (
                <div className="space-y-2">
                  {sessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSession(s)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        activeSession?.id === s.id
                          ? 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                          : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">{s.name}</span>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${
                            s.status === 'running' ? 'bg-green-400 animate-pulse' :
                            s.status === 'error' ? 'bg-red-400' : 'bg-gray-500'
                          }`} />
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id) }}
                            className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {s.currentUrl && (
                        <p className="text-xs text-[var(--text-muted)] mt-1 truncate">
                          {s.currentUrl}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                        <Terminal className="w-3 h-3" />
                        <span>{s._count?.commands || 0} {isEs ? 'comandos' : 'commands'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Templates List */}
          {leftTab === 'templates' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
                  {isEs ? 'Plantillas' : 'Templates'}
                </h3>
                <button
                  onClick={openCreateTemplate}
                  className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  title={isEs ? 'Crear plantilla' : 'Create template'}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {templatesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted)]" />
                </div>
              ) : templates.length === 0 ? (
                <Card className="p-4 text-center">
                  <LayoutTemplate className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--text-muted)]">
                    {isEs ? 'No hay plantillas aún' : 'No templates yet'}
                  </p>
                  <button
                    onClick={openCreateTemplate}
                    className="mt-2 text-xs text-amber-400 hover:text-amber-300"
                  >
                    {isEs ? '+ Crear primera plantilla' : '+ Create first template'}
                  </button>
                </Card>
              ) : (
                <div className="space-y-2">
                  {templates.map(tpl => (
                    <div
                      key={tpl.id}
                      className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-amber-500/20 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{tpl.name}</p>
                          {tpl.description && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5 truncate">{tpl.description}</p>
                          )}
                        </div>
                        {tpl.category && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${getCategoryColor(tpl.category)}`}>
                            {tpl.category}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--text-muted)]">
                        <span>{tpl.steps?.length || 0} {isEs ? 'pasos' : 'steps'}</span>
                        {tpl.variables && Array.isArray(tpl.variables) && tpl.variables.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Variable className="w-2.5 h-2.5" />
                            {tpl.variables.length} {isEs ? 'vars' : 'vars'}
                          </span>
                        )}
                        {tpl.useCount > 0 && (
                          <span>× {tpl.useCount}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <button
                          onClick={() => openRunTemplate(tpl)}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] font-medium transition-colors"
                          title={isEs ? 'Ejecutar' : 'Run'}
                        >
                          <PlayCircle className="w-3 h-3" />
                          {isEs ? 'Ejecutar' : 'Run'}
                        </button>
                        <button
                          onClick={() => openEditTemplate(tpl)}
                          className="p-1 rounded-md hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-amber-400 transition-colors"
                          title={isEs ? 'Editar' : 'Edit'}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => duplicateTemplate(tpl.id)}
                          className="p-1 rounded-md hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-blue-400 transition-colors"
                          title={isEs ? 'Duplicar' : 'Duplicate'}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteTemplate(tpl.id)}
                          className="p-1 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                          title={isEs ? 'Eliminar' : 'Delete'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Scheduled Tasks List */}
          {leftTab === 'scheduled' && (
            <>
              <Button onClick={() => { if (templates.length === 0) fetchTemplates(); setShowScheduleModal(true) }} className="w-full text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                <Plus className="w-3.5 h-3.5" />
                {isEs ? 'Programar Tarea' : 'Schedule Task'}
              </Button>
              {scheduledLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                </div>
              ) : scheduledTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarClock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-muted)]">
                    {isEs ? 'Sin tareas programadas' : 'No scheduled tasks'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledTasks.map(task => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-amber-500/30 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate flex-1">{task.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          task.status === 'active' ? 'bg-green-500/20 text-green-400' :
                          task.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                          task.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] mb-1">
                        📄 {task.template.name} — ⏰ {task.schedule}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {isEs ? 'Ejecutado' : 'Runs'}: {task.runCount}x
                        {task.lastRun && ` — ${isEs ? 'Última' : 'Last'}: ${new Date(task.lastRun).toLocaleString()}`}
                      </p>
                      {task.nextRun && (
                        <p className="text-[10px] text-amber-400 mt-0.5">
                          {isEs ? 'Próxima' : 'Next'}: {new Date(task.nextRun).toLocaleString()}
                        </p>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <button onClick={() => triggerScheduledTask(task.id)} className="p-1 rounded hover:bg-green-500/10 text-green-400" title={isEs ? 'Ejecutar ahora' : 'Run now'}>
                          <Play className="w-3 h-3" />
                        </button>
                        <button onClick={() => toggleScheduledTask(task.id)} className="p-1 rounded hover:bg-yellow-500/10 text-yellow-400" title={task.status === 'active' ? (isEs ? 'Pausar' : 'Pause') : (isEs ? 'Reanudar' : 'Resume')}>
                          {task.status === 'active' ? <PauseCircle className="w-3 h-3" /> : <PlayCircle className="w-3 h-3" />}
                        </button>
                        <button onClick={() => deleteScheduledTask(task.id)} className="p-1 rounded hover:bg-red-500/10 text-red-400" title={isEs ? 'Eliminar' : 'Delete'}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Main Area */}
        <div className="lg:col-span-9 space-y-4">
          {!activeSession ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
                <Monitor className="w-8 h-8 text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
                {isEs ? 'Browser Automation Brazo' : 'Browser Automation Arm'}
              </h3>
              <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-4">
                {isEs
                  ? 'Controla cualquier sitio web con comandos de texto. Publica en redes, automatiza CRMs, llena formularios — todo desde OCTOPUS.'
                  : 'Control any website with text commands. Post on social media, automate CRMs, fill forms — all from OCTOPUS.'}
              </p>
              <div className="flex items-center justify-center gap-3">
                <Button onClick={createSession} className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0">
                  <Plus className="w-4 h-4" />
                  {isEs ? 'Nueva Sesión' : 'New Session'}
                </Button>
                {!bridgeConnected && (
                  <Button onClick={() => setShowSetup(true)} variant="outline" className="gap-2">
                    <Download className="w-4 h-4" />
                    {isEs ? 'Activar Browser Automation' : 'Enable Browser Automation'}
                  </Button>
                )}
              </div>
              {/* Feature grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                {[
                  { icon: Globe, label: isEs ? 'Navegar webs' : 'Browse websites', color: 'text-blue-400' },
                  { icon: MousePointerClick, label: isEs ? 'Click & Type' : 'Click & Type', color: 'text-green-400' },
                  { icon: LayoutTemplate, label: isEs ? 'Plantillas' : 'Templates', color: 'text-purple-400' },
                  { icon: Eye, label: isEs ? 'Extraer datos' : 'Extract data', color: 'text-cyan-400' },
                ].map((f, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <f.icon className={`w-5 h-5 ${f.color} mx-auto mb-1`} />
                    <p className="text-xs text-[var(--text-muted)]">{f.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <>
              {/* Screenshot/Preview Area */}
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${bridgeConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {activeSession.name}
                    </span>
                    {activeSession.currentUrl && (
                      <span className="text-xs text-[var(--text-muted)] truncate max-w-[300px]">
                        — {activeSession.currentUrl}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Recorder controls */}
                    {bridgeConnected && (
                      isRecording ? (
                        <button
                          onClick={stopRecording}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors animate-pulse"
                          title={isEs ? 'Detener grabación' : 'Stop recording'}
                        >
                          <Square className="w-3 h-3" />
                          {isEs ? 'Detener REC' : 'Stop REC'}
                        </button>
                      ) : (
                        <button
                          onClick={startRecording}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                          title={isEs ? 'Grabar acciones como plantilla' : 'Record actions as template'}
                        >
                          <Circle className="w-3 h-3 fill-current" />
                          REC
                        </button>
                      )
                    )}
                    {/* Save as Template button */}
                    {activeSession.commands && activeSession.commands.filter(c => c.status === 'completed').length > 0 && (
                      <button
                        onClick={saveSessionAsTemplate}
                        disabled={savingTemplate}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 transition-colors disabled:opacity-50"
                        title={isEs ? 'Guardar como plantilla' : 'Save as template'}
                      >
                        {savingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {isEs ? 'Guardar Plantilla' : 'Save Template'}
                      </button>
                    )}
                    <button
                      onClick={fetchSessions}
                      className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Screenshot display */}
                <div className="relative bg-black/40 min-h-[320px] flex items-center justify-center">
                  {activeSession.lastScreenshot ? (
                    <img
                      src={activeSession.lastScreenshot}
                      alt="Browser screenshot"
                      className="w-full h-auto max-h-[500px] object-contain"
                    />
                  ) : (
                    <div className="text-center py-16">
                      <ImageIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        {bridgeConnected
                          ? (isEs ? 'Envía un comando para ver el navegador aquí' : 'Send a command to see the browser here')
                          : (isEs ? 'Conecta el Bridge para empezar' : 'Connect the Bridge to start')}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Command Input */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setCommandMode('natural')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      commandMode === 'natural'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isEs ? 'Lenguaje Natural' : 'Natural Language'}
                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">AI</span>
                  </button>
                  <button
                    onClick={() => setCommandMode('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      commandMode === 'manual'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                    }`}
                  >
                    <Terminal className="w-3 h-3 inline mr-1" />
                    {isEs ? 'Manual' : 'Manual'}
                  </button>
                </div>

                {commandMode === 'natural' ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type="text"
                          value={commandInput}
                          onChange={(e) => setCommandInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && sendNaturalCommand()}
                          placeholder={isEs
                            ? 'Ej: "Abre Google y busca OCTOPUS AI" o "Haz click en Sign In"'
                            : 'E.g.: "Open Google and search OCTOPUS AI" or "Click on Sign In"'}
                          className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                          disabled={!bridgeConnected || sending}
                        />
                        {aiParsing && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                            <span className="text-[10px] text-amber-400 font-medium">AI</span>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={sendNaturalCommand}
                        disabled={!commandInput.trim() || sending || !bridgeConnected}
                        className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                    {/* Quick command suggestions */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        isEs ? 'Toma un screenshot' : 'Take a screenshot',
                        isEs ? 'Baja la página' : 'Scroll down',
                        isEs ? 'Abre Google' : 'Open Google',
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => setCommandInput(suggestion)}
                          className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Command type selector */}
                    <div className="flex flex-wrap gap-2">
                      {COMMAND_TYPES.map(ct => (
                        <button
                          key={ct.value}
                          onClick={() => {
                            setManualType(ct.value)
                            const newParams: Record<string, string> = {}
                            ct.paramFields.forEach(f => { newParams[f.name] = '' })
                            setManualParams(newParams)
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            manualType === ct.value
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border-color)] hover:border-amber-500/20'
                          }`}
                        >
                          <ct.icon className="w-3 h-3" />
                          {ct.label}
                        </button>
                      ))}
                    </div>
                    {/* Param fields */}
                    <div className="flex gap-2">
                      {COMMAND_TYPES.find(c => c.value === manualType)?.paramFields.map(f => (
                        <input
                          key={f.name}
                          type="text"
                          value={manualParams[f.name] || ''}
                          onChange={(e) => setManualParams({ ...manualParams, [f.name]: e.target.value })}
                          placeholder={f.placeholder}
                          className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                          disabled={!bridgeConnected}
                        />
                      ))}
                      <Button
                        onClick={sendManualCommand}
                        disabled={sending || !bridgeConnected}
                        className="gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}

                {!bridgeConnected && (
                  <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />
                    {isEs
                      ? 'Bridge desconectado — ejecuta el script en tu PC para empezar'
                      : 'Bridge disconnected — run the script on your PC to start'}
                  </p>
                )}
              </Card>

              {/* Command History */}
              {activeSession.commands && activeSession.commands.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-[var(--text-secondary)]">
                      {isEs ? 'Historial de Comandos' : 'Command History'}
                    </h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
                      {activeSession.commands.filter(c => c.status === 'completed').length}/{activeSession.commands.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {activeSession.commands.map(cmd => (
                      <div key={cmd.id} className={`p-2.5 rounded-lg border transition-all ${
                        cmd.status === 'sent' ? 'bg-amber-500/5 border-amber-500/20 animate-pulse' :
                        cmd.status === 'failed' ? 'bg-red-500/5 border-red-500/20' :
                        cmd.status === 'completed' ? 'bg-green-500/5 border-green-500/10' :
                        'bg-[var(--bg-secondary)] border-[var(--border-color)]'
                      }`}>
                        <div className="flex items-center gap-2.5">
                          {cmdStatusIcon(cmd.status)}
                          <span className="text-xs font-mono text-amber-400 font-semibold">{cmd.type}</span>
                          {cmd.params && (
                            <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[200px] font-mono">
                              {cmd.type === 'goto' && (cmd.params as any)?.url
                                ? (cmd.params as any).url.replace(/^https?:\/\//, '').substring(0, 40)
                                : cmd.type === 'click' && (cmd.params as any)?.selector
                                ? `"${(cmd.params as any).selector}"`
                                : cmd.type === 'type' && (cmd.params as any)?.text
                                ? `"${(cmd.params as any).text.substring(0, 30)}"`
                                : cmd.type === 'evaluate' && (cmd.params as any)?.code
                                ? (cmd.params as any).code.substring(0, 40)
                                : ''}
                            </span>
                          )}
                          <span className="flex-1" />
                          {cmd.duration && (
                            <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{cmd.duration}ms</span>
                          )}
                          {cmd.screenshotUrl && (
                            <button
                              onClick={() => {
                                if (activeSession) {
                                  setActiveSession({ ...activeSession, lastScreenshot: cmd.screenshotUrl })
                                }
                              }}
                              className="p-1 rounded hover:bg-amber-500/10 text-amber-400"
                              title={isEs ? 'Ver captura' : 'View screenshot'}
                            >
                              <Camera className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {cmd.error && (
                          <p className="text-[10px] text-red-400 mt-1.5 ml-6 font-mono">
                            ⚠ {cmd.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ Template Create/Edit Modal ═══ */}
      <AnimatePresence>
        {showTemplateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowTemplateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <LayoutTemplate className="w-5 h-5 text-amber-400" />
                  {editingTemplate
                    ? (isEs ? 'Editar Plantilla' : 'Edit Template')
                    : (isEs ? 'Crear Plantilla' : 'Create Template')}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                    {isEs ? 'Nombre' : 'Name'} *
                  </label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder={isEs ? 'Ej: Publicar en Instagram' : 'E.g.: Post to Instagram'}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                    {isEs ? 'Descripción' : 'Description'}
                  </label>
                  <input
                    type="text"
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                    placeholder={isEs ? 'Qué hace esta plantilla...' : 'What this template does...'}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                    {isEs ? 'Categoría' : 'Category'}
                  </label>
                  <div className="flex gap-2">
                    {['social', 'scraping', 'forms', 'general'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setTemplateForm({ ...templateForm, category: cat })}
                        className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                          templateForm.category === cat
                            ? getCategoryColor(cat)
                            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                    {isEs ? 'Pasos (JSON)' : 'Steps (JSON)'} *
                  </label>
                  <p className="text-[10px] text-[var(--text-muted)] mb-2">
                    {isEs
                      ? 'Usa {{variable}} para valores dinámicos. Ej: {{mensaje}}, {{url}}'
                      : 'Use {{variable}} for dynamic values. E.g.: {{message}}, {{url}}'}
                  </p>
                  <textarea
                    value={templateForm.steps}
                    onChange={(e) => setTemplateForm({ ...templateForm, steps: e.target.value })}
                    rows={8}
                    placeholder='[{"type": "goto", "url": "https://{{site}}"}, {"type": "click", "selector": "Login"}]'
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
                <Button variant="outline" onClick={() => setShowTemplateModal(false)} className="text-xs">
                  {isEs ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button
                  onClick={saveTemplateForm}
                  disabled={!templateForm.name.trim() || !templateForm.steps.trim() || savingTemplate}
                  className="text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"
                >
                  {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {isEs ? 'Guardar' : 'Save'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Run Template Modal ═══ */}
      <AnimatePresence>
        {showRunModal && runningTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowRunModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <PlayCircle className="w-5 h-5 text-amber-400" />
                  {isEs ? 'Ejecutar Plantilla' : 'Run Template'}
                </h3>
                <button onClick={() => setShowRunModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{runningTemplate.name}</p>
                  {runningTemplate.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{runningTemplate.description}</p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)] mt-2">
                    {runningTemplate.steps?.length || 0} {isEs ? 'pasos' : 'steps'}
                  </p>
                </div>

                {/* Session selector info */}
                {!activeSession ? (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {isEs
                      ? '⚠ Necesitas una sesión activa para ejecutar la plantilla. Crea o selecciona una sesión primero.'
                      : '⚠ You need an active session to run the template. Create or select a session first.'}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">
                    {isEs ? 'Sesión:' : 'Session:'}{' '}
                    <span className="text-amber-400 font-medium">{activeSession.name}</span>
                  </p>
                )}

                {/* Variable inputs */}
                {runningTemplate.variables && Array.isArray(runningTemplate.variables) && runningTemplate.variables.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-[var(--text-secondary)] flex items-center gap-1">
                      <Variable className="w-3.5 h-3.5" />
                      {isEs ? 'Variables' : 'Variables'}
                    </p>
                    {runningTemplate.variables.map((v: any) => (
                      <div key={v.key}>
                        <label className="text-[10px] text-[var(--text-muted)] mb-1 block font-mono">
                          {`{{${v.key}}}`} {v.label && v.label !== v.key ? `— ${v.label}` : ''}
                        </label>
                        <input
                          type="text"
                          value={templateVars[v.key] || ''}
                          onChange={(e) => setTemplateVars({ ...templateVars, [v.key]: e.target.value })}
                          placeholder={v.defaultValue || v.key}
                          className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
                <Button variant="outline" onClick={() => setShowRunModal(false)} className="text-xs">
                  {isEs ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button
                  onClick={executeTemplate}
                  disabled={!activeSession || runningTemplateAction}
                  className="text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"
                >
                  {runningTemplateAction ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  {isEs ? 'Ejecutar' : 'Run'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Save Modal */}
      <AnimatePresence>
        {showRecordingSaveModal && recordedSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowRecordingSaveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Circle className="w-4 h-4 text-red-400" />
                  {isEs ? 'Guardar Grabación' : 'Save Recording'}
                </h3>
                <button onClick={() => setShowRecordingSaveModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">
                    {isEs ? 'Nombre de la plantilla' : 'Template Name'}
                  </label>
                  <input
                    type="text"
                    value={recordingName}
                    onChange={(e) => setRecordingName(e.target.value)}
                    placeholder={isEs ? 'Mi grabación...' : 'My recording...'}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    {isEs ? `${recordedSteps.length} pasos grabados:` : `${recordedSteps.length} recorded steps:`}
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    {recordedSteps.map((step: any, i: number) => (
                      <div key={i} className="text-[10px] font-mono text-[var(--text-secondary)] flex items-start gap-2 py-1">
                        <span className="text-amber-400/60 shrink-0 w-5 text-right">{i + 1}.</span>
                        <span>
                          <span className="text-amber-400 font-semibold">{step.action || step.type}</span>
                          {step.selector && <span className="text-[var(--text-muted)]"> → {step.selector.substring(0, 50)}</span>}
                          {step.value && <span className="text-green-400"> = &quot;{step.value.substring(0, 30)}&quot;</span>}
                          {step.url && <span className="text-blue-400"> {step.url.substring(0, 50)}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
                <Button variant="outline" onClick={() => setShowRecordingSaveModal(false)} className="text-xs">
                  {isEs ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button
                  onClick={saveRecordingAsTemplate}
                  disabled={!recordingName.trim()}
                  className="text-xs gap-1.5 bg-gradient-to-r from-red-500 to-pink-600 text-white border-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isEs ? 'Guardar como Plantilla' : 'Save as Template'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule Create Modal */}
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-amber-400" />
                  {isEs ? 'Programar Tarea' : 'Schedule Task'}
                </h3>
                <button onClick={() => setShowScheduleModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{isEs ? 'Nombre' : 'Name'}</label>
                  <input
                    type="text"
                    value={scheduleForm.name}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })}
                    placeholder={isEs ? 'Nombre de la tarea...' : 'Task name...'}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{isEs ? 'Plantilla' : 'Template'}</label>
                  <select
                    value={scheduleForm.templateId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, templateId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="">{isEs ? '— Seleccionar plantilla —' : '— Select template —'}</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">{isEs ? 'Horario' : 'Schedule'}</label>
                  <select
                    value={scheduleForm.schedule}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, schedule: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="every 30m">{isEs ? 'Cada 30 min' : 'Every 30 min'}</option>
                    <option value="every 1h">{isEs ? 'Cada 1 hora' : 'Every 1 hour'}</option>
                    <option value="every 6h">{isEs ? 'Cada 6 horas' : 'Every 6 hours'}</option>
                    <option value="every 12h">{isEs ? 'Cada 12 horas' : 'Every 12 hours'}</option>
                    <option value="daily 09:00">{isEs ? 'Diario a las 9:00' : 'Daily at 9:00'}</option>
                    <option value="daily 18:00">{isEs ? 'Diario a las 18:00' : 'Daily at 18:00'}</option>
                    <option value="once">{isEs ? 'Una vez (ahora)' : 'Once (now)'}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)] mb-1 block">
                    {isEs ? 'Variables (JSON)' : 'Variables (JSON)'}
                  </label>
                  <textarea
                    value={scheduleForm.variables}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, variables: e.target.value })}
                    rows={3}
                    placeholder='{"url": "https://example.com"}'
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/50 resize-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border-color)]">
                <Button variant="outline" onClick={() => setShowScheduleModal(false)} className="text-xs">
                  {isEs ? 'Cancelar' : 'Cancel'}
                </Button>
                <Button
                  onClick={createScheduledTask}
                  disabled={!scheduleForm.name.trim() || !scheduleForm.templateId || scheduleSaving}
                  className="text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white border-0"
                >
                  {scheduleSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
                  {isEs ? 'Crear Tarea' : 'Create Task'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
