'use client'

/**
 * HOGAR — Escenas inteligentes
 *
 * UI para el modelo SmartScene (existía en backend sin interfaz).
 * Ejecuta vía POST /api/hogar/scenes/run con feedback real anti-smoke:
 * el resultado reporta cuántos comandos se ejecutaron (HubSpace directo)
 * y cuántos quedaron encolados al Bridge (WiZ).
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Plus, Trash2, X, Loader2, Sparkles, Moon, Sun } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SceneCommand {
  deviceId: string
  action: string
  params?: { brightness?: number; colorTemp?: number }
}

interface SmartScene {
  id: string
  name: string
  icon: string
  commands: SceneCommand[]
}

interface DeviceLite {
  id: string
  name: string
  type: string
  room: string | null
}

const SCENE_EMOJIS = ['✨', '🌙', '☀️', '🎬', '🎮', '📖', '🍽️', '💼', '🛏️', '🎉', '🧘', '🌅']

interface Props {
  devices: DeviceLite[]
  locale: 'es' | 'en'
  onSceneRun: () => void
  addActivity: (msg: string, type: 'success' | 'error') => void
}

export function HogarScenes({ devices, locale, onSceneRun, addActivity }: Props) {
  const es = locale === 'es'
  const [scenes, setScenes] = useState<SmartScene[]>([])
  const [running, setRunning] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('✨')
  const [deviceStates, setDeviceStates] = useState<Record<string, { include: boolean; action: 'on' | 'off'; brightness?: number }>>({})
  const [saving, setSaving] = useState(false)

  const fetchScenes = useCallback(async () => {
    try {
      const res = await fetch('/api/hogar/scenes')
      const data = await res.json()
      if (data.scenes) setScenes(data.scenes)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchScenes() }, [fetchScenes])

  function showResult(data: { executed: number; queued: number; failed: number }) {
    const parts: string[] = []
    if (data.executed > 0) parts.push(es ? `${data.executed} ejecutado(s)` : `${data.executed} executed`)
    if (data.queued > 0) parts.push(es ? `${data.queued} enviado(s) al Bridge` : `${data.queued} sent to Bridge`)
    if (data.failed > 0) parts.push(es ? `${data.failed} fallido(s)` : `${data.failed} failed`)
    setFeedback(parts.join(' · ') || (es ? 'Sin cambios' : 'No changes'))
    setTimeout(() => setFeedback(null), 4000)
  }

  async function runScene(sceneId: string, name: string) {
    setRunning(sceneId)
    try {
      const res = await fetch('/api/hogar/scenes/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sceneId }),
      })
      const data = await res.json()
      if (data.success) {
        showResult(data)
        addActivity(es ? `Escena "${name}" activada` : `Scene "${name}" activated`, 'success')
        onSceneRun()
      } else {
        addActivity(es ? `Error en escena "${name}"` : `Scene "${name}" error`, 'error')
      }
    } catch {
      addActivity(es ? 'Error ejecutando escena' : 'Error running scene', 'error')
    } finally {
      setRunning(null)
    }
  }

  async function runQuickAction(action: 'on' | 'off') {
    const id = `quick_${action}`
    setRunning(id)
    try {
      const commands = devices.map(d => ({ deviceId: d.id, action }))
      const res = await fetch('/api/hogar/scenes/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commands,
          name: action === 'off' ? (es ? 'Todo apagado' : 'All off') : (es ? 'Todo encendido' : 'All on'),
        }),
      })
      const data = await res.json()
      if (data.success) {
        showResult(data)
        onSceneRun()
      }
    } catch { /* ignore */ } finally {
      setRunning(null)
    }
  }

  async function createScene() {
    if (!newName.trim()) return
    const commands: SceneCommand[] = Object.entries(deviceStates)
      .filter(([, s]) => s.include)
      .flatMap(([deviceId, s]) => {
        const cmds: SceneCommand[] = [{ deviceId, action: s.action }]
        if (s.action === 'on' && s.brightness !== undefined) {
          cmds.push({ deviceId, action: 'brightness', params: { brightness: s.brightness } })
        }
        return cmds
      })
    if (commands.length === 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/hogar/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon, commands }),
      })
      const data = await res.json()
      if (data.scene) {
        setScenes(prev => [...prev, data.scene])
        setShowCreate(false)
        setNewName('')
        setNewIcon('✨')
        setDeviceStates({})
        addActivity(es ? `Escena "${newName.trim()}" creada` : `Scene "${newName.trim()}" created`, 'success')
      }
    } catch { /* ignore */ } finally {
      setSaving(false)
    }
  }

  async function deleteScene(id: string) {
    await fetch(`/api/hogar/scenes?id=${id}`, { method: 'DELETE' })
    setScenes(prev => prev.filter(s => s.id !== id))
  }

  if (devices.length === 0) return null

  return (
    <Card className="bg-[#1A2332]/80 border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#FFD700]" />
          {es ? 'Escenas' : 'Scenes'}
        </h3>
        <div className="flex items-center gap-2">
          {feedback && (
            <span className="text-xs text-emerald-400 animate-pulse">{feedback}</span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCreate(true)}
            className="border-[#FFD700]/30 text-[#FFD700] hover:bg-[#FFD700]/10 h-7 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            {es ? 'Nueva' : 'New'}
          </Button>
        </div>
      </div>

      {/* Scene chips: quick actions + saved scenes */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => runQuickAction('off')}
          disabled={!!running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
        >
          {running === 'quick_off' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Moon className="w-3 h-3" />}
          {es ? 'Todo apagado' : 'All off'}
        </button>
        <button
          onClick={() => runQuickAction('on')}
          disabled={!!running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
        >
          {running === 'quick_on' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sun className="w-3 h-3" />}
          {es ? 'Todo encendido' : 'All on'}
        </button>

        {scenes.map(scene => (
          <div
            key={scene.id}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 text-gray-200 border border-white/10 hover:border-[#FFD700]/40 transition-colors"
          >
            <button
              onClick={() => runScene(scene.id, scene.name)}
              disabled={!!running}
              className="flex items-center gap-1.5 disabled:opacity-50"
            >
              {running === scene.id
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <span>{scene.icon}</span>}
              {scene.name}
              <Play className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <button
              onClick={() => deleteScene(scene.id)}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-red-400 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}

        {scenes.length === 0 && (
          <span className="text-xs text-gray-500 self-center">
            {es
              ? 'Crea escenas para activar varios dispositivos de un toque'
              : 'Create scenes to trigger multiple devices in one tap'}
          </span>
        )}
      </div>

      {/* Create scene modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-[#1A2332] border border-gray-700 rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">
                  {es ? '✨ Nueva Escena' : '✨ New Scene'}
                </h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Name + emoji */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  {es ? 'Nombre' : 'Name'}
                </label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={es ? 'Modo cine, Buenas noches...' : 'Movie mode, Good night...'}
                  className="w-full bg-black/30 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFD700]/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">{es ? 'Icono' : 'Icon'}</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCENE_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewIcon(emoji)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-colors ${
                        newIcon === emoji ? 'bg-[#FFD700]/20 ring-1 ring-[#FFD700]/50' : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device states */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">
                  {es ? 'Dispositivos y estado deseado' : 'Devices and desired state'}
                </label>
                <div className="space-y-2">
                  {devices.map(d => {
                    const st = deviceStates[d.id] || { include: false, action: 'on' as const }
                    return (
                      <div key={d.id} className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2">
                        <input
                          type="checkbox"
                          checked={st.include}
                          onChange={e => setDeviceStates(prev => ({ ...prev, [d.id]: { ...st, include: e.target.checked } }))}
                          className="accent-[#FFD700]"
                        />
                        <span className="text-sm text-white flex-1 truncate">
                          {d.name}{d.room ? <span className="text-gray-500 text-xs"> · {d.room}</span> : null}
                        </span>
                        {st.include && (
                          <>
                            <button
                              onClick={() => setDeviceStates(prev => ({ ...prev, [d.id]: { ...st, action: st.action === 'on' ? 'off' : 'on' } }))}
                              className={`text-xs px-2 py-1 rounded-md font-medium ${
                                st.action === 'on'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-indigo-500/20 text-indigo-300'
                              }`}
                            >
                              {st.action === 'on' ? (es ? 'Encender' : 'On') : (es ? 'Apagar' : 'Off')}
                            </button>
                            {st.action === 'on' && d.type === 'light' && (
                              <input
                                type="number"
                                min={1}
                                max={100}
                                placeholder="%"
                                value={st.brightness ?? ''}
                                onChange={e => setDeviceStates(prev => ({
                                  ...prev,
                                  [d.id]: { ...st, brightness: e.target.value ? Number(e.target.value) : undefined },
                                }))}
                                className="w-14 bg-black/30 border border-gray-700 rounded px-1.5 py-1 text-xs text-white text-center"
                              />
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <Button
                onClick={createScene}
                disabled={saving || !newName.trim() || !Object.values(deviceStates).some(s => s.include)}
                className="w-full bg-[#C4622D] hover:bg-[#A8522A] text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {es ? 'Crear Escena' : 'Create Scene'}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
