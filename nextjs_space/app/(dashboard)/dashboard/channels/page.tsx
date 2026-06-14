'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/lib/i18n-context'
import {
  MessageCircle,
  Phone,
  Smartphone,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Wifi,
  WifiOff,
  Zap,
  Send,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChannelStatus {
  type: 'telegram' | 'whatsapp' | 'sms'
  connected: boolean
  status: string | null
  connectedAt: string | null
  phoneNumber: string | null
  chatId: string | null
}

interface ChannelConfig {
  type: ChannelStatus['type']
  icon: React.ReactNode
  label: string
  color: string
  emoji: string
  descEs: string
  descEn: string
  webhookPath?: string
  fields: FieldDef[]
  docsUrl: string
  capabilities: string[]
}

interface FieldDef {
  key: string
  labelEs: string
  labelEn: string
  placeholder: string
  secret?: boolean
}

// ─── Channel definitions ─────────────────────────────────────────────────────

const CHANNEL_CONFIGS: ChannelConfig[] = [
  {
    type: 'telegram',
    icon: <MessageCircle size={22} />,
    label: 'Telegram',
    color: '#0088cc',
    emoji: '✈️',
    descEs: 'Bot bidireccional: texto, voz, comandos IoT y notificaciones',
    descEn: 'Bidirectional bot: text, voice, IoT commands and notifications',
    docsUrl: 'https://core.telegram.org/bots#how-do-i-create-a-bot',
    capabilities: ['💬 Texto y voz', '🏠 Control IoT', '📊 Estado del sistema', '🔔 Notificaciones'],
    fields: [
      { key: 'botToken', labelEs: 'Bot Token', labelEn: 'Bot Token', placeholder: '123456:ABC...', secret: true },
      { key: 'chatId', labelEs: 'Chat ID', labelEn: 'Chat ID', placeholder: '-100123456789' },
    ],
  },
  {
    type: 'whatsapp',
    icon: <Phone size={22} />,
    label: 'WhatsApp',
    color: '#25D366',
    emoji: '💬',
    descEs: 'WhatsApp Business vía Twilio — respuestas IA en tu número',
    descEn: 'WhatsApp Business via Twilio — AI replies on your number',
    webhookPath: '/api/channels/whatsapp/webhook',
    docsUrl: 'https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn-more',
    capabilities: ['💬 Mensajes de texto', '🤖 Respuestas IA', '📱 Tu número Twilio', '🔒 Verificación de firma'],
    fields: [
      { key: 'accountSid', labelEs: 'Account SID', labelEn: 'Account SID', placeholder: 'ACxxxxxxxx' },
      { key: 'authToken', labelEs: 'Auth Token', labelEn: 'Auth Token', placeholder: 'Tu auth token', secret: true },
      { key: 'phoneNumber', labelEs: 'Número WhatsApp', labelEn: 'WhatsApp Number', placeholder: 'whatsapp:+14155238886' },
    ],
  },
  {
    type: 'sms',
    icon: <Smartphone size={22} />,
    label: 'SMS',
    color: '#6366F1',
    emoji: '📱',
    descEs: 'SMS vía Twilio — control por mensaje de texto clásico',
    descEn: 'SMS via Twilio — control via classic text message',
    webhookPath: '/api/channels/sms/webhook',
    docsUrl: 'https://console.twilio.com/us1/develop/phone-numbers/manage/active',
    capabilities: ['📱 SMS estándar', '🤖 Respuestas IA', '🔢 Sin emojis (compatible)', '🌍 Internacional'],
    fields: [
      { key: 'accountSid', labelEs: 'Account SID', labelEn: 'Account SID', placeholder: 'ACxxxxxxxx' },
      { key: 'authToken', labelEs: 'Auth Token', labelEn: 'Auth Token', placeholder: 'Tu auth token', secret: true },
      { key: 'phoneNumber', labelEs: 'Número Twilio', labelEn: 'Twilio Number', placeholder: '+14155238886' },
    ],
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="ml-2 p-1 rounded hover:bg-white/10 transition-colors"
      title="Copiar"
    >
      {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="opacity-60" />}
    </button>
  )
}

function ChannelCard({
  config,
  status,
  locale,
  appUrl,
  onSave,
  onDisconnect,
}: {
  config: ChannelConfig
  status: ChannelStatus | undefined
  locale: 'es' | 'en'
  appUrl: string
  onSave: (type: string, data: Record<string, string>) => Promise<void>
  onDisconnect: (type: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState('')

  const connected = status?.connected ?? false
  const webhookUrl = config.webhookPath ? `${appUrl}${config.webhookPath}` : null

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await onSave(config.type, form)
      setOpen(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await onDisconnect(config.type)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ backgroundColor: config.color + '33', color: config.color }}
        >
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base">{config.emoji} {config.label}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: connected ? '#22c55e22' : '#ef444422',
                color: connected ? '#4ade80' : '#f87171',
              }}
            >
              {connected
                ? (locale === 'es' ? '● Conectado' : '● Connected')
                : (locale === 'es' ? '○ Desconectado' : '○ Disconnected')}
            </span>
          </div>
          <p className="text-sm opacity-60 mt-0.5">
            {locale === 'es' ? config.descEs : config.descEn}
          </p>
          {connected && status?.connectedAt && (
            <p className="text-xs opacity-40 mt-1">
              {locale === 'es' ? 'Conectado' : 'Connected'}{' '}
              {new Date(status.connectedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {connected && (
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {locale === 'es' ? 'Desconectar' : 'Disconnect'}
            </button>
          )}
          <button
            onClick={() => setOpen(o => !o)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
          >
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Capabilities row */}
      <div className="px-5 pb-4 flex flex-wrap gap-2">
        {config.capabilities.map(cap => (
          <span key={cap} className="text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10">
            {cap}
          </span>
        ))}
      </div>

      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 p-5 space-y-5">

              {/* Webhook URL (WhatsApp / SMS only) */}
              {webhookUrl && (
                <div>
                  <p className="text-xs font-medium opacity-60 mb-1 uppercase tracking-wide">
                    {locale === 'es' ? 'URL del Webhook (configurar en Twilio)' : 'Webhook URL (set in Twilio)'}
                  </p>
                  <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2 font-mono text-xs break-all">
                    <span className="opacity-80 flex-1">{webhookUrl}</span>
                    <CopyButton value={webhookUrl} />
                  </div>
                  <a
                    href={config.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs opacity-50 hover:opacity-80 mt-1 transition-opacity"
                  >
                    <ExternalLink size={11} />
                    {locale === 'es' ? 'Ver guía Twilio' : 'View Twilio guide'}
                  </a>
                </div>
              )}

              {/* Credentials form */}
              <div>
                <p className="text-xs font-medium opacity-60 mb-3 uppercase tracking-wide">
                  {locale === 'es' ? 'Credenciales' : 'Credentials'}
                </p>
                <div className="space-y-3">
                  {config.fields.map(field => (
                    <div key={field.key}>
                      <label className="text-xs opacity-60 mb-1 block">
                        {locale === 'es' ? field.labelEs : field.labelEn}
                      </label>
                      <div className="relative">
                        <input
                          type={field.secret && !showSecrets[field.key] ? 'password' : 'text'}
                          placeholder={field.placeholder}
                          value={form[field.key] || ''}
                          onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-white/30 pr-8"
                        />
                        {field.secret && (
                          <button
                            type="button"
                            onClick={() => setShowSecrets(s => ({ ...s, [field.key]: !s[field.key] }))}
                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80"
                          >
                            {showSecrets[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-xs mt-2">
                    <AlertCircle size={12} /> {error}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <p className="text-xs opacity-40 flex-1">
                    🔒 {locale === 'es' ? 'Cifrado AES-256 en reposo' : 'AES-256 encrypted at rest'}
                  </p>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: config.color }}
                  >
                    {saving ? (
                      <span className="animate-spin">⟳</span>
                    ) : (
                      <Zap size={14} />
                    )}
                    {locale === 'es' ? 'Guardar' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Setup guide link (non-Twilio) */}
              {!webhookUrl && (
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs opacity-50 hover:opacity-80 transition-opacity"
                >
                  <ExternalLink size={11} />
                  {locale === 'es' ? 'Cómo crear un bot de Telegram' : 'How to create a Telegram bot'}
                </a>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const { locale } = useI18n()
  const lang = locale === 'en' ? 'en' : 'es'

  const [channels, setChannels] = useState<ChannelStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [appUrl, setAppUrl] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/channels')
      const data = await res.json()
      setChannels(data.channels || [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    setAppUrl(window.location.origin)
  }, [load])

  async function handleSave(type: string, form: Record<string, string>) {
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...form }),
    })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error || 'Error')
    }
    await load()
  }

  async function handleDisconnect(type: string) {
    await fetch(`/api/channels?type=${type}`, { method: 'DELETE' })
    await load()
  }

  const connectedCount = channels.filter(c => c.connected).length
  const totalCount = CHANNEL_CONFIGS.length

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Send size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {lang === 'es' ? '🌐 Omnicanal' : '🌐 Omnichannel'}
            </h1>
            <p className="text-sm opacity-60">
              {lang === 'es'
                ? 'Telegram · WhatsApp · SMS — un cerebro, todos los canales'
                : 'Telegram · WhatsApp · SMS — one brain, all channels'}
            </p>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-2xl font-bold">{connectedCount}</div>
          <div className="text-xs opacity-50">{lang === 'es' ? 'Conectados' : 'Connected'}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="text-2xl font-bold">{totalCount}</div>
          <div className="text-xs opacity-50">{lang === 'es' ? 'Total' : 'Total'}</div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {connectedCount > 0
              ? <Wifi size={20} className="text-green-400" />
              : <WifiOff size={20} className="text-red-400" />}
          </div>
          <div className="text-xs opacity-50">
            {connectedCount > 0
              ? (lang === 'es' ? 'Activo' : 'Active')
              : (lang === 'es' ? 'Sin canales' : 'No channels')}
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 flex gap-3">
        <Zap size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm opacity-80">
          {lang === 'es'
            ? 'OCTOPUS responde automáticamente en todos los canales conectados. Las credenciales se guardan cifradas y nunca pasan por ningún modelo de IA.'
            : 'OCTOPUS automatically replies on all connected channels. Credentials are stored encrypted and never pass through any AI model.'}
        </div>
      </div>

      {/* Channel cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16 opacity-40">
          <span className="animate-spin text-2xl">⟳</span>
        </div>
      ) : (
        <div className="space-y-4">
          {CHANNEL_CONFIGS.map(config => (
            <ChannelCard
              key={config.type}
              config={config}
              status={channels.find(c => c.type === config.type)}
              locale={lang}
              appUrl={appUrl}
              onSave={handleSave}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <h3 className="font-semibold mb-3 opacity-80">
          {lang === 'es' ? '⚡ Cómo funciona' : '⚡ How it works'}
        </h3>
        <ol className="space-y-2 text-sm opacity-60 list-decimal list-inside">
          {lang === 'es' ? (
            <>
              <li>Conectas tus credenciales (cifradas, nunca expuestas)</li>
              <li>Cualquier mensaje que llegue al canal activa OCTOPUS</li>
              <li>OCTOPUS procesa con IA y responde directamente en ese canal</li>
              <li>Telegram también soporta voz 🎤 y comandos IoT 🏠</li>
            </>
          ) : (
            <>
              <li>Connect your credentials (encrypted, never exposed)</li>
              <li>Any message arriving on an active channel triggers OCTOPUS</li>
              <li>OCTOPUS processes with AI and replies directly on that channel</li>
              <li>Telegram also supports voice 🎤 and IoT commands 🏠</li>
            </>
          )}
        </ol>
      </div>
    </div>
  )
}
