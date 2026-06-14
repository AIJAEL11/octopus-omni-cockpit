'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Github,
  Mail,
  Send,
  Globe,
  MessageCircle,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  X,
  Eye,
  EyeOff,
  AlertCircle,
  Zap,
  Chrome,
  Calendar,
  HardDrive,
  FileText,
  Table,
  Shield,
  RefreshCw,
  Check,
  Bot,
  Webhook,
  Radio,
  Terminal,
  Wifi,
  WifiOff,
  Cpu,
  ChevronDown,
  Power,
  Server,
  Database,
  MailCheck,
  AtSign,
  Monitor,
  MousePointerClick,
  Share2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ARM_CONFIGS, ArmType, ArmConfig } from '@/lib/brazos-types'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'

const iconMap: Record<string, React.ElementType> = {
  github: Github,
  mail: Mail,
  send: Send,
  globe: Globe,
  server: Server,
  'message-circle': MessageCircle,
  chrome: Chrome,
  calendar: Calendar,
  'hard-drive': HardDrive,
  'file-text': FileText,
  table: Table,
  cpu: Cpu,
  wifi: Wifi,
  shield: Shield,
  'mail-check': MailCheck,
  'at-sign': AtSign,
  monitor: Monitor,
  'mouse-pointer': MousePointerClick,
  'share-2': Share2,
  database: Database,
}

interface OllamaModel {
  name: string
  size?: number
  modifiedAt?: string
  family?: string
  parameterSize?: string
  quantization?: string
}

interface OllamaArmStatusResponse {
  connected: boolean
  status: {
    installed: boolean
    running: boolean
    version?: string
    models: OllamaModel[]
    detectionMethod: 'http' | 'filesystem' | 'process' | 'none'
    lastSeenAt?: string
    bridgePresent: boolean
    os?: 'mac' | 'windows' | 'linux'
  }
}

interface Connection {
  id: string
  armType: ArmType
  status: string
  connectedAt: string
  name: string
  credentials?: string
}

export default function BrazosPage() {
  const router = useRouter()
  const [connections, setConnections] = useState<Connection[]>([])
  const { t, locale } = useI18n()
  const isEn = locale === 'en'
  const [loading, setLoading] = useState(true)
  const [selectedArm, setSelectedArm] = useState<ArmConfig | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [googleConnecting, setGoogleConnecting] = useState(false)
  // === Ollama Arm State ===
  const [ollamaStatus, setOllamaStatus] = useState<OllamaArmStatusResponse | null>(null)
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaModelsOpen, setOllamaModelsOpen] = useState(false)
  const { addActivity, updateMetrics } = useMetrics()
  const { upgradeModal, closeUpgradeModal, handlePlanError } = usePlanGate()

  // Fetch Ollama status (auto-detected by Bridge)
  const fetchOllamaStatus = useCallback(async () => {
    setOllamaLoading(true)
    try {
      const res = await fetch('/api/arms/ollama/status')
      if (res.ok) {
        const data = await res.json()
        setOllamaStatus(data)
      }
    } catch (err) {
      console.error('Error fetching Ollama status:', err)
    } finally {
      setOllamaLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOllamaStatus()
    // Re-poll every 30s to reflect Bridge updates
    const id = setInterval(fetchOllamaStatus, 30000)
    return () => clearInterval(id)
  }, [fetchOllamaStatus])

  useEffect(() => {
    fetchConnections()
    // Revisar query params para mensajes de éxito/error del callback OAuth
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'google_connected') {
      setSuccessMsg(isEn ? 'Google Workspace connected successfully! 🎉' : '¡Google Workspace conectado exitosamente! 🎉')
      window.history.replaceState({}, '', '/dashboard/brazos')
      setTimeout(() => setSuccessMsg(''), 5000)
    }
    if (params.get('error')) {
      const errMap: Record<string, string> = {
        oauth_denied: isEn ? 'Authorization cancelled by user' : 'Autorización cancelada por el usuario',
        callback_failed: isEn ? 'Google callback error. Try again.' : 'Error en el callback de Google. Inténtalo de nuevo.',
        session_mismatch: isEn ? 'Invalid session. Log in and try again.' : 'Sesión inválida. Inicia sesión e inténtalo de nuevo.',
        no_credentials: isEn ? 'Save your OAuth credentials first.' : 'Primero guarda tus credenciales de OAuth.',
        missing_client_id: isEn ? 'Client ID missing. Configure your credentials.' : 'Falta el Client ID. Configura tus credenciales.',
      }
      const errKey = params.get('error') || ''
      setError(errMap[errKey] || (isEn ? 'Authorization error' : 'Error en la autorización'))
      window.history.replaceState({}, '', '/dashboard/brazos')
      setTimeout(() => setError(''), 6000)
    }
  }, [])

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/brazos')
      const data = await res.json()
      setConnections(data.connections || [])
      updateMetrics({ brazosActivos: data.connections?.length || 0 })
    } catch (err) {
      console.error('Error fetching connections:', err)
    } finally {
      setLoading(false)
    }
  }

  const getConnection = (type: ArmType) => connections.find(c => c.armType === type)
  const isConnected = (type: ArmType) => {
    return connections.some(c => c.armType === type && c.status === 'connected')
  }
  const isPending = (type: ArmType) => {
    return connections.some(c => c.armType === type && c.status === 'pending')
  }
  // Guardar credenciales (conexión normal, no OAuth)
  const handleConnect = async () => {
    if (!selectedArm) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/brazos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedArm.type,
          credentials: formData,
          name: selectedArm.name,
          status: 'connected',
        }),
      })

      if (!res.ok) {
        if (await handlePlanError(res.clone(), 'brazos')) { setSaving(false); return }
        throw new Error(isEn ? 'Connection error' : 'Error al conectar')
      }

      addActivity(`${selectedArm.name} ${isEn ? 'connected successfully' : 'conectado exitosamente'}`, 'success')
      setSelectedArm(null)
      setFormData({})
      await fetchConnections()
    } catch (err) {
      setError(isEn ? 'Error saving credentials. Check the data.' : 'Error al guardar credenciales. Verifica los datos.')
      addActivity(`${isEn ? 'Error connecting' : 'Error al conectar'} ${selectedArm?.name}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Google Workspace — un solo clic, redirige a Google OAuth
  const handleGoogleConnect = () => {
    setGoogleConnecting(true)
    addActivity(isEn ? 'Connecting to Google Workspace...' : 'Conectando con Google Workspace...', 'info')
    window.location.href = '/api/brazos/google/authorize'
  }

  const handleDisconnect = async (type: ArmType, name: string) => {
    try {
      await fetch(`/api/brazos?type=${type}`, { method: 'DELETE' })
      addActivity(`${name} ${isEn ? 'disconnected' : 'desconectado'}`, 'warning')
      await fetchConnections()
    } catch (err) {
      console.error('Error disconnecting:', err)
    }
  }

  // === Telegram Panel State ===
  const [telegramBot, setTelegramBot] = useState<{ username?: string; first_name?: string } | null>(null)
  const [telegramWebhook, setTelegramWebhook] = useState<{ url?: string; pending_update_count?: number } | null>(null)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [telegramTestMsg, setTelegramTestMsg] = useState('')
  const [telegramSending, setTelegramSending] = useState(false)
  const [telegramSetupDone, setTelegramSetupDone] = useState(false)
  const [telegramTestResult, setTelegramTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const isTelegramConnected = isConnected('telegram')

  const fetchTelegramStatus = useCallback(async () => {
    if (!isTelegramConnected) return
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/brazos/telegram/status')
      const data = await res.json()
      if (data.connected) {
        setTelegramBot(data.bot || null)
        setTelegramWebhook(data.webhook || null)
        setTelegramSetupDone(!!(data.webhook?.url))
      }
    } catch { /* ignore */ } finally {
      setTelegramLoading(false)
    }
  }, [isTelegramConnected])

  useEffect(() => {
    if (isTelegramConnected) fetchTelegramStatus()
  }, [isTelegramConnected, fetchTelegramStatus])

  const activateTelegramWebhook = async () => {
    setTelegramLoading(true)
    try {
      const res = await fetch('/api/brazos/telegram/status', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setTelegramSetupDone(true)
        setTelegramWebhook({ url: data.webhook })
        addActivity(isEn ? '🤖 Telegram webhook activated' : '🤖 Telegram webhook activado')
        await fetchTelegramStatus()
      } else {
        setError(data.error || (isEn ? 'Error activating webhook' : 'Error activando webhook'))
      }
    } catch { setError(isEn ? 'Connection error' : 'Error de conexión') } finally {
      setTelegramLoading(false)
    }
  }

  const sendTelegramTest = async () => {
    if (!telegramTestMsg.trim()) return
    setTelegramSending(true)
    setTelegramTestResult(null)
    try {
      const res = await fetch('/api/brazos/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'activity', title: isEn ? 'Test Message' : 'Mensaje de Prueba', details: telegramTestMsg }),
      })
      const data = await res.json()
      if (data.success) {
        setTelegramTestResult({ ok: true, msg: isEn ? 'Message sent to Telegram!' : '¡Mensaje enviado a Telegram!' })
        setTelegramTestMsg('')
        addActivity(isEn ? '📨 Test message sent to Telegram' : '📨 Mensaje de prueba enviado a Telegram')
      } else {
        setTelegramTestResult({ ok: false, msg: data.error || (isEn ? 'Error sending' : 'Error enviando') })
      }
    } catch {
      setTelegramTestResult({ ok: false, msg: isEn ? 'Connection error' : 'Error de conexión' })
    } finally {
      setTelegramSending(false)
    }
  }

  const arms = Object.values(ARM_CONFIGS)

  return (
    <div className="space-y-8">
      {/* Success/Error banners */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <span className="text-green-800 font-medium">{successMsg}</span>
          </motion.div>
        )}
        {error && !selectedArm && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span className="text-red-800 font-medium">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#2D4A3E] to-[#1A1A1A] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 text-[#F5F0E8]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
              <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-[#C4622D]" />
              {t('brazos.title')}
            </h1>
            <p className="text-[#F5F0E8]/80 max-w-xl text-sm sm:text-base">
              {t('brazos.subtitle')}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-3xl sm:text-4xl font-bold text-[#C4622D]">
              {connections.filter(c => c.status === 'connected' && c.armType !== 'ollama').length}/{arms.filter(a => !a.isAutoDetected).length}
            </p>
            <p className="text-sm text-[#F5F0E8]/60">{t('brazos.connected')}</p>
          </div>
        </div>
      </motion.div>

      {/* Arms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {arms.map((arm, index) => {
          const Icon = iconMap[arm.icon] || Zap
          const connected = isConnected(arm.type)
          const pending = isPending(arm.type)
          const isGoogleWS = arm.type === 'google_workspace'
          const isOllama = arm.type === 'ollama'

          // Ollama-specific computed status
          const ollamaSt = ollamaStatus?.status
          const ollamaRunning = !!ollamaSt?.running
          const ollamaInstalled = !!ollamaSt?.installed
          const ollamaModelsCount = ollamaSt?.models?.length || 0
          const ollamaBridgePresent = !!ollamaSt?.bridgePresent
          const ollamaIndicator = !ollamaBridgePresent
            ? { label: isEn ? 'Bridge disconnected' : 'Bridge desconectado', color: 'bg-gray-100 text-gray-500', dot: '⚪' }
            : ollamaRunning
              ? { label: isEn ? `Running · ${ollamaModelsCount} models` : `Corriendo · ${ollamaModelsCount} modelos`, color: 'bg-green-100 text-green-600', dot: '🟢' }
              : ollamaInstalled
                ? { label: isEn ? `Installed · closed · ${ollamaModelsCount} models` : `Instalado · cerrado · ${ollamaModelsCount} modelos`, color: 'bg-amber-100 text-amber-600', dot: '🟡' }
                : { label: isEn ? 'Not detected' : 'No detectado', color: 'bg-gray-100 text-gray-500', dot: '⚪' }

          return (
            <motion.div
              key={arm.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative overflow-hidden ${isGoogleWS ? 'border-2 border-[#4285F4]/20 shadow-lg' : ''} ${isOllama ? 'border-2 border-[#00B4D8]/20 shadow-lg' : ''}`}>
                {/* Special Google banner */}
                {isGoogleWS && !connected && !pending && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853]" />
                )}

                {/* Special Ollama banner */}
                {isOllama && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8] via-[#0077B6] to-[#023E8A]" />
                )}

                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {isOllama ? (
                    <span className={`flex items-center gap-1 text-xs ${ollamaIndicator.color} px-2 py-1 rounded-full font-medium`}>
                      <span>{ollamaIndicator.dot}</span>
                      <span className="hidden sm:inline">{ollamaIndicator.label}</span>
                      <span className="sm:hidden">{ollamaModelsCount} mods</span>
                    </span>
                  ) : connected ? (
                    <span className="flex items-center gap-1 text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" />
                      {isEn ? 'Connected' : 'Conectado'}
                    </span>
                  ) : pending ? (
                    <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-600 px-2 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      {isEn ? 'Pending' : 'Pendiente'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      {isEn ? 'Disconnected' : 'Desconectado'}
                    </span>
                  )}
                </div>

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${arm.color}20` }}
                >
                  <Icon className="w-7 h-7" style={{ color: arm.color }} />
                </div>

                {/* Content */}
                <h3 className="font-bold text-[#1A1A1A] text-lg mb-2">{arm.name}</h3>
                <p className="text-sm text-[#1A1A1A]/60 mb-4">{isEn ? (arm.descriptionEn || arm.description) : arm.description}</p>

                {/* Google Services Tags */}
                {isGoogleWS && arm.services && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {arm.services.map(svc => {
                      const SvcIcon = iconMap[svc.icon] || Zap
                      return (
                        <span
                          key={svc.name}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                            connected
                              ? 'bg-green-50 text-green-700'
                              : 'bg-[#4285F4]/10 text-[#4285F4]'
                          }`}
                        >
                          <SvcIcon className="w-3 h-3" />
                          {svc.name}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Privacy badge for Google */}
                {isGoogleWS && (
                  <div className="flex items-center gap-1.5 text-xs text-[#2D4A3E]/70 mb-4">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Secure connection with Google OAuth' : 'Conexión segura con Google OAuth'}</span>
                  </div>
                )}

                {/* Ollama detection details */}
                {isOllama && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-1.5 text-xs text-[#2D4A3E]/70">
                      <Shield className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Auto-detection via local Bridge' : 'Detección automática vía Bridge local'}</span>
                    </div>
                    {ollamaSt && ollamaBridgePresent && (
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#00B4D8]/10 text-[#00B4D8] font-mono">
                          <Server className="w-2.5 h-2.5" />
                          {ollamaSt.detectionMethod}
                        </span>
                        {ollamaSt.os && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#2D4A3E]/10 text-[#2D4A3E] font-mono">
                            {ollamaSt.os}
                          </span>
                        )}
                        {ollamaSt.lastSeenAt && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-mono">
                            <RefreshCw className="w-2.5 h-2.5" />
                            {new Date(ollamaSt.lastSeenAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {!isOllama && (
                  <div className="flex gap-2">
                    {connected ? (
                      <>
                        {isGoogleWS && (
                          <Button
                            variant="outline"
                            className="flex-1 border-[#4285F4]/30 text-[#4285F4] hover:bg-[#4285F4]/5"
                            onClick={handleGoogleConnect}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {isEn ? 'Reconnect' : 'Reconectar'}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className={`${isGoogleWS ? '' : 'flex-1'} border-red-200 text-red-500 hover:bg-red-50`}
                          onClick={() => handleDisconnect(arm.type, arm.name)}
                        >
                          {isEn ? 'Disconnect' : 'Desconectar'}
                        </Button>
                      </>
                    ) : isGoogleWS ? (
                      <Button
                        className="flex-1 bg-[#4285F4] hover:bg-[#3367D6] text-white font-semibold"
                        onClick={handleGoogleConnect}
                        disabled={googleConnecting}
                      >
                        {googleConnecting ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <Chrome className="w-5 h-5 mr-2" />
                        )}
                        {isEn ? 'Connect with Google' : 'Conectar con Google'}
                      </Button>
                    ) : (
                      <Button
                        className="flex-1"
                        style={{ backgroundColor: arm.color }}
                        onClick={() => {
                          setSelectedArm(arm)
                          setFormData({})
                          setError('')
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {isEn ? 'Connect' : 'Conectar'}
                      </Button>
                    )}
                  </div>
                )}

                {/* Ollama actions: refresh + view models */}
                {isOllama && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-[#00B4D8]/30 text-[#00B4D8] hover:bg-[#00B4D8]/5 px-3"
                        onClick={fetchOllamaStatus}
                        disabled={ollamaLoading}
                      >
                        <RefreshCw className={`w-4 h-4 ${ollamaLoading ? 'animate-spin' : ''}`} />
                      </Button>
                      {ollamaSt?.running && (
                        <Button
                          variant="outline"
                          className="flex-1 bg-[#00B4D8] text-white hover:bg-[#00B4D8]/90 border-[#00B4D8]"
                          onClick={() => router.push('/dashboard/ollama-chat')}
                        >
                          <Terminal className="w-4 h-4 mr-2" />
                          {isEn ? 'Chat' : 'Chatear'}
                        </Button>
                      )}
                      {ollamaModelsCount > 0 && (
                        <Button
                          variant="outline"
                          className="flex-1 border-[#00B4D8]/30 text-[#00B4D8] hover:bg-[#00B4D8]/5"
                          onClick={() => setOllamaModelsOpen(v => !v)}
                        >
                          <Database className="w-4 h-4 mr-2" />
                          {ollamaModelsCount} {ollamaModelsCount === 1 ? (isEn ? 'model' : 'modelo') : (isEn ? 'models' : 'modelos')}
                          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${ollamaModelsOpen ? 'rotate-180' : ''}`} />
                        </Button>
                      )}
                    </div>
                    {/* Models dropdown */}
                    <AnimatePresence>
                      {ollamaModelsOpen && ollamaSt?.models && ollamaSt.models.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-3 bg-[#00B4D8]/5 border border-[#00B4D8]/20 rounded-xl space-y-1 max-h-48 overflow-y-auto">
                            {ollamaSt.models.slice(0, 20).map((m, i) => (
                              <div key={i} className="flex items-center justify-between gap-2 text-xs py-1">
                                <code className="font-mono text-[#1A1A1A] truncate flex-1">{m.name}</code>
                                {m.parameterSize && (
                                  <span className="text-[10px] text-[#2D4A3E]/60 shrink-0">{m.parameterSize}</span>
                                )}
                              </div>
                            ))}
                            {ollamaSt.models.length > 20 && (
                              <div className="text-[10px] text-[#1A1A1A]/40 italic pt-1">
                                + {ollamaSt.models.length - 20} {isEn ? 'more...' : 'más...'}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {/* Bridge missing hint */}
                    {!ollamaBridgePresent && (
                      <p className="text-[11px] text-[#1A1A1A]/50 italic mt-1">
                        {isEn ? 'Start Octopus Bridge on your machine to enable auto-detection.' : 'Inicia el Octopus Bridge en tu equipo para activar la detección automática.'}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* === Telegram Control Panel === */}
      {isTelegramConnected && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-0 overflow-hidden border-2 border-[#0088cc]/20">
            {/* Panel Header */}
            <div className="bg-gradient-to-r from-[#0088cc] to-[#0088cc]/80 p-4 sm:p-6 text-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 sm:p-2.5 bg-white/20 rounded-2xl flex-shrink-0">
                    <Send className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-bold">{isEn ? 'Telegram Control Panel' : 'Telegram Control Panel'}</h2>
                    <p className="text-white/70 text-sm truncate">
                      {telegramBot ? `@${telegramBot.username}` : (isEn ? 'Loading bot...' : 'Cargando bot...')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {telegramSetupDone ? (
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm bg-white/20 px-2.5 sm:px-3 py-1.5 rounded-xl">
                      <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {isEn ? 'Active' : 'Activo'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs sm:text-sm bg-white/10 px-2.5 sm:px-3 py-1.5 rounded-xl">
                      <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {isEn ? 'Inactive' : 'Inactivo'}
                    </span>
                  )}
                  <button onClick={fetchTelegramStatus} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                    <RefreshCw className={`w-4 h-4 ${telegramLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Bot Info & Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#0088cc]/5 border border-[#0088cc]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-[#0088cc]" />
                    <span className="text-sm font-medium text-[#1A1A1A]/70">Bot</span>
                  </div>
                  <p className="font-bold text-[#1A1A1A]">
                    {telegramBot ? telegramBot.first_name : '...'}
                  </p>
                  <p className="text-xs text-[#1A1A1A]/50">
                    {telegramBot ? `@${telegramBot.username}` : (isEn ? 'Loading...' : 'Cargando...')}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0088cc]/5 border border-[#0088cc]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Radio className="w-4 h-4 text-[#0088cc]" />
                    <span className="text-sm font-medium text-[#1A1A1A]/70">Webhook</span>
                  </div>
                  <p className="font-bold text-[#1A1A1A]">
                    {telegramSetupDone ? (isEn ? 'Active' : 'Activo') : (isEn ? 'Not configured' : 'No configurado')}
                  </p>
                  <p className="text-xs text-[#1A1A1A]/50">
                    {telegramWebhook?.pending_update_count != null
                      ? `${telegramWebhook.pending_update_count} ${isEn ? 'pending' : 'pendientes'}`
                      : (isEn ? 'No data' : 'Sin datos')}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-[#0088cc]/5 border border-[#0088cc]/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="w-4 h-4 text-[#0088cc]" />
                    <span className="text-sm font-medium text-[#1A1A1A]/70">{isEn ? 'Commands' : 'Comandos'}</span>
                  </div>
                  <p className="font-bold text-[#1A1A1A]">{isEn ? '6 registered' : '6 registrados'}</p>
                  <p className="text-xs text-[#1A1A1A]/50">/start /status /proyectos...</p>
                </div>
              </div>

              {/* Activate Webhook */}
              {!telegramSetupDone && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-amber-800">{isEn ? 'Webhook not configured' : 'Webhook no configurado'}</p>
                      <p className="text-sm text-amber-700 mt-1">
                        {isEn
                          ? <>For OCTOPUS to receive Telegram messages, you need to activate the webhook. <strong>The app must be deployed in production</strong> for it to work.</>
                          : <>Para que OCTOPUS pueda recibir mensajes de Telegram, necesitas activar el webhook. <strong>La app debe estar desplegada en producción</strong> para que funcione.</>
                        }
                      </p>
                      <Button
                        onClick={activateTelegramWebhook}
                        disabled={telegramLoading}
                        className="mt-3 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white gap-2"
                      >
                        {telegramLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                        {isEn ? 'Activate Webhook' : 'Activar Webhook'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Message */}
              <div>
                <h3 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#0088cc]" />
                  {isEn ? 'Send test message' : 'Enviar mensaje de prueba'}
                </h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={telegramTestMsg}
                    onChange={(e) => setTelegramTestMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendTelegramTest() }}
                    placeholder={isEn ? 'Type a message to send to your Telegram...' : 'Escribe un mensaje para enviar a tu Telegram...'}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-[#0088cc] focus:ring-2 focus:ring-[#0088cc]/20 outline-none text-sm"
                    disabled={telegramSending}
                  />
                  <Button
                    onClick={sendTelegramTest}
                    disabled={!telegramTestMsg.trim() || telegramSending}
                    className="bg-[#0088cc] hover:bg-[#0088cc]/90 text-white px-6"
                  >
                    {telegramSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <AnimatePresence>
                  {telegramTestResult && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`mt-2 text-sm flex items-center gap-2 ${
                        telegramTestResult.ok ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {telegramTestResult.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {telegramTestResult.msg}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Available Commands */}
              <div>
                <h3 className="font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#0088cc]" />
                  {isEn ? 'Available Telegram Commands' : 'Comandos disponibles en Telegram'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { cmd: '/start', desc: isEn ? 'Start connection with OCTOPUS' : 'Iniciar conexión con OCTOPUS', icon: '🐙' },
                    { cmd: '/status', desc: isEn ? 'View system status' : 'Ver estado del sistema', icon: '📊' },
                    { cmd: '/proyectos', desc: isEn ? 'List my projects' : 'Listar mis proyectos', icon: '📁' },
                    { cmd: '/brazos', desc: isEn ? 'View connected arms' : 'Ver brazos conectados', icon: '🦾' },
                    { cmd: '/help', desc: isEn ? 'View available commands' : 'Ver comandos disponibles', icon: 'ℹ️' },
                    { cmd: isEn ? 'Free message' : 'Mensaje libre', desc: isEn ? 'OCTOPUS responds with AI' : 'OCTOPUS responde con IA', icon: '💬' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <span className="text-lg">{c.icon}</span>
                      <div>
                        <code className="text-sm font-mono font-bold text-[#0088cc]">{c.cmd}</code>
                        <p className="text-xs text-[#1A1A1A]/50">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capabilities summary */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0088cc]/5 to-[#2D4A3E]/5 border border-[#0088cc]/10">
                <h3 className="font-semibold text-[#1A1A1A] mb-2">{isEn ? '🐙 Active Capabilities' : '🐙 Capacidades activas'}</h3>
                <div className="flex flex-wrap gap-2">
                  {(isEn ? [
                    '📤 Send notifications',
                    '🤖 Interactive AI bot',
                    '📊 Check status',
                    '📁 List projects',
                    '🦾 View arms',
                    '🔔 Real-time alerts',
                  ] : [
                    '📤 Enviar notificaciones',
                    '🤖 Bot interactivo con IA',
                    '📊 Consultar estado',
                    '📁 Listar proyectos',
                    '🦾 Ver brazos',
                    '🔔 Alertas en tiempo real',
                  ]).map((cap, i) => (
                    <span key={i} className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-[#0088cc]/10 text-[#1A1A1A]/70">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Connection Modal - Standard Arms */}
      <AnimatePresence>
        {selectedArm && !selectedArm.isOAuth && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedArm(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = iconMap[selectedArm.icon] || Zap
                    return (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: `${selectedArm.color}20` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: selectedArm.color }} />
                      </div>
                    )
                  })()}
                  <div>
                    <h2 className="font-bold text-xl text-[#1A1A1A]">{isEn ? `Connect ${selectedArm.name}` : `Conectar ${selectedArm.name}`}</h2>
                    <p className="text-sm text-[#1A1A1A]/60">{isEn ? 'Enter your credentials' : 'Ingresa tus credenciales'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedArm(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-[#1A1A1A]/60" />
                </button>
              </div>

              {/* Instructions */}
              <div className="bg-[#2D4A3E]/5 rounded-2xl p-4 mb-6">
                <h4 className="font-medium text-[#2D4A3E] mb-2">{isEn ? 'Instructions:' : 'Instrucciones:'}</h4>
                <p className="text-sm text-[#1A1A1A]/70 whitespace-pre-line">
                  {isEn ? (selectedArm.instructionsEn || selectedArm.instructions) : selectedArm.instructions}
                </p>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {selectedArm.requiredFields.map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                      {isEn ? (field.labelEn || field.label) : field.label}
                    </label>
                    <div className="relative">
                      <input
                        type={field.type === 'password' && !showPasswords[field.name] ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        value={formData[field.name] || ''}
                        onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-[#2D4A3E]/20 focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20 outline-none transition-all"
                      />
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShowPasswords({ ...showPasswords, [field.name]: !showPasswords[field.name] })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/60"
                        >
                          {showPasswords[field.name] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedArm(null)}
                >
                  {isEn ? 'Cancel' : 'Cancelar'}
                </Button>
                <Button
                  className="flex-1"
                  style={{ backgroundColor: selectedArm.color }}
                  onClick={handleConnect}
                  disabled={saving || selectedArm.requiredFields.some(f => !formData[f.name])}
                >
                  {saving ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    isEn ? 'Connect' : 'Conectar'
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
