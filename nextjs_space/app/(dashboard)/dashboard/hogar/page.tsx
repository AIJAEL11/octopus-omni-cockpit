'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Lightbulb, Thermometer, Tv, Fan, Power, Plus, Trash2,
  Wifi, WifiOff, Settings, ChevronDown, ChevronUp,
  Zap, Sun, Moon, Layers, X, Check, AlertCircle,
  Plug, Edit3, LayoutGrid, List, Palette, Download, Copy, Terminal,
  Monitor, Apple, MonitorSmartphone, Shield, Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'
import { HogarScenes } from '@/components/hogar-scenes'

/* ==================== TYPES ==================== */
interface SmartDevice {
  id: string
  name: string
  type: string
  platform: string
  externalId: string | null
  shellyId: string | null
  ipAddress: string | null
  macAddress: string | null
  room: string | null
  icon: string
  isOnline: boolean
  lastState: Record<string, unknown> | null
  mode: string
  brightness: number
  colorTemp: number
}

/* ==================== CONSTANTS ==================== */
const getDeviceTypes = (t: (k: string) => string) => [
  { value: 'light', label: t('hogar.dt_light'), icon: 'lightbulb', description: t('hogar.dt_light_desc'), wizIcon: '💡' },
  { value: 'plug', label: t('hogar.dt_plug'), icon: 'plug', description: t('hogar.dt_plug_desc'), wizIcon: '🔌' },
  { value: 'ac', label: t('hogar.dt_ac'), icon: 'snowflake', description: t('hogar.dt_ac_desc'), wizIcon: '❄️' },
  { value: 'fan', label: t('hogar.dt_fan'), icon: 'fan', description: t('hogar.dt_fan_desc'), wizIcon: '🌬️' },
  { value: 'tv', label: t('hogar.dt_tv'), icon: 'tv', description: t('hogar.dt_tv_desc'), wizIcon: '📺' },
  { value: 'relay', label: t('hogar.dt_relay'), icon: 'power', description: t('hogar.dt_relay_desc'), wizIcon: '⚡' },
]

const getRoomsPresets = (t: (k: string) => string) => [
  { value: 'Playroom', emoji: '🎮' },
  { value: t('hogar.room_sala'), emoji: '🛋️' },
  { value: t('hogar.room_dormitorio'), emoji: '🛏️' },
  { value: t('hogar.room_cocina'), emoji: '🍳' },
  { value: t('hogar.room_bano'), emoji: '🚿' },
  { value: t('hogar.room_oficina'), emoji: '💻' },
  { value: t('hogar.room_comedor'), emoji: '🍽️' },
  { value: t('hogar.room_terraza'), emoji: '🌅' },
  { value: t('hogar.room_garaje'), emoji: '🚗' },
]

const ICON_MAP: Record<string, React.ElementType> = {
  lightbulb: Lightbulb, plug: Plug, snowflake: Thermometer, tv: Tv,
  fan: Fan, power: Power, thermometer: Thermometer, layers: Layers,
  sun: Sun, moon: Moon, home: Home, zap: Zap, palette: Palette,
}

function DeviceIcon({ icon, className }: { icon: string; className?: string }) {
  const Ic = ICON_MAP[icon] || Lightbulb
  return <Ic className={className} />
}

/* Color temperature to CSS gradient */
function tempToColor(kelvin: number): string {
  if (kelvin <= 2700) return '#FF9329'
  if (kelvin <= 3500) return '#FFB347'
  if (kelvin <= 4500) return '#FFE4B5'
  if (kelvin <= 5500) return '#FFF8F0'
  return '#E8F0FF'
}

function tempToGradient(kelvin: number, brightness: number): string {
  const color = tempToColor(kelvin)
  const opacity = Math.max(0.15, brightness / 100)
  return `radial-gradient(circle at 50% 30%, ${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}, transparent 70%)`
}

/* ==================== MAIN COMPONENT ==================== */
export default function HogarInteligentePage() {
  const { addActivity } = useMetrics()
  const { t, locale } = useI18n()
  const { upgradeModal, closeUpgradeModal, handlePlanError } = usePlanGate()

  const [devices, setDevices] = useState<SmartDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [controlling, setControlling] = useState<string | null>(null)
  const [showAddDevice, setShowAddDevice] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const setupRef = useRef<HTMLDivElement>(null)
  const openSetupGuide = useCallback(() => {
    setShowSetup(true)
    setTimeout(() => {
      setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
  }, [])
  const [viewMode, setViewMode] = useState<'rooms' | 'grid'>('rooms')
  const [editingDevice, setEditingDevice] = useState<string | null>(null)

  // Bridge state
  const [bridgeToken, setBridgeToken] = useState<string | null>(null)
  const [generatingToken, setGeneratingToken] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)
  const [selectedOS, setSelectedOS] = useState<'windows' | 'mac' | 'linux'>('windows')
  const [downloadingInstaller, setDownloadingInstaller] = useState<false | 'manual' | 'service'>(false)

  // HubSpace state
  const [hsConfigured, setHsConfigured] = useState(false)
  const [hsConnected, setHsConnected] = useState(false)
  const [hsEmail, setHsEmail] = useState('')
  const [hsPassword, setHsPassword] = useState('')
  const [hsSaving, setHsSaving] = useState(false)
  const [hsError, setHsError] = useState<string | null>(null)
  const [hsDiscovering, setHsDiscovering] = useState(false)
  const [hsDiscoverResult, setHsDiscoverResult] = useState<string | null>(null)

  // Add device form
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState('light')
  const [newPlatform, setNewPlatform] = useState<'wiz' | 'hubspace'>('wiz')
  const [newRoom, setNewRoom] = useState('Playroom')
  const [customRoom, setCustomRoom] = useState('')

  /* ---- Fetch devices ---- */
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch('/api/hogar/devices')
      const data = await res.json()
      if (data.devices) {
        setDevices(data.devices)
        if (data.devices.length === 0) setShowSetup(true)
      }
    } catch (err) {
      console.error('Error fetching devices:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  /* ---- Fetch bridge token ---- */
  const fetchBridgeToken = useCallback(async () => {
    try {
      const res = await fetch('/api/hogar/bridge/token')
      const data = await res.json()
      if (data.token) setBridgeToken(data.token)
    } catch (err) {
      console.error('Error fetching bridge token:', err)
    }
  }, [])

  /* ---- Generate bridge token ---- */
  const [tokenError, setTokenError] = useState<string | null>(null)
  const generateBridgeToken = async () => {
    setGeneratingToken(true)
    setTokenError(null)
    try {
      const res = await fetch('/api/hogar/bridge/token', { method: 'POST' })
      const data = await res.json()
      if (data.token) {
        setBridgeToken(data.token)
        addActivity('Bridge token generado', 'success')
      } else if (data.error) {
        setTokenError(data.error)
        addActivity('Error generando token', 'error')
      }
    } catch (err) {
      console.error('Error generating token:', err)
      setTokenError('Error de conexión')
    } finally {
      setGeneratingToken(false)
    }
  }

  const copyToken = () => {
    if (bridgeToken) {
      navigator.clipboard.writeText(bridgeToken)
      setTokenCopied(true)
      setTimeout(() => setTokenCopied(false), 2000)
    }
  }

  /* ---- Download Bridge Installer ---- */
  const downloadInstaller = async (platform: 'windows' | 'mac' | 'linux', service = false) => {
    setDownloadingInstaller(service ? 'service' : 'manual')
    try {
      const lang = locale === 'es' ? 'es' : 'en'
      const platformParam = service ? `${platform}_service` : platform
      const res = await fetch(`/api/hogar/bridge/installer?platform=${platformParam}&lang=${lang}`)
      if (!res.ok) {
        // Handle session expired (e.g. after DB reset)
        if (res.status === 401) {
          try {
            const data = await res.json()
            if (data?.error === 'sessionInvalid') {
              setTokenError(locale === 'es'
                ? 'Tu sesión ha expirado. Cierra sesión y vuelve a iniciar.'
                : 'Your session has expired. Please log out and log in again.')
              setTimeout(() => { window.location.href = '/api/auth/signout?callbackUrl=/login' }, 2000)
              return
            }
          } catch {}
        }
        throw new Error(`Download failed (HTTP ${res.status})`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      const filenameMatch = disposition.match(/filename="(.+)"/)
      const filename = filenameMatch ? filenameMatch[1] : `OCTOPUS-Bridge.${platform === 'windows' ? 'bat' : platform === 'mac' ? 'command' : 'sh'}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      const label = service ? 'servicio' : 'manual'
      addActivity(locale === 'es' ? `Bridge (${label}) descargado para ${platform}` : `Bridge (${service ? 'service' : 'manual'}) downloaded for ${platform}`, 'success')
    } catch (err) {
      console.error('Error downloading installer:', err)
      setTokenError(locale === 'es' ? 'Error descargando instalador' : 'Error downloading installer')
    } finally {
      setDownloadingInstaller(false)
    }
  }

  /* ---- HubSpace config ---- */
  const fetchHsConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/hogar/hubspace')
      const data = await res.json()
      setHsConfigured(data.configured || false)
      setHsConnected(data.connected || false)
      if (data.email) setHsEmail(data.email)
    } catch (err) {
      console.error('Error fetching HS config:', err)
    }
  }, [])

  const saveHsCredentials = async () => {
    setHsSaving(true)
    setHsError(null)
    try {
      const res = await fetch('/api/hogar/hubspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: hsEmail, password: hsPassword }),
      })
      const data = await res.json()
      if (data.success) {
        setHsConfigured(true)
        setHsConnected(true)
        setHsPassword('')
        addActivity(locale === 'en' ? 'HubSpace connected' : 'HubSpace conectado', 'success')
      } else {
        setHsError(data.error || 'Error al guardar')
      }
    } catch (err) {
      console.error('HS save error:', err)
      setHsError('Error de conexion')
    } finally {
      setHsSaving(false)
    }
  }

  const discoverHsDevices = async () => {
    setHsDiscovering(true)
    setHsDiscoverResult(null)
    try {
      const res = await fetch('/api/hogar/hubspace/discover', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setHsDiscoverResult(`Descubiertos: ${data.discovered} | Nuevos: ${data.added} | Ya existentes: ${data.skipped}`)
        addActivity(locale === 'en' ? `HubSpace: ${data.added} new devices` : `HubSpace: ${data.added} dispositivos nuevos`, 'success')
        fetchDevices()
      } else {
        setHsDiscoverResult(data.error || 'Error')
      }
    } catch (err) {
      console.error('HS discover error:', err)
      setHsDiscoverResult('Error de conexion')
    } finally {
      setHsDiscovering(false)
    }
  }

  useEffect(() => { fetchDevices(); fetchBridgeToken(); fetchHsConfig() }, [fetchDevices, fetchBridgeToken, fetchHsConfig])

  /* ---- Control device ---- */
  const controlDevice = async (deviceId: string, action: string, params?: Record<string, unknown>) => {
    setControlling(deviceId)
    try {
      const res = await fetch('/api/hogar/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, action, params }),
      })
      const data = await res.json()
      if (data.success) {
        setDevices(prev => prev.map(d => {
          if (d.id !== deviceId) return d
          const ns = data.newState || {}
          return {
            ...d,
            lastState: ns,
            brightness: ns.brightness ?? d.brightness,
            colorTemp: ns.colorTemp ?? d.colorTemp,
          }
        }))
        addActivity(`${action} ${devices.find(d => d.id === deviceId)?.name || ''}`, 'success')
      }
    } catch (err) {
      console.error('Control error:', err)
    } finally {
      setControlling(null)
    }
  }

  /* ---- Add device ---- */
  const addDevice = async () => {
    const room = customRoom || newRoom
    if (!newName.trim()) return
    const typeInfo = getDeviceTypes(t).find(dt => dt.value === newType)
    try {
      const res = await fetch('/api/hogar/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          type: newType,
          platform: newPlatform,
          room,
          icon: typeInfo?.icon || 'lightbulb',
          mode: 'cloud',
        }),
      })
      if (await handlePlanError(res, 'iot')) return
      const data = await res.json()
      if (data.device) {
        setDevices(prev => [...prev, data.device])
        setNewName('')
        setNewType('light')
        setCustomRoom('')
        setShowAddDevice(false)
        addActivity(locale === 'en' ? `Added device: ${newName.trim()}` : `Agregó dispositivo: ${newName.trim()}`, 'success')
      }
    } catch (err) {
      console.error('Add device error:', err)
    }
  }

  /* ---- Delete device ---- */
  const deleteDevice = async (id: string) => {
    try {
      await fetch(`/api/hogar/devices?id=${id}`, { method: 'DELETE' })
      setDevices(prev => prev.filter(d => d.id !== id))
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  /* ---- Derived data ---- */
  const noRoomLabel = t('hogar.noRoom')
  const rooms = [...new Set(devices.map(d => d.room || noRoomLabel))]
  const devicesByRoom = rooms.reduce((acc, room) => {
    acc[room] = devices.filter(d => (d.room || noRoomLabel) === room)
    return acc
  }, {} as Record<string, SmartDevice[]>)
  const onCount = devices.filter(d => (d.lastState as Record<string, unknown>)?.on).length
  const totalDevices = devices.length

  /* ==================== RENDER ==================== */
  return (
    <div className="min-h-screen p-4 md:p-6 space-y-6">
      {/* ---- HEADER ---- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gradient-to-br from-[#C4622D]/20 to-[#2D4A3E]/20">
              <Home className="w-7 h-7 text-[#C4622D]" />
            </span>
            <span className="bg-gradient-to-r from-[#C4622D] via-[#FFD700] to-[#2D4A3E] bg-clip-text text-transparent">
              {t('hogar.title')}
            </span>
          </h1>
          <p className="text-gray-400 mt-1">{t('hogar.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'rooms' ? 'grid' : 'rooms')}
            className="border-[#2D4A3E]/60 text-[#2D4A3E] bg-[#2D4A3E]/10 hover:bg-[#2D4A3E]/25 hover:text-emerald-300 shadow-[0_0_12px_rgba(45,74,62,0.3)] transition-all"
          >
            {viewMode === 'rooms' ? <LayoutGrid className="w-4 h-4 mr-1" /> : <List className="w-4 h-4 mr-1" />}
            {viewMode === 'rooms' ? 'Grid' : 'Rooms'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { if (!showSetup) { openSetupGuide() } else { setShowSetup(false) } }}
            className="border-blue-500/40 text-blue-300 bg-gradient-to-r from-blue-500/10 to-[#2D4A3E]/15 hover:from-blue-500/20 hover:to-[#2D4A3E]/25 shadow-[0_0_16px_rgba(59,130,246,0.25),0_0_8px_rgba(45,74,62,0.2)] transition-all"
          >
            <Settings className="w-4 h-4 mr-1" />
            {t('hogar.config_shelly')}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAddDevice(true)}
            className="bg-[#C4622D] hover:bg-[#A8522A] text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            {t('hogar.add_device')}
          </Button>
        </div>
      </div>

      {/* ---- STATS BAR ---- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-[#1A2332]/80 border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#2D4A3E]/30">
              <Layers className="w-5 h-5 text-[#2D4A3E]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalDevices}</p>
              <p className="text-xs text-gray-400">{t('hogar.devices')}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[#1A2332]/80 border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#C4622D]/20">
              <Zap className="w-5 h-5 text-[#C4622D]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{onCount}</p>
              <p className="text-xs text-gray-400">{t('hogar.on')}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[#1A2332]/80 border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Wifi className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{rooms.length}</p>
              <p className="text-xs text-gray-400">{t('hogar.rooms')}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-[#1A2332]/80 border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Palette className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white">WiZ</span>
                {hsConnected && (
                  <>
                    <span className="text-gray-600">+</span>
                    <span className="text-sm font-bold text-blue-400">HubSpace</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400">{hsConnected ? 'Multi-plataforma' : 'Plataforma'}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* ---- SCENES ---- */}
      <HogarScenes
        devices={devices}
        locale={locale === 'en' ? 'en' : 'es'}
        onSceneRun={fetchDevices}
        addActivity={addActivity}
      />

      {/* ---- SETUP GUIDE (collapsible) ---- */}
      <div ref={setupRef} />
      <AnimatePresence>
        {showSetup && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="bg-gradient-to-br from-[#1A2332] to-[#0F1419] border-[#2D4A3E]/30 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[#C4622D]" />
                  {t('hogar.wizConfig')}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSetup(false)} className="text-gray-400">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Bridge Installer Section */}
              <div className="bg-gradient-to-br from-[#C4622D]/10 via-[#1A2332] to-[#2D4A3E]/10 rounded-xl border border-[#C4622D]/20 mb-6 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#C4622D]/20 to-[#2D4A3E]/20 px-5 py-4 border-b border-[#C4622D]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4622D] to-[#A8522A] flex items-center justify-center shadow-lg shadow-[#C4622D]/20">
                      <Terminal className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold text-base flex items-center gap-2">
                        🐙 OCTOPUS Bridge
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-semibold uppercase tracking-wide">
                          {locale === 'es' ? 'Un clic' : 'One click'}
                        </span>
                      </h4>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {locale === 'es'
                          ? 'Descarga, doble clic, y tus dispositivos WiZ se conectan automáticamente'
                          : 'Download, double-click, and your WiZ devices connect automatically'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* How it works - 3 steps visual */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { step: 1, emoji: '📥', es: 'Descarga', en: 'Download', descEs: 'Elige tu sistema operativo', descEn: 'Choose your OS' },
                      { step: 2, emoji: '🖱️', es: 'Doble Clic', en: 'Double Click', descEs: 'Ejecuta el archivo descargado', descEn: 'Run the downloaded file' },
                      { step: 3, emoji: '✨', es: '¡Listo!', en: 'Done!', descEs: 'Tus dispositivos aparecen aquí', descEn: 'Your devices appear here' },
                    ].map((s) => (
                      <div key={s.step} className="text-center p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="text-2xl mb-1">{s.emoji}</div>
                        <p className="text-white text-xs font-semibold">{locale === 'es' ? s.es : s.en}</p>
                        <p className="text-gray-500 text-[10px] mt-0.5">{locale === 'es' ? s.descEs : s.descEn}</p>
                      </div>
                    ))}
                  </div>

                  {/* OS Selector */}
                  <div>
                    <p className="text-gray-400 text-xs font-medium mb-2.5">
                      {locale === 'es' ? '🖥️ Selecciona tu sistema operativo:' : '🖥️ Select your operating system:'}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'windows' as const, label: 'Windows', icon: Monitor, color: '#0078D4', file: '.bat', desc: locale === 'es' ? 'Windows 10/11' : 'Windows 10/11' },
                        { id: 'mac' as const, label: 'macOS', icon: Apple, color: '#A2AAAD', file: '.command', desc: locale === 'es' ? 'macOS Monterey+' : 'macOS Monterey+' },
                        { id: 'linux' as const, label: 'Linux', icon: MonitorSmartphone, color: '#FCC624', file: '.sh', desc: 'Ubuntu / Debian / Fedora' },
                      ]).map((os) => (
                        <motion.button
                          key={os.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedOS(os.id)}
                          className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                            selectedOS === os.id
                              ? 'border-[#C4622D] bg-[#C4622D]/10 shadow-lg shadow-[#C4622D]/10'
                              : 'border-gray-700/50 bg-white/[0.02] hover:border-gray-600'
                          }`}
                        >
                          {selectedOS === os.id && (
                            <div className="absolute top-2 right-2">
                              <Check className="w-3.5 h-3.5 text-[#C4622D]" />
                            </div>
                          )}
                          <os.icon className="w-6 h-6 mb-2" style={{ color: os.color }} />
                          <p className="text-white text-sm font-semibold">{os.label}</p>
                          <p className="text-gray-500 text-[10px]">{os.desc}</p>
                          <p className="text-[#C4622D]/70 text-[10px] font-mono mt-1">OCTOPUS-Bridge{os.file}</p>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Download Button — Manual (terminal abierta) */}
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!downloadingInstaller) downloadInstaller(selectedOS, false); }}
                    disabled={!!downloadingInstaller}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#C4622D] to-[#A8522A] hover:from-[#D4723D] hover:to-[#B8623A] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#C4622D]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {downloadingInstaller === 'manual' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {locale === 'es' ? 'Generando instalador...' : 'Generating installer...'}
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        {locale === 'es'
                          ? `Descargar Manual (${selectedOS === 'windows' ? 'Windows' : selectedOS === 'mac' ? 'macOS' : 'Linux'})`
                          : `Download Manual (${selectedOS === 'windows' ? 'Windows' : selectedOS === 'mac' ? 'macOS' : 'Linux'})`}
                      </>
                    )}
                  </button>

                  {/* Service Install Option */}
                  <div className="relative">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
                    <div className="pt-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Zap className="w-3 h-3 text-green-400" />
                        </div>
                        <p className="text-green-400 text-xs font-semibold">
                          {locale === 'es' ? '⚡ Modo Servicio — Sin terminal abierta' : '⚡ Service Mode — No terminal needed'}
                        </p>
                      </div>
                      <p className="text-gray-500 text-[10px] leading-relaxed">
                        {locale === 'es'
                          ? 'Instala el bridge como servicio del sistema. Arranca automáticamente con tu PC, corre en segundo plano y se reinicia solo si se cae. No necesitas tener ninguna terminal abierta.'
                          : 'Installs the bridge as a system service. Auto-starts with your PC, runs in the background, and self-restarts if it crashes. No terminal window needed.'}
                      </p>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!downloadingInstaller) downloadInstaller(selectedOS, true); }}
                        disabled={!!downloadingInstaller}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-green-600/80 to-emerald-700/80 hover:from-green-500/80 hover:to-emerald-600/80 text-white font-bold text-sm flex items-center justify-center gap-2 border border-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {downloadingInstaller === 'service' ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {locale === 'es' ? 'Generando servicio...' : 'Generating service...'}
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            {locale === 'es'
                              ? `⚡ Instalar como Servicio (${selectedOS === 'windows' ? 'Windows' : selectedOS === 'mac' ? 'macOS' : 'Linux'})`
                              : `⚡ Install as Service (${selectedOS === 'windows' ? 'Windows' : selectedOS === 'mac' ? 'macOS' : 'Linux'})`}
                          </>
                        )}
                      </button>
                      <p className="text-gray-600 text-[10px] text-center">
                        {locale === 'es'
                          ? selectedOS === 'mac' ? '⚙️ Usa launchd · Arranca al iniciar sesión' : selectedOS === 'linux' ? '⚙️ Usa systemd · Arranca con el sistema' : '⚙️ Usa Task Scheduler · Arranca al iniciar sesión'
                          : selectedOS === 'mac' ? '⚙️ Uses launchd · Starts on login' : selectedOS === 'linux' ? '⚙️ Uses systemd · Starts with system' : '⚙️ Uses Task Scheduler · Starts on login'}
                      </p>
                    </div>
                  </div>

                  {tokenError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {tokenError}
                    </p>
                  )}

                  {/* What's included */}
                  <div className="bg-white/[0.02] rounded-lg p-3 border border-white/5">
                    <p className="text-gray-400 text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-green-400" />
                      {locale === 'es' ? '¿Qué incluye el archivo?' : 'What\'s included?'}
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { es: '✅ Token pre-configurado', en: '✅ Pre-configured token' },
                        { es: '✅ Servidor ya conectado', en: '✅ Server already connected' },
                        { es: '✅ Verifica Node.js', en: '✅ Checks Node.js' },
                        { es: '✅ Auto-descubre dispositivos', en: '✅ Auto-discovers devices' },
                        { es: '✅ Mensajes en tu idioma', en: '✅ Messages in your language' },
                        { es: '✅ Sin instalar nada extra', en: '✅ No extra installs needed' },
                      ].map((item, i) => (
                        <p key={i} className="text-gray-500 text-[10px]">{locale === 'es' ? item.es : item.en}</p>
                      ))}
                    </div>
                  </div>

                  {/* Requirement note */}
                  <p className="text-gray-600 text-[10px] text-center">
                    {locale === 'es'
                      ? '⚡ Requiere Node.js 18+ · Tu PC debe estar en la misma red WiFi que los dispositivos WiZ'
                      : '⚡ Requires Node.js 18+ · Your PC must be on the same WiFi network as your WiZ devices'}
                  </p>

                  {/* Advanced: manual token (collapsed) */}
                  <details className="group">
                    <summary className="text-gray-600 text-[10px] cursor-pointer hover:text-gray-400 transition-colors flex items-center gap-1">
                      <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                      {locale === 'es' ? 'Avanzado: token manual' : 'Advanced: manual token'}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {bridgeToken ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-[#0F1419] border border-gray-700 rounded px-2 py-1.5 text-xs text-green-400 font-mono truncate">
                              {bridgeToken}
                            </code>
                            <button
                              onClick={copyToken}
                              className="p-1.5 rounded bg-gray-800 text-gray-400 hover:text-white transition-colors"
                              title={locale === 'es' ? 'Copiar token' : 'Copy token'}
                            >
                              {tokenCopied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button onClick={generateBridgeToken} disabled={generatingToken} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                            {locale === 'es' ? 'Regenerar token' : 'Regenerate token'}
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" onClick={generateBridgeToken} disabled={generatingToken} className="bg-[#C4622D] hover:bg-[#A8522A] text-white text-xs">
                          {generatingToken ? (locale === 'es' ? 'Generando...' : 'Generating...') : (locale === 'es' ? 'Generar Token' : 'Generate Token')}
                        </Button>
                      )}
                      <div className="bg-[#0F1419] rounded-lg p-2 border border-gray-800">
                        <p className="text-[10px] text-gray-500 mb-1">
                          {locale === 'es' ? 'Ejecuta en tu terminal (Node.js 18+):' : 'Run in your terminal (Node.js 18+):'}
                        </p>
                        <code className="text-xs text-[#C4622D] font-mono">
                          BRIDGE_TOKEN=tu_token node octopus-bridge.js
                        </code>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              {/* ---- HubSpace Section ---- */}
              <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl p-4 border border-blue-500/20 mb-6">
                <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <Plug className="w-4 h-4 text-blue-400" />
                  🔌 HubSpace (Defiant) — Smart Plugs Cloud
                </h4>
                <p className="text-gray-400 text-sm mb-4">
                  {t('hogar.hubspaceDesc')}
                </p>

                {hsConfigured && hsConnected ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <Wifi className="w-4 h-4" />
                      <span>Conectado como <strong>{hsEmail}</strong></span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={discoverHsDevices}
                        disabled={hsDiscovering}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      >
                        {hsDiscovering ? (
                          <><span className="animate-spin mr-1">⟳</span> Buscando...</>
                        ) : (
                          <><Wifi className="w-3.5 h-3.5 mr-1" /> {t('hogar.discoverDevices')}</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setHsConfigured(false); setHsConnected(false) }}
                        className="border-gray-700 text-gray-400 text-xs"
                      >
                        Reconfigurar
                      </Button>
                    </div>
                    {hsDiscoverResult && (
                      <p className="text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-2">
                        {hsDiscoverResult}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Email de HubSpace</label>
                        <input
                          type="email"
                          value={hsEmail}
                          onChange={e => setHsEmail(e.target.value)}
                          placeholder="tu@email.com"
                          className="w-full bg-[#0F1419] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Password de HubSpace</label>
                        <input
                          type="password"
                          value={hsPassword}
                          onChange={e => setHsPassword(e.target.value)}
                          placeholder="Tu contraseña"
                          className="w-full bg-[#0F1419] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={saveHsCredentials}
                      disabled={hsSaving || !hsEmail || !hsPassword}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs disabled:opacity-50"
                    >
                      {hsSaving ? t('hogar.connecting') : t('hogar.connectHubspace')}
                    </Button>
                    {hsError && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {hsError}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600">
                      Usa las mismas credenciales de la app HubSpace en tu telefono.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C4622D]/20 flex items-center justify-center text-[#C4622D] font-bold text-sm">1</span>
                    <div>
                      <p className="text-white font-medium">Descarga la app WiZ Connected</p>
                      <p className="text-gray-400 text-sm mb-2">Disponible en iOS y Android. Crea tu cuenta con email.</p>
                      <div className="flex flex-wrap gap-2">
                        <a href="https://apps.apple.com/app/wiz-connected/id1587655962" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
                          🍎 App Store
                        </a>
                        <a href="https://play.google.com/store/apps/details?id=com.wizconnected.wiz2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
                          🤖 Google Play
                        </a>
                        <a href="https://www.wizconnected.com/es-us/explore-wiz/app" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C4622D]/20 hover:bg-[#C4622D]/30 text-[#C4622D] text-xs font-medium transition-colors">
                          🌐 wizconnected.com
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C4622D]/20 flex items-center justify-center text-[#C4622D] font-bold text-sm">2</span>
                    <div>
                      <p className="text-white font-medium">{t('hogar.connectWizDevices')}</p>
                      <p className="text-gray-400 text-sm">{t('hogar.wifiConnect')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#C4622D]/20 flex items-center justify-center text-[#C4622D] font-bold text-sm">3</span>
                    <div>
                      <p className="text-white font-medium">{t('hogar.configureBridge')}</p>
                      <p className="text-gray-400 text-sm">{locale === 'es' ? 'Haz clic en "Configurar" arriba, selecciona tu sistema operativo y descarga el Bridge. ¡Solo un doble clic!' : 'Click "Settings" above, select your OS and download the Bridge. Just a double-click!'}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#0F1419]/60 rounded-xl p-4 border border-gray-800">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-green-400" />
                    {t('hogar.howItWorks')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>1️⃣</span>
                      <span>{t('hogar.step1_click')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>2️⃣</span>
                      <span>{t('hogar.step2_command')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>3️⃣</span>
                      <span>{t('hogar.bridgeUdp')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span>4️⃣</span>
                      <span>{t('hogar.step4_respond')}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500">{t('hogar.zeroLatency')}</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- ADD DEVICE MODAL ---- */}
      <AnimatePresence>
        {showAddDevice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowAddDevice(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A2332] border border-gray-700 rounded-2xl p-6 w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-[#C4622D]" />
                  {t('hogar.add_device')}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowAddDevice(false)} className="text-gray-400">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Name */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('hogar.deviceName')}</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={t('hogar.deviceNamePlaceholder')}
                    className="w-full bg-[#0F1419] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-[#C4622D] focus:outline-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('hogar.deviceType')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {getDeviceTypes(t).map(dt => (
                      <button
                        key={dt.value}
                        onClick={() => setNewType(dt.value)}
                        className={`p-2 rounded-lg border text-center transition-all text-xs ${
                          newType === dt.value
                            ? 'border-[#C4622D] bg-[#C4622D]/10 text-[#C4622D]'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <span className="text-lg block mb-1">{dt.wizIcon}</span>
                        {dt.label.split('/')[0].trim()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Room */}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('hogar.room')}</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {getRoomsPresets(t).map(r => (
                      <button
                        key={r.value}
                        onClick={() => { setNewRoom(r.value); setCustomRoom('') }}
                        className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                          newRoom === r.value && !customRoom
                            ? 'border-[#2D4A3E] bg-[#2D4A3E]/20 text-[#2D4A3E]'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        {r.emoji} {r.value}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={customRoom}
                    onChange={e => setCustomRoom(e.target.value)}
                    placeholder={t('hogar.customRoomPlaceholder')}
                    className="w-full bg-[#0F1419] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-[#2D4A3E] focus:outline-none text-sm"
                  />
                </div>

                {/* Platform */}
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">{t('hogar.platform')}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewPlatform('wiz')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-all ${
                        newPlatform === 'wiz'
                          ? 'border-[#C4622D] bg-[#C4622D]/10 text-[#C4622D]'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      💡 WiZ (Bridge)
                    </button>
                    <button
                      onClick={() => setNewPlatform('hubspace')}
                      className={`flex-1 px-3 py-2 rounded-lg border text-xs transition-all ${
                        newPlatform === 'hubspace'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      🔌 {t('hogar.hubspaceCloud')}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  onClick={addDevice}
                  disabled={!newName.trim()}
                  className="w-full bg-[#C4622D] hover:bg-[#A8522A] text-white disabled:opacity-50"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {t('hogar.add_device')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- DEVICES BY ROOM ---- */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C4622D]" />
        </div>
      ) : devices.length === 0 ? (
        <EmptyState onAdd={() => setShowAddDevice(true)} onGuide={openSetupGuide} locale={locale} t={t} />
      ) : viewMode === 'rooms' ? (
        <div className="space-y-6">
          {rooms.map(room => (
            <RoomSection
              key={room}
              room={room}
              devices={devicesByRoom[room]}
              controlling={controlling}
              editingDevice={editingDevice}
              onControl={controlDevice}
              onDelete={deleteDevice}
              onToggleEdit={(id) => setEditingDevice(editingDevice === id ? null : id)}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {devices.map(device => (
            <DeviceCard
              key={device.id}
              device={device}
              controlling={controlling}
              isEditing={editingDevice === device.id}
              onControl={controlDevice}
              onDelete={deleteDevice}
              onToggleEdit={() => setEditingDevice(editingDevice === device.id ? null : device.id)}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Plan upgrade modal */}
      <UpgradeModal
        isOpen={upgradeModal.isOpen}
        onClose={closeUpgradeModal}
        feature={upgradeModal.feature}
        current={upgradeModal.current}
        limit={upgradeModal.limit}
        requiredPlan={upgradeModal.requiredPlan}
      />
    </div>
  )
}

/* ==================== ROOM SECTION ==================== */
function RoomSection({
  room, devices, controlling, editingDevice, onControl, onDelete, onToggleEdit, locale, t,
}: {
  room: string
  devices: SmartDevice[]
  controlling: string | null
  editingDevice: string | null
  onControl: (id: string, action: string, params?: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onToggleEdit: (id: string) => void
  locale: string
  t: (k: string) => string
}) {
  const [collapsed, setCollapsed] = useState(false)
  const roomPreset = getRoomsPresets(t).find(r => r.value === room)
  const onCount = devices.filter(d => (d.lastState as Record<string, unknown>)?.on).length

  return (
    <div>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-3 mb-3 group w-full text-left"
      >
        <span className="text-xl">{roomPreset?.emoji || '🏠'}</span>
        <h2 className="text-lg font-semibold text-white group-hover:text-[#C4622D] transition-colors">
          {room}
        </h2>
        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
          {devices.length} {devices.length === 1 ? t('hogar.device_singular') : t('hogar.device_plural')}
          {onCount > 0 && <span className="text-[#C4622D] ml-1">• {onCount} ON</span>}
        </span>
        <span className="ml-auto text-gray-500">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {devices.map(device => (
              <DeviceCard
                key={device.id}
                device={device}
                controlling={controlling}
                isEditing={editingDevice === device.id}
                onControl={onControl}
                onDelete={onDelete}
                onToggleEdit={() => onToggleEdit(device.id)}
                locale={locale}
                t={t}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ==================== DEVICE CARD ==================== */
function DeviceCard({
  device, controlling, isEditing, onControl, onDelete, onToggleEdit, locale, t,
}: {
  device: SmartDevice
  controlling: string | null
  isEditing: boolean
  onControl: (id: string, action: string, params?: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onToggleEdit: () => void
  locale: string
  t: (k: string) => string
}) {
  const isOn = !!(device.lastState as Record<string, unknown>)?.on
  const isControlling = controlling === device.id
  const isLight = device.type === 'light'
  const isHubSpace = device.platform === 'hubspace'
  const isPlug = device.type === 'plug' || device.type === 'relay'
  const [localBrightness, setLocalBrightness] = useState(device.brightness ?? 100)
  const [localColorTemp, setLocalColorTemp] = useState(device.colorTemp ?? 4000)
  const brightness = localBrightness
  const colorTemp = localColorTemp
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync with server state
  useEffect(() => { setLocalBrightness(device.brightness ?? 100) }, [device.brightness])
  useEffect(() => { setLocalColorTemp(device.colorTemp ?? 4000) }, [device.colorTemp])

  const debouncedControl = useCallback((action: string, params: Record<string, unknown>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onControl(device.id, action, params)
    }, 400)
  }, [device.id, onControl])

  return (
    <motion.div layout>
      <Card
        className={`relative overflow-hidden transition-all duration-300 ${
          isOn
            ? 'bg-gradient-to-br from-[#1A2332] to-[#1E293B] border-[#C4622D]/40 shadow-lg shadow-[#C4622D]/5'
            : 'bg-[#1A2332]/60 border-gray-800 hover:border-gray-700'
        }`}
      >
        {/* Glow effect when ON */}
        {isOn && isLight && !isHubSpace && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: tempToGradient(colorTemp, brightness) }}
          />
        )}
        {isOn && isHubSpace && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 30%, rgba(59,130,246,0.15), transparent 70%)' }}
          />
        )}

        <div className="relative p-4">
          {/* Top row: icon + name + power toggle */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl transition-all ${
                isOn
                  ? isHubSpace ? 'bg-blue-500/20 text-blue-400' : 'bg-[#C4622D]/20 text-[#C4622D]'
                  : 'bg-gray-800 text-gray-500'
              }`}>
                <DeviceIcon icon={device.icon} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">{device.name}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  {isOn ? (
                    <><Wifi className="w-3 h-3 text-green-400" /> <span className="text-green-400">{t('hogar.on_label')}</span></>
                  ) : (
                    <><WifiOff className="w-3 h-3" /> {t('hogar.off_label')}</>
                  )}
                  {isLight && isOn && (
                    <span className="text-gray-600 ml-1">• {brightness}%</span>
                  )}
                </p>
              </div>
            </div>

            {/* Power toggle */}
            <button
              onClick={() => onControl(device.id, 'toggle')}
              disabled={isControlling}
              className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                isOn ? (isHubSpace ? 'bg-blue-500' : 'bg-[#C4622D]') : 'bg-gray-700'
              } ${isControlling ? 'opacity-50' : ''}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${
                isOn ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {/* HubSpace plug info when ON */}
          {isHubSpace && isPlug && isOn && (
            <div className="mt-3 flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-2">
              <Zap className="w-3.5 h-3.5" />
              <span>{t('hogar.hubspaceDirectControl')}</span>
            </div>
          )}

          {/* Light controls (only for WiZ lights when ON) */}
          {isLight && isOn && !isHubSpace && (
            <div className="space-y-3 mt-4">
              {/* Brightness slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Sun className="w-3 h-3" /> {t('hogar.brightness')}
                  </span>
                  <span className="text-xs font-mono text-[#C4622D]">{brightness}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={brightness}
                  onChange={e => { const v = Number(e.target.value); setLocalBrightness(v); debouncedControl('brightness', { brightness: v }) }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #C4622D ${brightness}%, #374151 ${brightness}%)`,
                  }}
                />
              </div>

              {/* Color temperature slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Thermometer className="w-3 h-3" /> {t('hogar.temperature')}
                  </span>
                  <span className="text-xs font-mono" style={{ color: tempToColor(colorTemp) }}>{colorTemp}K</span>
                </div>
                <input
                  type="range"
                  min={2200}
                  max={6500}
                  step={100}
                  value={colorTemp}
                  onChange={e => { const v = Number(e.target.value); setLocalColorTemp(v); debouncedControl('colorTemp', { colorTemp: v }) }}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: 'linear-gradient(to right, #FF9329, #FFE4B5, #E8F0FF)',
                  }}
                />
              </div>

              {/* Quick temperature presets */}
              <div className="flex gap-1.5">
                {[
                  { label: t('hogar.warm'), temp: 2700, icon: '🔥' },
                  { label: t('hogar.neutral'), temp: 4000, icon: '☀️' },
                  { label: t('hogar.cool'), temp: 6500, icon: '❄️' },
                ].map(preset => (
                  <button
                    key={preset.temp}
                    onClick={() => onControl(device.id, 'colorTemp', { colorTemp: preset.temp })}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs transition-all ${
                      Math.abs(colorTemp - preset.temp) < 500
                        ? 'bg-[#C4622D]/20 text-[#C4622D] border border-[#C4622D]/30'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {preset.icon} {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Edit/Delete actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/50">
            <span className={`text-[10px] uppercase tracking-wider ${isHubSpace ? 'text-blue-500' : 'text-gray-600'}`}>
              {isHubSpace ? 'HubSpace' : 'WiZ'} &bull; {device.type}
            </span>
            <div className="flex gap-1">
              <button
                onClick={onToggleEdit}
                className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {isEditing && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={() => onDelete(device.id)}
                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </motion.button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}

/* ==================== EMPTY STATE ==================== */
function EmptyState({ onAdd, onGuide, t, locale }: { onAdd: () => void; onGuide: () => void; t: (k: string) => string; locale: string }) {
  return (
    <Card className="bg-gradient-to-br from-[#1A2332] to-[#0F1419] border-gray-800 p-8 md:p-12 text-center">
      <div className="max-w-md mx-auto">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#C4622D]/20 to-[#2D4A3E]/20 flex items-center justify-center">
          <Home className="w-10 h-10 text-[#C4622D]" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">{t('hogar.no_devices')}</h3>
        <p className="text-gray-400 mb-6 text-sm">
          {t('hogar.emptyDesc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={onAdd} className="bg-[#C4622D] hover:bg-[#A8522A] text-white">
            <Plus className="w-4 h-4 mr-2" />
            {t('hogar.addFirst')}
          </Button>
          <Button onClick={onGuide} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <Settings className="w-4 h-4 mr-2" />
            {t('hogar.viewGuide')}
          </Button>
        </div>

        {/* Quick intro cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
          <div className="bg-[#0F1419]/60 rounded-xl p-4 border border-gray-800">
            <span className="text-2xl">💡</span>
            <p className="text-white font-medium text-sm mt-2">Smart LED</p>
            <p className="text-gray-500 text-xs">Dimmer + Color Temp</p>
          </div>
          <div className="bg-[#0F1419]/60 rounded-xl p-4 border border-gray-800">
            <span className="text-2xl">🔌</span>
            <p className="text-white font-medium text-sm mt-2">Smart Plug</p>
            <p className="text-gray-500 text-xs">1875W — AC, fans</p>
          </div>
          <div className="bg-[#0F1419]/60 rounded-xl p-4 border border-gray-800">
            <span className="text-2xl">📱</span>
            <p className="text-white font-medium text-sm mt-2">SpaceSense</p>
            <p className="text-gray-500 text-xs">{t('hogar.motionWifi')}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}