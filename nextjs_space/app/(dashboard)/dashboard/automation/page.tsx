'use client'

/**
 * AUTOMATION LIST — La nueva cara del Social Bridge
 *
 * Tarjetas por plataforma: credenciales propias + auto-login vía Bridge
 * + skills sugeridas que se ejecutan con feedback real.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  KeyRound, LogIn, Trash2, X, Loader2, Zap, CheckCircle2,
  AlertTriangle, ExternalLink, Eye, EyeOff, Play,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useI18n } from '@/lib/i18n-context'

interface PlatformInfo {
  id: string
  name: string
  emoji: string
  color: string
  url: string
  group: string
  descriptionEs: string
  descriptionEn: string
  suggestedSkillsEs: string[]
  suggestedSkillsEn: string[]
  autoLogin: boolean
  connected: boolean
  username: string | null
  connectedAt: string | null
}

interface BridgeStatus {
  online: boolean
}

const GROUP_LABELS: Record<string, { es: string; en: string }> = {
  publishing: { es: '📤 Publicación', en: '📤 Publishing' },
  social: { es: '🌐 Redes Sociales', en: '🌐 Social Networks' },
  content: { es: '🎬 Contenido', en: '🎬 Content' },
  analytics: { es: '📊 Analítica', en: '📊 Analytics' },
}

export default function AutomationPage() {
  const { locale } = useI18n()
  const isEn = locale === 'en'

  const [platforms, setPlatforms] = useState<PlatformInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [bridge, setBridge] = useState<BridgeStatus>({ online: false })

  // Modal de credenciales
  const [credModal, setCredModal] = useState<PlatformInfo | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  // Estado de acciones por plataforma
  const [actionState, setActionState] = useState<Record<string, { busy: boolean; message: string | null; ok: boolean }>>({})

  const setAction = (id: string, busy: boolean, message: string | null = null, ok = true) =>
    setActionState(prev => ({ ...prev, [id]: { busy, message, ok } }))

  const loadPlatforms = useCallback(async () => {
    try {
      const res = await fetch('/api/automation')
      if (res.ok) {
        const data = await res.json()
        setPlatforms(data.platforms || [])
      }
    } catch { /* red caída — la UI muestra vacío */ }
    setLoading(false)
  }, [])

  const checkBridge = useCallback(async () => {
    try {
      const res = await fetch('/api/brazos/health')
      if (res.ok) {
        const data = await res.json()
        const browserArm = (data.brazos || []).find((b: { armType: string; status: string }) => b.armType === 'browser_automation')
        setBridge({ online: browserArm?.status === 'healthy' })
      }
    } catch { setBridge({ online: false }) }
  }, [])

  useEffect(() => {
    loadPlatforms()
    checkBridge()
    const interval = setInterval(checkBridge, 30000)
    return () => clearInterval(interval)
  }, [loadPlatforms, checkBridge])

  const saveCredentials = async () => {
    if (!credModal || !username.trim() || !password.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: credModal.id, username: username.trim(), password }),
      })
      if (res.ok) {
        setCredModal(null)
        setUsername('')
        setPassword('')
        await loadPlatforms()
      }
    } finally {
      setSaving(false)
    }
  }

  const removeCredentials = async (p: PlatformInfo) => {
    setAction(p.id, true)
    try {
      await fetch(`/api/automation?platform=${p.id}`, { method: 'DELETE' })
      await loadPlatforms()
    } finally {
      setAction(p.id, false)
    }
  }

  const doLogin = async (p: PlatformInfo) => {
    setAction(p.id, true, isEn ? 'Sending to Bridge...' : 'Enviando al Bridge...')
    try {
      const res = await fetch('/api/automation/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: p.id }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAction(p.id, false, data.message, true)
      } else {
        setAction(p.id, false, data.message || (isEn ? 'Bridge offline — open Octopus Bridge on your PC' : 'Bridge desconectado — abre el Octopus Bridge en tu PC'), false)
      }
    } catch {
      setAction(p.id, false, isEn ? 'Connection error' : 'Error de conexión', false)
    }
  }

  const runSkill = async (p: PlatformInfo, skill: string) => {
    setAction(p.id, true, `⚡ ${skill}...`)
    try {
      // Crear sesión y enviar como ai_task (la skill NO contiene credenciales)
      const sessRes = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_session', name: `${p.name}: ${skill.substring(0, 30)}` }),
      })
      const sessData = await sessRes.json()
      const sessionId = sessData.session?.id
      if (!sessionId) throw new Error('no_session')

      const taskRes = await fetch('/api/browser-bridge/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_task',
          sessionId,
          task: `${isEn ? 'On' : 'En'} ${p.url}: ${skill}`,
        }),
      })
      const taskData = await taskRes.json()
      if (taskRes.ok && (taskData.commands?.length ?? 0) > 0) {
        setAction(p.id, false, isEn
          ? `✅ ${taskData.commands.length} commands sent to Bridge`
          : `✅ ${taskData.commands.length} comandos enviados al Bridge`, true)
      } else {
        setAction(p.id, false, isEn ? 'Could not parse the task' : 'No se pudo interpretar la tarea', false)
      }
    } catch {
      setAction(p.id, false, isEn ? 'Error executing skill' : 'Error ejecutando la skill', false)
    }
  }

  // Agrupar plataformas
  const groups = ['publishing', 'social', 'content', 'analytics']
    .map(g => ({ id: g, items: platforms.filter(p => p.group === g) }))
    .filter(g => g.items.length > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            ⚡ {isEn ? 'Automation List' : 'Lista de Automatización'}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {isEn
              ? 'Your platforms, your credentials, real automation through the Bridge'
              : 'Tus plataformas, tus credenciales, automatización real a través del Bridge'}
          </p>
        </div>
        {/* Bridge status */}
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${
          bridge.online
            ? 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400'
            : 'bg-red-500/10 border-red-500/30 text-red-500'
        }`}>
          <span className={`w-2 h-2 rounded-full ${bridge.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          Bridge {bridge.online ? (isEn ? 'connected' : 'conectado') : (isEn ? 'offline' : 'desconectado')}
        </div>
      </div>

      {/* Aviso si el bridge está offline */}
      {!bridge.online && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[var(--text-secondary)]">
            {isEn
              ? 'The Bridge is offline. You can save credentials now, but to execute logins and skills open the Octopus Bridge on your PC (Browser Automation section → download).'
              : 'El Bridge está desconectado. Puedes guardar credenciales ahora, pero para ejecutar logins y skills abre el Octopus Bridge en tu PC (sección Browser Automation → descargar).'}
          </p>
        </div>
      )}

      {/* Grupos de plataformas */}
      {groups.map(group => (
        <div key={group.id}>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-3">
            {isEn ? GROUP_LABELS[group.id].en : GROUP_LABELS[group.id].es}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.items.map(p => {
              const state = actionState[p.id]
              return (
                <motion.div key={p.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="p-5 h-full flex flex-col gap-3 card-shine">
                    {/* Cabecera de tarjeta */}
                    <div className="flex items-start gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: `${p.color}18`, border: `1px solid ${p.color}40` }}
                      >
                        {p.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold truncate">{p.name}</h3>
                          <a href={p.url} target="_blank" rel="noopener noreferrer"
                            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                          {isEn ? p.descriptionEn : p.descriptionEs}
                        </p>
                      </div>
                      {p.connected && (
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      )}
                    </div>

                    {/* Estado de credenciales */}
                    {p.connected ? (
                      <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-green-500/8 border border-green-500/20">
                        <span className="text-[var(--text-secondary)] truncate">
                          <KeyRound className="w-3 h-3 inline mr-1.5 text-green-500" />
                          {p.username || (isEn ? 'Credentials saved' : 'Credenciales guardadas')}
                        </span>
                        <button
                          onClick={() => removeCredentials(p)}
                          className="text-[var(--text-muted)] hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                          title={isEn ? 'Remove credentials' : 'Eliminar credenciales'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setCredModal(p); setUsername(''); setPassword('') }}
                        className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:border-[#C4622D]/50 hover:text-[#C4622D] transition-all"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {isEn ? 'Add credentials' : 'Añadir credenciales'}
                      </button>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => doLogin(p)}
                        disabled={state?.busy || !bridge.online}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                          bridge.online
                            ? 'bg-[#2D4A3E] text-[#F5F0E8] hover:opacity-90'
                            : 'bg-[var(--hover-bg)] text-[var(--text-muted)] cursor-not-allowed'
                        }`}
                        title={!bridge.online ? (isEn ? 'Bridge offline' : 'Bridge desconectado') : ''}
                      >
                        {state?.busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                        {p.connected && p.autoLogin
                          ? (isEn ? 'Auto-Login' : 'Auto-Login')
                          : (isEn ? 'Open login' : 'Abrir login')}
                      </button>
                    </div>

                    {/* Skills sugeridas */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Skills
                      </p>
                      {(isEn ? p.suggestedSkillsEn : p.suggestedSkillsEs).slice(0, 3).map((skill, i) => (
                        <button
                          key={i}
                          onClick={() => runSkill(p, skill)}
                          disabled={state?.busy || !bridge.online}
                          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-left text-[var(--text-secondary)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-primary)] transition-all disabled:opacity-40 disabled:cursor-not-allowed group"
                        >
                          <Play className="w-3 h-3 flex-shrink-0 opacity-40 group-hover:opacity-100" style={{ color: p.color }} />
                          <span className="truncate">{skill}</span>
                        </button>
                      ))}
                    </div>

                    {/* Feedback de acción */}
                    <AnimatePresence>
                      {state?.message && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className={`text-xs px-3 py-2 rounded-lg ${
                            state.ok
                              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                              : 'bg-red-500/10 text-red-500'
                          }`}
                        >
                          {state.message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Modal de credenciales */}
      <AnimatePresence>
        {credModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setCredModal(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 10 }}
              className="bg-[var(--card-bg)] rounded-3xl p-6 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{credModal.emoji}</span>
                  <div>
                    <h2 className="font-bold">{credModal.name}</h2>
                    <p className="text-xs text-[var(--text-muted)]">
                      {isEn ? 'Login credentials' : 'Credenciales de acceso'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setCredModal(null)} className="p-2 rounded-xl hover:bg-[var(--hover-bg)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                    {isEn ? 'Username / Email' : 'Usuario / Email'}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] text-sm outline-none focus:border-[#C4622D]/50"
                    placeholder={isEn ? 'you@email.com' : 'tu@email.com'}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
                    {isEn ? 'Password' : 'Contraseña'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-10 rounded-xl border border-[var(--border-color)] bg-[var(--input-bg)] text-sm outline-none focus:border-[#C4622D]/50"
                      placeholder="••••••••"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  🔒 {isEn
                    ? 'Stored encrypted. Only used to build browser commands on YOUR PC via the Bridge — never sent to any AI model.'
                    : 'Se guardan cifradas. Solo se usan para construir comandos de navegador en TU PC vía el Bridge — nunca se envían a ningún modelo de IA.'}
                </p>

                <button
                  onClick={saveCredentials}
                  disabled={saving || !username.trim() || !password.trim()}
                  className="w-full py-2.5 rounded-xl bg-[#C4622D] text-white font-semibold text-sm hover:opacity-90 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isEn ? 'Save credentials' : 'Guardar credenciales'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
