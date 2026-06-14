'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Zap, Eye, EyeOff, Check, Loader2, Shield, Trash2, TestTube, ExternalLink, Mic, Volume2, VolumeX, User, Camera, Lock, LogOut, Save, Settings, CreditCard, Crown, CheckCircle, AlertCircle, Clock, Sparkles, BarChart3, Download, FileJson, FileSpreadsheet, Package } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { TURBO_MODELS, getTierBadge, TURBO_AUTO_SELECT_ID, autoSelectBestModel } from '@/lib/turbo-config'
import type { AutoSelectStrategy } from '@/lib/turbo-config'
import { useI18n } from '@/lib/i18n-context'

function PlanUsageCard() {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const [usage, setUsage] = useState<{
    planId: string
    leads: { current: number; limit: number }
    creative: { current: number; limit: number }
    iot: { current: number; limit: number }
    api_keys: { current: number; limit: number }
    brazos: { current: number; limit: number }
    agents: { current: number; limit: number }
    jarvis_premium: { allowed: boolean }
    turbo_mode: { allowed: boolean }
    data_export: { allowed: boolean }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/plan/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUsage(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#2D4A3E]" />
      </div>
    </Card>
  )

  if (!usage) return null

  const items = [
    { label: 'Growth Engine Leads', current: usage.leads.current, limit: usage.leads.limit, color: '#FFD700', icon: '🚀' },
    { label: isEn ? 'Creative Assets / month' : 'Creative Assets / mes', current: usage.creative.current, limit: usage.creative.limit, color: '#8B5CF6', icon: '🎨' },
    { label: 'IoT Devices', current: usage.iot.current, limit: usage.iot.limit, color: '#0EA5E9', icon: '📡' },
    { label: 'Agent Factory', current: usage.agents.current, limit: usage.agents.limit, color: '#F97316', icon: '🤖' },
    { label: 'API Hub Keys', current: usage.api_keys.current, limit: usage.api_keys.limit, color: '#6366F1', icon: '🔑' },
    { label: 'Brazos Connections', current: usage.brazos.current, limit: usage.brazos.limit, color: '#14B8A6', icon: '🔗' },
  ]

  const planLabel = usage.planId === 'business' ? 'Business' : usage.planId === 'pro' ? 'Pro' : 'Starter'
  const planColor = usage.planId === 'business' ? '#FFD700' : usage.planId === 'pro' ? '#C4622D' : '#2D4A3E'

  return (
    <Card variant="elevated" className="overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-[#2D4A3E] to-[#1A1A1A] text-white">
        <div className="flex items-center gap-4">
          <BarChart3 className="w-8 h-8" />
          <div className="flex-1">
            <h2 className="text-xl font-bold">{isEn ? 'Plan Usage' : 'Uso del Plan'}</h2>
            <p className="text-white/60 text-sm">{isEn ? 'Current resource consumption in your account' : 'Consumo actual de recursos en tu cuenta'}</p>
          </div>
          <span
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{ backgroundColor: `${planColor}30`, color: planColor }}
          >
            {planLabel}
          </span>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Count-based items */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map(({ label, current, limit, color, icon }) => {
            const isUnlimited = limit >= 999999
            const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / Math.max(limit, 1)) * 100))
            const atLimit = !isUnlimited && current >= limit
            const nearLimit = !isUnlimited && pct >= 80 && !atLimit
            return (
              <div key={label} className="bg-[#F5F0E8] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-semibold text-[#1A1A1A]">{label}</span>
                </div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-2xl font-bold text-[#1A1A1A]">{current}</span>
                  <span className="text-sm text-[#1A1A1A]/50">
                    / {isUnlimited ? '∞' : limit}
                  </span>
                </div>
                <div className="h-2 bg-[#1A1A1A]/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: isUnlimited ? '0%' : `${pct}%`,
                      backgroundColor: atLimit ? '#EF4444' : nearLimit ? '#F59E0B' : color,
                    }}
                  />
                </div>
                {atLimit && (
                  <p className="text-xs text-red-500 font-medium mt-1.5">
                    {isEn ? '⚠️ Limit reached' : '⚠️ Límite alcanzado'}
                  </p>
                )}
                {nearLimit && (
                  <p className="text-xs text-amber-600 font-medium mt-1.5">
                    {isEn ? `⚡ Near the limit (${pct}%)` : `⚡ Cerca del límite (${pct}%)`}
                  </p>
                )}
                {isUnlimited && (
                  <p className="text-xs text-emerald-600 font-medium mt-1.5">
                    {isEn ? '✨ Unlimited' : '✨ Ilimitado'}
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Boolean features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Jarvis Premium', desc: isEn ? 'Voice, images, web search' : 'Voz, imágenes, búsqueda web', icon: '🧠', allowed: usage.jarvis_premium.allowed },
            { label: 'Turbo Mode', desc: isEn ? 'Your own API key for premium models' : 'Tu propia API key para modelos premium', icon: '⚡', allowed: usage.turbo_mode.allowed },
            { label: 'Data Export', desc: isEn ? 'Full data export' : 'Exportación completa de datos', icon: '📦', allowed: usage.data_export.allowed },
          ].map(({ label, desc, icon, allowed }) => (
            <div key={label} className={`rounded-xl p-3 flex items-center gap-3 ${allowed ? 'bg-emerald-50 border border-emerald-200' : 'bg-[#F5F0E8] border border-[#1A1A1A]/10'}`}>
              <span className="text-xl">{icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-[#1A1A1A] block">{label}</span>
                <p className="text-[10px] text-[#1A1A1A]/40 truncate">{desc}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                allowed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
              }`}>
                {allowed ? '✓' : '✕'}
              </span>
            </div>
          ))}
        </div>

        {/* Upgrade CTA for starter */}
        {usage.planId === 'starter' && (
          <div className="bg-gradient-to-r from-[#C4622D]/10 to-[#FFD700]/10 rounded-xl p-4 flex items-center gap-3">
            <Crown className="w-5 h-5 text-[#C4622D] shrink-0" />
            <p className="text-sm text-[#1A1A1A]/70 flex-1">
              <strong className="text-[#C4622D]">{isEn ? 'Upgrade to Pro' : 'Upgrade a Pro'}</strong> {isEn ? 'to unlock more capacity and premium features.' : 'para desbloquear más capacidad y funciones premium.'}
            </p>
            <Link href="/pricing">
              <Button className="bg-gradient-to-r from-[#C4622D] to-[#FFD700] hover:opacity-90 text-white text-sm px-4 py-2">
                {isEn ? 'Upgrade' : 'Upgrade'}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  )
}

function DataExportCard() {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [planId, setPlanId] = useState('starter')
  const [purchasing, setPurchasing] = useState(false)
  const [exportPurchased, setExportPurchased] = useState(false)
  const [showPurchaseSuccess, setShowPurchaseSuccess] = useState(false)
  const exportCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/plan/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPlanId(d.planId) })
      .catch(() => {})
    // Check if user already purchased export
    fetch('/api/data-export/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.purchased) setExportPurchased(true) })
      .catch(() => {})
  }, [])

  // Detect return from successful export purchase
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('export_success') === 'true') {
      setShowPurchaseSuccess(true)
      setExportPurchased(true)
      setTimeout(() => {
        exportCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
      setTimeout(() => setShowPurchaseSuccess(false), 12000)
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('export_success')
      url.searchParams.delete('session_id')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleExport = async (scope: string, format: string) => {
    setExporting(true)
    setExportError(null)
    try {
      const res = await fetch(`/api/data-export?scope=${scope}&format=${format}`)
      if (res.status === 403) {
        const data = await res.json()
        if (data.error === 'export_too_early') {
          setExportError(isEn ? 'Minimum 1 active month on Business plan required to export full data.' : 'Se requiere mínimo 1 mes activo en plan Business para exportar datos completos.')
        } else {
          setExportError(isEn ? 'Your plan does not include this export feature.' : 'Tu plan no incluye esta función de exportación.')
        }
        return
      }
      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'csv' ? 'csv' : 'json'
      a.download = `octopus-export-${new Date().toISOString().slice(0,10)}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setExportError(isEn ? 'Error exporting data. Please try again.' : 'Error al exportar datos. Intenta de nuevo.')
    } finally {
      setExporting(false)
    }
  }

  const handleOneTimePurchase = async () => {
    setPurchasing(true)
    setExportError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'one_time_export' }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setExportError(isEn ? 'Could not start payment. Please try again.' : 'No se pudo iniciar el pago. Intenta de nuevo.')
      }
    } catch {
      setExportError(isEn ? 'Error connecting to Stripe. Please try again.' : 'Error al conectar con Stripe. Intenta de nuevo.')
    } finally {
      setPurchasing(false)
    }
  }

  const isStarter = planId === 'starter'
  const isPro = planId === 'pro'
  const isBusiness = planId === 'business'

  return (
    <Card ref={exportCardRef} variant="elevated" className="overflow-hidden">
      {/* Purchase success banner */}
      {showPurchaseSuccess && (
        <div className="p-4 bg-gradient-to-r from-[#10B981] to-[#059669] text-white flex items-center gap-3 animate-pulse">
          <CheckCircle className="w-6 h-6 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">{isEn ? 'Payment completed successfully! 🎉' : '¡Pago completado con éxito! 🎉'}</p>
            <p className="text-xs text-white/80">{isEn ? 'Your Data Export purchase has been processed. You can now download all your data.' : 'Tu compra de Data Export ha sido procesada. Ya puedes descargar todos tus datos.'}</p>
          </div>
        </div>
      )}
      <div className="p-6 bg-gradient-to-r from-[#10B981] to-[#059669] text-white">
        <div className="flex items-center gap-4">
          <Package className="w-8 h-8" />
          <div className="flex-1">
            <h2 className="text-xl font-bold">{isEn ? 'Export Data' : 'Exportar Datos'}</h2>
            <p className="text-white/70 text-sm">{isEn ? 'Download your OCTOPUS data' : 'Descarga tus datos de OCTOPUS'}</p>
          </div>
          {(isBusiness || exportPurchased) && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
              ✓ {exportPurchased && !isBusiness ? (isEn ? 'Purchased' : 'Comprado') : (isEn ? 'Included' : 'Incluido')}
            </span>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Export tiers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Basic CSV — Pro+ */}
          <div className={`rounded-xl p-4 border ${isPro || isBusiness ? 'bg-white border-emerald-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-bold text-[#1A1A1A]">{isEn ? 'Basic CSV' : 'CSV Básico'}</span>
            </div>
            <p className="text-xs text-[#1A1A1A]/50 mb-3">{isEn ? 'Leads in CSV format' : 'Leads en formato CSV'}</p>
            <div className="text-xs text-emerald-600 font-semibold mb-3">Plan Pro+</div>
            <Button
              size="sm"
              disabled={isStarter || exporting}
              onClick={() => handleExport('basic', 'csv')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              {exporting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
              {isEn ? 'Download CSV' : 'Descargar CSV'}
            </Button>
          </div>

          {/* Full JSON — Business */}
          <div className={`rounded-xl p-4 border ${isBusiness ? 'bg-white border-emerald-200' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileJson className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-bold text-[#1A1A1A]">{isEn ? 'Full Export' : 'Export Completo'}</span>
            </div>
            <p className="text-xs text-[#1A1A1A]/50 mb-3">{isEn ? 'All: leads, projects, assets, agents, invoices...' : 'Todo: leads, proyectos, assets, agentes, facturas...'}</p>
            <div className="text-xs text-blue-600 font-semibold mb-3">{isEn ? 'Business Plan (1+ month)' : 'Plan Business (1+ mes)'}</div>
            <Button
              size="sm"
              disabled={!isBusiness || exporting}
              onClick={() => handleExport('full', 'json')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              {exporting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
              {isEn ? 'Download JSON' : 'Descargar JSON'}
            </Button>
          </div>

          {/* One-time purchase — $199 */}
          <div className={`rounded-xl p-4 border ${exportPurchased ? 'border-emerald-300 bg-emerald-50' : 'border-[#FFD700]/30 bg-[#FFF8E1]'}`}>
            <div className="flex items-center gap-2 mb-2">
              {exportPurchased ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <Crown className="w-5 h-5 text-[#C4622D]" />}
              <span className="text-sm font-bold text-[#1A1A1A]">{exportPurchased ? (isEn ? 'Purchase Complete' : 'Compra Completada') : (isEn ? 'One-Time Purchase' : 'Compra Única')}</span>
            </div>
            {exportPurchased ? (
              <>
                <p className="text-xs text-emerald-700 mb-3">{isEn ? '✅ You have full access to data export' : '✅ Tienes acceso completo al export de datos'}</p>
                <Button
                  size="sm"
                  onClick={() => handleExport('full', 'json')}
                  disabled={exporting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  {exporting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Download className="w-3 h-3 mr-1" />}
                  {isEn ? 'Download Full JSON' : 'Descargar JSON Completo'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-[#1A1A1A]/50 mb-3">{isEn ? 'Full export without active subscription' : 'Export completo sin suscripción activa'}</p>
                <div className="text-lg font-bold text-[#C4622D] mb-3">$199 <span className="text-xs font-normal text-[#1A1A1A]/40">USD</span></div>
                <Button
                  size="sm"
                  disabled={purchasing}
                  onClick={handleOneTimePurchase}
                  className="w-full bg-[#C4622D] hover:bg-[#A85225] text-white text-xs"
                >
                  {purchasing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                  {isEn ? 'Buy Now' : 'Comprar Ahora'}
                </Button>
              </>
            )}
          </div>
        </div>

        {exportError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600">{exportError}</p>
          </div>
        )}

        {isStarter && (
          <div className="bg-gradient-to-r from-[#10B981]/10 to-[#059669]/10 rounded-xl p-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-[#10B981] shrink-0" />
            <p className="text-sm text-[#1A1A1A]/70 flex-1">
              <strong className="text-[#10B981]">{isEn ? 'Starter Plan:' : 'Plan Starter:'}</strong> {isEn ? 'Data export is available from the Pro plan.' : 'La exportación de datos está disponible desde el plan Pro.'}
            </p>
            <Link href="/pricing">
              <Button className="bg-gradient-to-r from-[#10B981] to-[#059669] hover:opacity-90 text-white text-sm px-4 py-2">
                Upgrade
              </Button>
            </Link>
          </div>
        )}

        <div className="bg-[#F5F0E8] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#2D4A3E] mt-0.5 shrink-0" />
            <div className="text-xs text-[#1A1A1A]/60 space-y-1">
              <p className="font-semibold text-[#1A1A1A]/80">{isEn ? 'What does the export include?' : '¿Qué incluye la exportación?'}</p>
              <p><strong>{isEn ? 'Basic CSV (Pro):' : 'CSV Básico (Pro):'}</strong> {isEn ? 'Leads with name, email, company, city, tier, score, status.' : 'Leads con nombre, email, empresa, ciudad, tier, score, estado.'}</p>
              <p><strong>{isEn ? 'Full Export (Business):' : 'Export Completo (Business):'}</strong> {isEn ? 'Leads, projects, creative assets, Brazos connections, API keys, IoT devices, sales agents, invoices and calendar events.' : 'Leads, proyectos, assets creativos, conexiones Brazos, API keys, dispositivos IoT, agentes de ventas, facturas y eventos del calendario.'}</p>
              <p><strong>{isEn ? 'One-Time Purchase ($199):' : 'Compra Única ($199):'}</strong> {isEn ? 'For former subscribers who want to recover their data.' : 'Para ex-suscriptores que quieran recuperar sus datos.'}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function SettingsPage() {
  const { t, locale } = useI18n()
  const isEn = locale === 'en'
  const { data: session, update: updateSession } = useSession() || {}

  // === PROFILE STATE ===
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [businessEmail, setBusinessEmail] = useState('')
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [hasPassword, setHasPassword] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // === PASSWORD STATE ===
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // === TURBO MODE STATE ===
  const [turboEnabled, setTurboEnabled] = useState(false)
  const [turboModel, setTurboModel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [maskedKey, setMaskedKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [usageCount, setUsageCount] = useState(0)

  // === VOICE SETTINGS STATE ===
  const [voiceLoading, setVoiceLoading] = useState(true)
  const [voiceSaving, setVoiceSaving] = useState(false)
  const [voiceTesting, setVoiceTesting] = useState(false)
  const [hasElevenLabs, setHasElevenLabs] = useState(false)
  const [elevenLabsEnabled, setElevenLabsEnabled] = useState(true)
  const [togglingEnabled, setTogglingEnabled] = useState(false)
  const [elevenLabsKey, setElevenLabsKey] = useState('')
  const [elevenLabsKeyPreview, setElevenLabsKeyPreview] = useState('')
  const [elevenLabsVoiceId, setElevenLabsVoiceId] = useState('')
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false)
  const [voiceTestResult, setVoiceTestResult] = useState<{ success: boolean; engine?: string; error?: string; warning?: string } | null>(null)
  const [keyValidation, setKeyValidation] = useState<{ valid?: boolean; error?: string; subscription?: string; characterCount?: number; characterLimit?: number } | null>(null)
  const [validating, setValidating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // === FAL.AI VIDEO API STATE ===
  const [falKey, setFalKey] = useState('')
  const [falKeyPreview, setFalKeyPreview] = useState('')
  const [hasFalKey, setHasFalKey] = useState(false)
  const [falSaving, setFalSaving] = useState(false)
  const [falTesting, setFalTesting] = useState(false)
  const [falSuccess, setFalSuccess] = useState(false)
  const [falError, setFalError] = useState<string | null>(null)
  const [showFalKey, setShowFalKey] = useState(false)
  const [falLoading, setFalLoading] = useState(true)

  // === WATERMARK STATE ===
  const [showWatermark, setShowWatermark] = useState(true)
  const [watermarkLoading, setWatermarkLoading] = useState(false)
  const [userPlan, setUserPlan] = useState('starter')

  // === BILLING STATE ===
  const searchParams = useSearchParams()
  const billingRef = useRef<HTMLDivElement>(null)
  const [billingData, setBillingData] = useState<{
    planId: string; planPeriod: string;
    subscription: { status: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean; trialEnd: string | null } | null
  } | null>(null)
  const [billingLoading, setBillingLoading] = useState(true)
  const [billingPortalLoading, setBillingPortalLoading] = useState(false)
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)

  // Load billing data
  useEffect(() => {
    const loadBilling = async () => {
      try {
        const res = await fetch('/api/stripe/subscription')
        if (res.ok) {
          const data = await res.json()
          setBillingData(data)
        }
      } catch (err) {
        console.error('Error loading billing:', err)
      } finally {
        setBillingLoading(false)
      }
    }
    loadBilling()
  }, [])

  // Handle ?tab=billing&success=true redirect
  useEffect(() => {
    if (searchParams?.get('tab') === 'billing') {
      if (searchParams?.get('success') === 'true') {
        setShowPaymentSuccess(true)
        setTimeout(() => setShowPaymentSuccess(false), 8000)
        // Reload billing data after successful checkout
        setTimeout(async () => {
          const res = await fetch('/api/stripe/subscription')
          if (res.ok) setBillingData(await res.json())
        }, 2000)
      }
      setTimeout(() => {
        billingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 500)
    }
  }, [searchParams])

  const openBillingPortal = async () => {
    setBillingPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      if (res.ok) {
        const { url } = await res.json()
        window.location.href = url
      }
    } catch (err) {
      console.error('Portal error:', err)
    } finally {
      setBillingPortalLoading(false)
    }
  }

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/turbo')
      if (res.ok) {
        const data = await res.json()
        setTurboEnabled(data.turboEnabled || false)
        setTurboModel(data.turboModel || null)
        if (data.apiKeys?.length > 0) {
          const k = data.apiKeys[0]
          setHasKey(true)
          setMaskedKey(k.apiKey || '')
          setUsageCount(k.usageCount || 0)
        }
      }
    } catch (err) {
      console.error('Error loading turbo settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadVoiceSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/voice')
      if (res.ok) {
        const data = await res.json()
        setHasElevenLabs(data.hasElevenLabs || false)
        setElevenLabsEnabled(data.elevenLabsEnabled ?? true)
        setElevenLabsKeyPreview(data.apiKeyPreview || '')
        setElevenLabsVoiceId(data.voiceId || '')
      }
    } catch (err) {
      console.error('Error loading voice settings:', err)
    } finally {
      setVoiceLoading(false)
    }
  }, [])

  // === PROFILE LOAD ===
  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/profile')
      if (res.ok) {
        const data = await res.json()
        setProfileName(data.name || '')
        setProfileEmail(data.email || '')
        setBusinessEmail(data.businessEmail || '')
        setProfileImage(data.image || null)
        setHasPassword(data.hasPassword || false)
      }
    } catch (err) {
      console.error('Error loading profile:', err)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const saveProfile = async () => {
    setProfileSaving(true)
    setProfileSuccess(false)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, businessEmail }),
      })
      if (res.ok) {
        setProfileSuccess(true)
        await updateSession?.()
        setTimeout(() => setProfileSuccess(false), 3000)
      }
    } catch (err) {
      console.error('Error saving profile:', err)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setProfileImage(data.image)
        await updateSession?.()
      } else {
        const err = await res.json()
        alert(err.error || (isEn ? 'Error uploading image' : 'Error subiendo imagen'))
      }
    } catch (err) {
      console.error('Error uploading avatar:', err)
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const changePassword = async () => {
    setPasswordError('')
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError(isEn ? 'Password must be at least 6 characters' : 'La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(isEn ? 'Passwords do not match' : 'Las contraseñas no coinciden')
      return
    }
    setPasswordSaving(true)
    try {
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setPasswordSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setHasPassword(true)
        setTimeout(() => setPasswordSuccess(false), 3000)
      } else {
        setPasswordError(data.error || (isEn ? 'Error changing password' : 'Error al cambiar contraseña'))
      }
    } catch (err) {
      console.error('Error changing password:', err)
      setPasswordError(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setPasswordSaving(false)
    }
  }

  useEffect(() => { loadProfile() }, [loadProfile])
  useEffect(() => { loadSettings() }, [loadSettings])
  useEffect(() => { loadVoiceSettings() }, [loadVoiceSettings])

  // Load watermark settings
  useEffect(() => {
    fetch('/api/settings/watermark').then(r => r.json()).then(d => {
      if (typeof d.showWatermark === 'boolean') setShowWatermark(d.showWatermark)
      if (d.planId) setUserPlan(d.planId)
    }).catch(() => {})
  }, [])

  const toggleWatermark = async (enabled: boolean) => {
    setWatermarkLoading(true)
    try {
      const res = await fetch('/api/settings/watermark', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showWatermark: enabled }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowWatermark(data.showWatermark)
      } else if (data.requiresUpgrade) {
        alert(data.error)
      }
    } catch (err) {
      console.error('Error toggling watermark:', err)
    }
    setWatermarkLoading(false)
  }

  const toggleTurbo = async (enabled: boolean) => {
    setSaving(true)
    try {
      await fetch('/api/settings/turbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', enabled }),
      })
      setTurboEnabled(enabled)
    } finally {
      setSaving(false)
    }
  }

  const selectModel = async (modelId: string) => {
    setSaving(true)
    try {
      await fetch('/api/settings/turbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_provider', provider: 'openrouter', model: modelId }),
      })
      setTurboModel(modelId)
    } finally {
      setSaving(false)
    }
  }

  const saveApiKey = async () => {
    if (!apiKey.trim()) return
    setSaving(true)
    try {
      await fetch('/api/settings/turbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_key', provider: 'openrouter', apiKey: apiKey.trim() }),
      })
      setApiKey('')
      await loadSettings()
    } finally {
      setSaving(false)
    }
  }

  const deleteApiKey = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings/turbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_key', provider: 'openrouter' }),
      })
      setHasKey(false)
      setMaskedKey('')
      setTurboEnabled(false)
      setUsageCount(0)
    } finally {
      setSaving(false)
    }
  }

  const testApiKey = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/turbo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_key', provider: 'openrouter' }),
      })
      const data = await res.json()
      setTestResult({ success: data.success, error: data.error })
      await loadSettings()
    } finally {
      setTesting(false)
    }
  }

  // === VOICE FUNCTIONS ===
  const saveVoiceSettings = async () => {
    if (!elevenLabsKey.trim()) return
    setVoiceSaving(true)
    setVoiceTestResult(null)
    try {
      const res = await fetch('/api/settings/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: elevenLabsKey.trim(),
          voiceId: elevenLabsVoiceId.trim() || 'EXAVITQu4vr4xnSDxMaL', // Voz por defecto: Sarah
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setVoiceTestResult({ success: true, engine: 'elevenlabs' })
        setElevenLabsKey('')
        await loadVoiceSettings()
      } else {
        setVoiceTestResult({ success: false, error: data.error || 'Error' })
      }
    } catch {
      setVoiceTestResult({ success: false, error: isEn ? 'Connection error' : 'Error de conexión' })
    } finally {
      setVoiceSaving(false)
    }
  }

  const deleteVoiceSettings = async () => {
    setVoiceSaving(true)
    try {
      await fetch('/api/settings/voice', { method: 'DELETE' })
      setHasElevenLabs(false)
      setElevenLabsKeyPreview('')
      setElevenLabsVoiceId('')
      setVoiceTestResult(null)
    } finally {
      setVoiceSaving(false)
    }
  }

  const validateKey = async () => {
    setValidating(true)
    setKeyValidation(null)
    try {
      const res = await fetch('/api/settings/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate' }),
      })
      const data = await res.json()
      setKeyValidation(data)
    } catch {
      setKeyValidation({ valid: false, error: isEn ? 'Connection error' : 'Error de conexión' })
    } finally {
      setValidating(false)
    }
  }

  const testVoice = async () => {
    setVoiceTesting(true)
    setVoiceTestResult(null)
    try {
      const res = await fetch('/api/jarvis/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: isEn ? 'Hello, I am OCTOPUS, your creative assistant. How can I help you today?' : 'Hola, soy OCTOPUS, tu asistente creativo. ¿En qué puedo ayudarte hoy?' }),
      })
      if (res.ok) {
        const data = await res.json()
        if (audioRef.current) {
          audioRef.current.pause()
        }
        const audio = new Audio('data:audio/mp3;base64,' + data.audioBase64)
        audioRef.current = audio
        audio.play()
        setVoiceTestResult({
          success: true,
          engine: data.engine === 'elevenlabs' ? 'ElevenLabs Premium' : 'Google Translate',
          warning: data.warning || undefined,
        })
      } else {
        setVoiceTestResult({ success: false, error: isEn ? 'Could not generate audio' : 'No se pudo generar audio' })
      }
    } catch {
      setVoiceTestResult({ success: false, error: isEn ? 'Connection error' : 'Error de conexión' })
    } finally {
      setVoiceTesting(false)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
  }

  // === FAL.AI FUNCTIONS ===
  const loadFalSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/api-hub')
      if (res.ok) {
        const data = await res.json()
        const falEntry = data.find?.((k: { serviceType: string }) => k.serviceType === 'falai')
        if (falEntry) {
          setHasFalKey(true)
          setFalKeyPreview(falEntry.apiKey || '')
        }
      }
    } catch { /* ignore */ } finally {
      setFalLoading(false)
    }
  }, [])

  useEffect(() => { loadFalSettings() }, [loadFalSettings])

  const saveFalKey = async () => {
    if (!falKey.trim()) return
    setFalSaving(true)
    setFalError(null)
    try {
      const res = await fetch('/api/api-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: 'falai', name: 'fal.ai', apiKey: falKey.trim() }),
      })
      if (res.ok) {
        setFalSuccess(true)
        setFalKey('')
        await loadFalSettings()
        setTimeout(() => setFalSuccess(false), 3000)
      } else {
        const data = await res.json()
        setFalError(data.error || (isEn ? 'Error saving key' : 'Error al guardar la key'))
      }
    } catch {
      setFalError(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setFalSaving(false)
    }
  }

  const testFalKey = async () => {
    setFalTesting(true)
    setFalError(null)
    try {
      const res = await fetch('/api/api-hub/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceType: 'falai' }),
      })
      const data = await res.json()
      if (data.success) {
        setFalSuccess(true)
        setTimeout(() => setFalSuccess(false), 3000)
      } else {
        setFalError(data.error || (isEn ? 'Invalid or expired key' : 'Key inválida o expirada'))
      }
    } catch {
      setFalError(isEn ? 'Connection error' : 'Error de conexión')
    } finally {
      setFalTesting(false)
    }
  }

  const deleteFalKey = async () => {
    setFalSaving(true)
    try {
      // Find the key ID first
      const listRes = await fetch('/api/api-hub')
      if (listRes.ok) {
        const keys = await listRes.json()
        const falEntry = keys.find?.((k: { serviceType: string }) => k.serviceType === 'falai')
        if (falEntry?.id) {
          await fetch(`/api/api-hub?id=${falEntry.id}`, { method: 'DELETE' })
        }
      }
      setHasFalKey(false)
      setFalKeyPreview('')
      setFalError(null)
    } finally {
      setFalSaving(false)
    }
  }

  if (loading || voiceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D4A3E]" />
      </div>
    )
  }

  const selectedModelInfo = TURBO_MODELS.find(m => m.id === turboModel)

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/dashboard">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('settings.back')}
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-gradient-to-br from-[#2D4A3E] to-[#4A7A5E] rounded-2xl flex items-center justify-center shadow-lg">
          <Settings className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">{isEn ? 'Settings' : 'Configuración'}</h1>
          <p className="text-[#1A1A1A]/50">{isEn ? 'Manage your profile, security and OCTOPUS preferences' : 'Administra tu perfil, seguridad y preferencias de OCTOPUS'}</p>
        </div>
      </div>

      {/* ============================================ */}
      {/* PERFIL DE USUARIO */}
      {/* ============================================ */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#2D4A3E] to-[#3D5A4E] text-white">
          <div className="flex items-center gap-4">
            <User className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">{isEn ? 'Profile' : 'Perfil'}</h2>
              <p className="text-white/60 text-sm">{isEn ? 'Your identity within OCTOPUS' : 'Tu identidad dentro de OCTOPUS'}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {profileLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#2D4A3E]" />
            </div>
          ) : (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#2D4A3E] to-[#C4622D] flex items-center justify-center overflow-hidden shadow-lg">
                    {profileImage ? (
                      <img src={profileImage} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl font-bold text-white">
                        {profileName?.charAt(0)?.toUpperCase() || '🐙'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#C4622D] rounded-xl flex items-center justify-center text-white shadow-lg hover:bg-[#B5521D] transition-colors"
                  >
                    {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[#1A1A1A]">{profileName || (isEn ? 'No name' : 'Sin nombre')}</p>
                  <p className="text-sm text-[#1A1A1A]/50">{profileEmail}</p>
                  <p className="text-xs text-[#1A1A1A]/30 mt-1">{isEn ? 'JPG, PNG, WebP or GIF · Max 5MB' : 'JPG, PNG, WebP o GIF · Máx 5MB'}</p>
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#1A1A1A]">{isEn ? 'Name' : 'Nombre'}</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F0E8] rounded-xl border border-[#2D4A3E]/10 focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/30 text-[#1A1A1A]"
                  placeholder={isEn ? 'Your name' : 'Tu nombre'}
                />
              </div>

              {/* Email (solo lectura) */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#1A1A1A]">Email</label>
                <input
                  type="email"
                  value={profileEmail}
                  readOnly
                  className="w-full px-4 py-3 bg-[#F5F0E8]/50 rounded-xl border border-[#2D4A3E]/5 text-[#1A1A1A]/50 cursor-not-allowed"
                />
                <p className="text-xs text-[#1A1A1A]/30">{isEn ? 'Email cannot be changed' : 'El email no se puede cambiar'}</p>
              </div>

              {/* Business Email */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[#1A1A1A] flex items-center gap-2">
                  {isEn ? 'Business Email' : 'Email Empresarial'}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#C4622D]/10 text-[#C4622D] border border-[#C4622D]/20">
                    {isEn ? 'Optional' : 'Opcional'}
                  </span>
                </label>
                <input
                  type="email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F0E8] rounded-xl border border-[#2D4A3E]/10 focus:outline-none focus:ring-2 focus:ring-[#C4622D]/30 text-[#1A1A1A]"
                  placeholder={isEn ? 'contact@yourbusiness.com' : 'contacto@tunegocio.com'}
                />
                <p className="text-xs text-[#1A1A1A]/40">
                  {isEn
                    ? '📧 This email will appear in outgoing emails to your leads/clients instead of your personal email.'
                    : '📧 Este email aparecerá en los correos que envías a tus leads/clientes en lugar de tu email personal.'}
                </p>
              </div>

              {/* Guardar */}
              <Button
                onClick={saveProfile}
                disabled={profileSaving}
                className="bg-[#2D4A3E] hover:bg-[#1A3A2E] text-white"
              >
                {profileSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isEn ? 'Saving...' : 'Guardando...'}</>
                ) : profileSuccess ? (
                  <><Check className="w-4 h-4 mr-2" /> {isEn ? 'Saved ✓' : 'Guardado ✓'}</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> {isEn ? 'Save Profile' : 'Guardar Perfil'}</>

                )}
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* ============================================ */}
      {/* BILLING / SUBSCRIPTION */}
      {/* ============================================ */}
      <div ref={billingRef}>
        <Card variant="elevated" className="overflow-hidden">
          <div className="p-6 bg-gradient-to-r from-[#C4622D] to-[#FFD700] text-white">
            <div className="flex items-center gap-4">
              <CreditCard className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">{t('settings.billing')}</h2>
                <p className="text-white/80 text-sm">{t('settings.billing_desc')}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {/* Success banner */}
            {showPaymentSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl"
              >
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-emerald-700 font-medium text-sm">{t('settings.payment_success')}</p>
              </motion.div>
            )}

            {billingLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#C4622D]" />
              </div>
            ) : (
              <>
                {/* Plan info */}
                <div className="bg-[#F5F0E8] rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        billingData?.planId === 'business' ? 'bg-[#FFD700]/20' :
                        billingData?.planId === 'pro' ? 'bg-[#C4622D]/20' :
                        'bg-[#2D4A3E]/20'
                      }`}>
                        <Crown className={`w-5 h-5 ${
                          billingData?.planId === 'business' ? 'text-[#FFD700]' :
                          billingData?.planId === 'pro' ? 'text-[#C4622D]' :
                          'text-[#2D4A3E]'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#1A1A1A] text-lg capitalize">
                          {billingData?.planId || 'starter'} {billingData?.planId === 'starter' ? '' : 'Plan'}
                        </h3>
                        <p className="text-sm text-[#1A1A1A]/50">
                          {billingData?.planId === 'starter'
                            ? t('settings.plan_free')
                            : `${t('settings.plan_period')}: ${billingData?.planPeriod === 'annual' ? t('settings.annual') : t('settings.monthly')}`
                          }
                        </p>
                      </div>
                    </div>
                    {billingData?.subscription && (
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        billingData.subscription.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                        billingData.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                        billingData.subscription.status === 'canceled' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {billingData.subscription.status === 'active' ? t('settings.plan_active') :
                         billingData.subscription.status === 'trialing' ? t('settings.plan_trialing') :
                         billingData.subscription.status === 'canceled' ? t('settings.plan_canceled') :
                         t('settings.plan_past_due')}
                      </span>
                    )}
                  </div>

                  {/* Subscription details */}
                  {billingData?.subscription && (
                    <div className="pt-3 border-t border-[#2D4A3E]/10 space-y-2">
                      {billingData.subscription.trialEnd && billingData.subscription.status === 'trialing' && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-blue-500" />
                          <span className="text-[#1A1A1A]/60">{t('settings.plan_trial')}:</span>
                          <span className="font-semibold text-blue-600">
                            {new Date(billingData.subscription.trialEnd).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {billingData.subscription.cancelAtPeriodEnd ? (
                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span className="text-[#1A1A1A]/60">{t('settings.plan_cancels')}:</span>
                          <span className="font-semibold text-amber-600">
                            {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                      ) : billingData.subscription.status === 'active' && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-[#1A1A1A]/60">{t('settings.plan_renews')}:</span>
                          <span className="font-semibold text-emerald-600">
                            {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  {billingData?.planId !== 'starter' && billingData?.subscription ? (
                    <Button
                      onClick={openBillingPortal}
                      disabled={billingPortalLoading}
                      className="bg-[#1A1A1A] hover:bg-[#333] text-white"
                    >
                      {billingPortalLoading ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('settings.saving')}</>
                      ) : (
                        <><ExternalLink className="w-4 h-4 mr-2" /> {t('settings.manage_billing')}</>
                      )}
                    </Button>
                  ) : (
                    <Link href="/pricing">
                      <Button className="bg-gradient-to-r from-[#C4622D] to-[#FFD700] hover:opacity-90 text-white">
                        <Crown className="w-4 h-4 mr-2" /> {t('settings.upgrade_plan')}
                      </Button>
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ============================================ */}
      {/* PLAN USAGE INDICATORS */}
      {/* ============================================ */}
      <PlanUsageCard />

      {/* ============================================ */}
      {/* CAMBIAR CONTRASEÑA */}
      {/* ============================================ */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#1A1A1A] to-[#2D4A3E] text-white">
          <div className="flex items-center gap-4">
            <Lock className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">{t('settings.security')}</h2>
              <p className="text-white/60 text-sm">{hasPassword ? (isEn ? 'Change your password' : 'Cambia tu contraseña') : (isEn ? 'Set a password' : 'Establece una contraseña')}</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {hasPassword && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#1A1A1A]">{isEn ? 'Current password' : 'Contraseña actual'}</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#F5F0E8] rounded-xl border border-[#2D4A3E]/10 focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/30 text-[#1A1A1A] pr-12"
                  placeholder="••••••••"
                />
                <button
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#1A1A1A]">
              {hasPassword ? (isEn ? 'New password' : 'Nueva contraseña') : (isEn ? 'Password' : 'Contraseña')}
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-[#F5F0E8] rounded-xl border border-[#2D4A3E]/10 focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/30 text-[#1A1A1A] pr-12"
                placeholder={isEn ? 'Minimum 6 characters' : 'Mínimo 6 caracteres'}
              />
              <button
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#1A1A1A]">{isEn ? 'Confirm password' : 'Confirmar contraseña'}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F0E8] rounded-xl border border-[#2D4A3E]/10 focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/30 text-[#1A1A1A]"
              placeholder={isEn ? 'Repeat the password' : 'Repite la contraseña'}
            />
          </div>

          {passwordError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {passwordError}
            </div>
          )}

          <Button
            onClick={changePassword}
            disabled={passwordSaving || !newPassword || !confirmPassword}
            className="bg-[#1A1A1A] hover:bg-[#333] text-white"
          >
            {passwordSaving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isEn ? 'Changing...' : 'Cambiando...'}</>
            ) : passwordSuccess ? (
              <><Check className="w-4 h-4 mr-2" /> {isEn ? 'Password updated ✓' : 'Contraseña actualizada ✓'}</>
            ) : (
              <><Shield className="w-4 h-4 mr-2" /> {hasPassword ? t('settings.change_password') : t('settings.set_password')}</>

            )}
          </Button>
        </div>
      </Card>

      {/* ============================================ */}
      {/* CERRAR SESIÓN */}
      {/* ============================================ */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
              <LogOut className="w-6 h-6 text-[#C4622D]" />
            </div>
            <div>
              <h3 className="font-bold text-[#1A1A1A]">{t('settings.logout')}</h3>
              <p className="text-sm text-[#1A1A1A]/50">{isEn ? 'Sign out of your OCTOPUS account' : 'Salir de tu cuenta en OCTOPUS'}</p>
            </div>
          </div>
          <Button
            onClick={() => signOut({ callbackUrl: '/login' })}
            variant="outline"
            className="border-[#C4622D]/30 text-[#C4622D] hover:bg-[#C4622D]/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('settings.logout')}
          </Button>
        </div>
      </Card>

      {/* ============================================ */}
      {/* TURBO MODE CARD */}
      {/* ============================================ */}
      <Card variant="elevated" className="overflow-hidden">
        {/* Header oscuro */}
        <div className="p-6 bg-gradient-to-r from-[#1A1A1A] to-[#2D4A3E] text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={turboEnabled ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
                transition={{ repeat: turboEnabled ? Infinity : 0, duration: 2 }}
                className="text-4xl"
              >
                ⚡
              </motion.div>
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Turbo Mode
                  {turboEnabled && (
                    <span className="text-xs bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full">{isEn ? 'ACTIVE' : 'ACTIVO'}</span>
                  )}
                </h2>
                <p className="text-white/60 text-sm">
                  {isEn ? 'One API key → access to GPT-5.4, Claude Opus, Gemini 3.1 and more' : 'Una sola API key → acceso a GPT-5.4, Claude Opus, Gemini 3.1 y más'}
                </p>
              </div>
            </div>
            
            {/* Toggle */}
            <button
              onClick={() => toggleTurbo(!turboEnabled)}
              disabled={saving || !hasKey || !turboModel}
              className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                turboEnabled 
                  ? 'bg-amber-400 shadow-lg shadow-amber-400/30' 
                  : 'bg-white/20'
              } ${(!hasKey || !turboModel) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <motion.div
                animate={{ x: turboEnabled ? 32 : 4 }}
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
              />
            </button>
          </div>
          
          {turboEnabled && selectedModelInfo && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2 text-sm"
            >
              <Shield className="w-4 h-4 text-emerald-300" />
              <span className="text-white/80">
                {isEn ? 'Using' : 'Usando'} <strong className="text-amber-300">{selectedModelInfo.name}</strong> ({selectedModelInfo.provider}) via OpenRouter
              </span>
            </motion.div>
          )}
        </div>

        <div className="p-6 space-y-6">
          {/* ============================================ */}
          {/* PASO 1: API KEY */}
          {/* ============================================ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]/60 uppercase tracking-wider">
                {isEn ? '1. Your OpenRouter API Key' : '1. Tu API Key de OpenRouter'}
              </h3>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#C4622D] hover:underline flex items-center gap-1"
              >
                {isEn ? 'Get key' : 'Obtener key'} <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-[#F5F0E8] rounded-xl p-4">
              {hasKey ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white rounded-lg px-3 py-2.5 text-sm font-mono text-[#1A1A1A]/60 border border-[#2D4A3E]/10">
                      {showKey ? maskedKey : '••••••••••••••••••••' + maskedKey.slice(-4)}
                    </div>
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="p-2.5 rounded-lg hover:bg-white/60 text-[#1A1A1A]/40"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={testApiKey}
                      disabled={testing}
                      className="p-2.5 rounded-lg hover:bg-emerald-100 text-emerald-600"
                      title={isEn ? 'Test key' : 'Probar key'}
                    >
                      {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={deleteApiKey}
                      className="p-2.5 rounded-lg hover:bg-red-100 text-red-500"
                      title={isEn ? 'Delete key' : 'Eliminar key'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[#1A1A1A]/40">
                    <span className="flex items-center gap-1 text-emerald-500">{isEn ? '● Active' : '● Activa'}</span>
                    {usageCount > 0 && <span>{usageCount} {isEn ? 'uses in OCTOPUS' : 'usos en OCTOPUS'}</span>}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-..."
                    className="flex-1 bg-white rounded-lg px-3 py-2.5 text-sm font-mono border border-[#2D4A3E]/10 focus:outline-none focus:border-[#2D4A3E]/40 text-[#1A1A1A]"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="p-2.5 rounded-lg hover:bg-white/60 text-[#1A1A1A]/40"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <Button
                    onClick={saveApiKey}
                    disabled={!apiKey.trim() || saving}
                    size="sm"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEn ? 'Save' : 'Guardar')}
                  </Button>
                </div>
              )}
              
              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-2 text-xs flex items-center gap-1 ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {testResult.success ? <Check className="w-3 h-3" /> : '✕'}
                  {testResult.success ? (isEn ? 'API Key valid ✓ Successful connection to OpenRouter' : 'API Key válida ✓ Conexión exitosa con OpenRouter') : `Error: ${testResult.error || (isEn ? 'Invalid key' : 'Key inválida')}`}
                </motion.div>
              )}
            </div>
          </div>

          {/* ============================================ */}
          {/* PASO 2: SELECCIÓN DE MODELO */}
          {/* ============================================ */}
          <div>
            <h3 className="text-sm font-semibold text-[#1A1A1A]/60 uppercase tracking-wider mb-3">
              {isEn ? '2. Choose your model' : '2. Elige tu modelo'}
            </h3>

            {/* AUTO-SELECT OPTIONS */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-[#1A1A1A]/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {isEn ? '🤖 Smart Auto-Selection' : '🤖 Auto-Selección Inteligente'}
              </div>
              <div className="grid gap-2">
                {([
                  { id: `${TURBO_AUTO_SELECT_ID}:smartest`, label: isEn ? '🧠 Smartest' : '🧠 Más Inteligente', desc: isEn ? 'Always uses the most powerful available model' : 'Siempre usa el modelo más potente disponible', strategy: 'smartest' as AutoSelectStrategy, gradient: 'from-purple-500 to-indigo-600' },
                  { id: `${TURBO_AUTO_SELECT_ID}:balanced`, label: isEn ? '⚖️ Balanced' : '⚖️ Balanceado', desc: isEn ? 'Best intelligence/cost ratio (recommended)' : 'Mejor relación inteligencia/costo (recomendado)', strategy: 'balanced' as AutoSelectStrategy, gradient: 'from-amber-500 to-orange-600' },
                  { id: `${TURBO_AUTO_SELECT_ID}:efficient`, label: isEn ? '💰 Most Efficient' : '💰 Más Eficiente', desc: isEn ? 'Maximum performance at the lowest cost' : 'Máximo rendimiento al menor costo posible', strategy: 'efficient' as AutoSelectStrategy, gradient: 'from-emerald-500 to-teal-600' },
                ] as const).map(opt => {
                  const isActive = turboModel === opt.id
                  const resolved = autoSelectBestModel(opt.strategy)
                  return (
                    <button
                      key={opt.id}
                      onClick={() => selectModel(opt.id)}
                      disabled={!hasKey}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                        isActive
                          ? 'border-amber-400 bg-gradient-to-r from-amber-400/5 to-orange-400/5 shadow-sm shadow-amber-400/10'
                          : !hasKey
                            ? 'border-[#2D4A3E]/5 opacity-50 cursor-not-allowed'
                            : 'border-[#2D4A3E]/10 hover:border-[#2D4A3E]/30 hover:bg-[#F5F0E8]/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${opt.gradient} flex items-center justify-center text-white text-sm shadow-sm`}>
                          {opt.label.split(' ')[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-[#1A1A1A]">{opt.label.split(' ').slice(1).join(' ')}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 font-bold">AUTO</span>
                          </div>
                          <p className="text-xs text-[#1A1A1A]/50 mt-0.5">{opt.desc}</p>
                          {isActive && (
                            <p className="text-[10px] text-amber-600 mt-0.5 font-medium">
                              → {isEn ? 'Using' : 'Usando'}: {resolved.providerIcon} {resolved.name} ({resolved.provider})
                            </p>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* MANUAL MODEL LIST */}
            <div className="text-xs font-semibold text-[#1A1A1A]/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              {isEn ? '🎯 Manual Selection' : '🎯 Selección Manual'}
            </div>
            <div className="grid gap-2">
              {TURBO_MODELS.map(model => {
                const badge = getTierBadge(model.tier)
                const isActive = turboModel === model.id
                return (
                  <button
                    key={model.id}
                    onClick={() => selectModel(model.id)}
                    disabled={!hasKey}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isActive 
                        ? 'border-amber-400 bg-amber-400/5 shadow-sm shadow-amber-400/10' 
                        : !hasKey
                          ? 'border-[#2D4A3E]/5 opacity-50 cursor-not-allowed'
                          : 'border-[#2D4A3E]/10 hover:border-[#2D4A3E]/30 hover:bg-[#F5F0E8]/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{model.providerIcon}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-[#1A1A1A]">{model.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${badge.color} ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#2D4A3E]/5 text-[#1A1A1A]/40">
                            {model.contextWindow}
                          </span>
                          {model.supportsVision && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">{isEn ? '👁 Vision' : '👁 Visión'}</span>
                          )}
                        </div>
                        <p className="text-xs text-[#1A1A1A]/50 mt-0.5">{model.description}</p>
                      </div>
                    </div>
                    {isActive && (
                      <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Info */}
          <div className="bg-[#F5F0E8] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#2D4A3E] mt-0.5 shrink-0" />
              <div className="text-xs text-[#1A1A1A]/60 space-y-1">
                <p className="font-semibold text-[#1A1A1A]/80">{isEn ? 'What is OpenRouter?' : '¿Qué es OpenRouter?'}</p>
                <p>{isEn ? 'OpenRouter is a gateway that gives you access to' : 'OpenRouter es un gateway que te da acceso a'} <strong>{isEn ? 'all AI models' : 'todos los modelos de IA'}</strong> {isEn ? 'with a single API key. GPT-5.4, Claude Opus, Gemini, DeepSeek, Grok and more — all from one place.' : 'con una sola API key. GPT-5.4, Claude Opus, Gemini, DeepSeek, Grok y más — todo desde un solo lugar.'}</p>
                <p>{isEn ? 'When Turbo is active, OCTOPUS sends your requests directly to the model you choose via OpenRouter. If there\'s an error, OCTOPUS automatically falls back to the standard engine.' : 'Cuando Turbo está activo, OCTOPUS envía tus solicitudes directamente al modelo que elijas via OpenRouter. Si hay algún error, OCTOPUS vuelve automáticamente al motor estándar.'}</p>
                <p className="font-semibold text-[#C4622D]">{isEn ? 'Applies to the entire platform: Chat, Creative Studio, Skills, Agents and more.' : 'Aplica a toda la plataforma: Chat, Estudio Creativo, Skills, Agentes y más.'}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================ */}
      {/* VOICE SETTINGS CARD */}
      {/* ============================================ */}
      <Card variant="elevated" className="overflow-hidden">
        {/* Header oscuro con gradiente púrpura */}
        <div className="p-6 bg-gradient-to-r from-[#2D4A3E] to-[#1A1A1A] text-white">
          <div className="flex items-center gap-4">
            <motion.div
              animate={hasElevenLabs ? { scale: [1, 1.15, 1] } : {}}
              transition={{ repeat: hasElevenLabs ? Infinity : 0, duration: 3 }}
              className="text-4xl"
            >
              🎙️
            </motion.div>
            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {isEn ? 'Voice Configuration' : 'Configuración de Voz'}
                {hasElevenLabs && (
                  <span className="text-xs bg-purple-400/20 text-purple-300 px-2 py-0.5 rounded-full">PREMIUM</span>
                )}
              </h2>
              <p className="text-white/60 text-sm">
                {hasElevenLabs
                  ? (isEn ? 'OCTOPUS speaks with ultra-realistic ElevenLabs voice' : 'OCTOPUS habla con voz ultra-realista de ElevenLabs')
                  : (isEn ? 'OCTOPUS uses Google Translate TTS (free) — connect ElevenLabs for premium voice' : 'OCTOPUS usa Google Translate TTS (gratuito) — conecta ElevenLabs para voz premium')}
              </p>
            </div>
            {/* Botón de test rápido */}
            <div className="flex items-center gap-2">
              <button
                onClick={testVoice}
                disabled={voiceTesting}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                title={isEn ? 'Test current voice' : 'Probar voz actual'}
              >
                {voiceTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}
              </button>
              {audioRef.current && (
                <button
                  onClick={stopAudio}
                  className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
                  title={isEn ? 'Stop audio' : 'Detener audio'}
                >
                  <VolumeX className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Motor activo + toggle */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 space-y-2"
          >
            <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2 text-sm">
              <Mic className="w-4 h-4 text-purple-300" />
              <span className="text-white/80">
                {isEn ? 'Active engine:' : 'Motor activo:'} <strong className={hasElevenLabs && elevenLabsEnabled ? 'text-purple-300' : 'text-emerald-300'}>
                  {hasElevenLabs && elevenLabsEnabled ? 'ElevenLabs Premium' : (isEn ? 'Google Translate (Free)' : 'Google Translate (Gratuito)')}
                </strong>
              </span>
            </div>
            {hasElevenLabs && (
              <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2 text-sm">
                <span className="text-white/80 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-300" />
                  ElevenLabs {elevenLabsEnabled ? (isEn ? 'enabled' : 'activado') : (isEn ? 'disabled' : 'desactivado')}
                </span>
                <button
                  onClick={async () => {
                    setTogglingEnabled(true)
                    try {
                      const res = await fetch('/api/settings/voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'toggle_enabled' }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setElevenLabsEnabled(data.elevenLabsEnabled)
                      }
                    } catch (err) {
                      console.error('Error toggling ElevenLabs:', err)
                    } finally {
                      setTogglingEnabled(false)
                    }
                  }}
                  disabled={togglingEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    elevenLabsEnabled ? 'bg-purple-500' : 'bg-white/20'
                  } ${togglingEnabled ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      elevenLabsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </motion.div>
        </div>

        <div className="p-6 space-y-6">
          {/* ============================================ */}
          {/* ELEVENLABS CONFIG */}
          {/* ============================================ */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[#1A1A1A]/60 uppercase tracking-wider">
                {hasElevenLabs ? (isEn ? 'Your ElevenLabs is connected' : 'Tu ElevenLabs está conectado') : (isEn ? 'Connect ElevenLabs (Optional)' : 'Conectar ElevenLabs (Opcional)')}
              </h3>
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#C4622D] hover:underline flex items-center gap-1"
              >
                {isEn ? 'Get API key' : 'Obtener API key'} <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="bg-[#F5F0E8] rounded-xl p-4 space-y-3">
              {hasElevenLabs ? (
                <>
                  {/* Key guardada */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white rounded-lg px-3 py-2.5 text-sm font-mono text-[#1A1A1A]/60 border border-[#2D4A3E]/10">
                      {elevenLabsKeyPreview || '••••••••'}
                    </div>
                    <button
                      onClick={validateKey}
                      disabled={validating}
                      className="p-2.5 rounded-lg hover:bg-emerald-100 text-emerald-600"
                      title={isEn ? 'Verify API key' : 'Verificar API key'}
                    >
                      {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={deleteVoiceSettings}
                      disabled={voiceSaving}
                      className="p-2.5 rounded-lg hover:bg-red-100 text-red-500"
                      title={isEn ? 'Delete and switch back to Google Translate' : 'Eliminar y volver a Google Translate'}
                    >
                      {voiceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  {elevenLabsVoiceId && (
                    <div className="text-xs text-[#1A1A1A]/40">
                      Voice ID: <span className="font-mono">{elevenLabsVoiceId}</span>
                    </div>
                  )}
                  {/* Key validation result */}
                  {keyValidation && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-xs p-2 rounded-lg ${keyValidation.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}
                    >
                      {keyValidation.valid ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1"><Check className="w-3 h-3" /> {isEn ? 'API Key valid ✓' : 'API Key válida ✓'}</div>
                          <div>Plan: <strong>{keyValidation.subscription}</strong></div>
                          <div>{isEn ? 'Characters' : 'Caracteres'}: {(keyValidation.characterCount || 0).toLocaleString()} / {(keyValidation.characterLimit || 0).toLocaleString()}</div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          ✕ {keyValidation.error || (isEn ? 'Invalid key' : 'Key inválida')} — {isEn ? 'Delete and re-enter a valid key' : 'Elimina y vuelve a ingresar una key válida'}
                        </div>
                      )}
                    </motion.div>
                  )}
                </>
              ) : (
                <>
                  {/* Input API Key */}
                  <div>
                    <label className="text-xs text-[#1A1A1A]/50 mb-1 block">{isEn ? 'ElevenLabs API Key' : 'API Key de ElevenLabs'}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showElevenLabsKey ? 'text' : 'password'}
                        value={elevenLabsKey}
                        onChange={(e) => setElevenLabsKey(e.target.value)}
                        placeholder="sk_..."
                        className="flex-1 bg-white rounded-lg px-3 py-2.5 text-sm font-mono border border-[#2D4A3E]/10 focus:outline-none focus:border-[#2D4A3E]/40 text-[#1A1A1A]"
                      />
                      <button
                        onClick={() => setShowElevenLabsKey(!showElevenLabsKey)}
                        className="p-2.5 rounded-lg hover:bg-white/60 text-[#1A1A1A]/40"
                      >
                        {showElevenLabsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Input Voice ID */}
                  <div>
                    <label className="text-xs text-[#1A1A1A]/50 mb-1 block">
                      Voice ID <span className="text-[#1A1A1A]/30">{isEn ? '(optional — uses Sarah by default)' : '(opcional — usa Sarah por defecto)'}</span>
                    </label>
                    <input
                      type="text"
                      value={elevenLabsVoiceId}
                      onChange={(e) => setElevenLabsVoiceId(e.target.value)}
                      placeholder="EXAVITQu4vr4xnSDxMaL"
                      className="w-full bg-white rounded-lg px-3 py-2.5 text-sm font-mono border border-[#2D4A3E]/10 focus:outline-none focus:border-[#2D4A3E]/40 text-[#1A1A1A]"
                    />
                  </div>

                  {/* Guardar */}
                  <Button
                    onClick={saveVoiceSettings}
                    disabled={!elevenLabsKey.trim() || voiceSaving}
                    size="sm"
                    className="w-full"
                  >
                    {voiceSaving ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {isEn ? 'Validating...' : 'Validando...'}</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" /> {isEn ? 'Save and activate premium voice' : 'Guardar y activar voz premium'}</>
                    )}
                  </Button>
                </>
              )}

              {/* Test result */}
              {voiceTestResult && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs space-y-1"
                >
                  <div className={`flex items-center gap-1 ${voiceTestResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                    {voiceTestResult.success ? <Check className="w-3 h-3" /> : '✕'}
                    {voiceTestResult.success
                      ? (isEn ? `✓ Audio played with ${voiceTestResult.engine}` : `✓ Audio reproducido con ${voiceTestResult.engine}`)
                      : `Error: ${voiceTestResult.error || (isEn ? 'Failed' : 'Fallo')}`}
                  </div>
                  {voiceTestResult.warning && (
                    <div className="text-amber-600 bg-amber-50 rounded px-2 py-1">
                      ⚠️ {voiceTestResult.warning}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Voces populares */}
          <div>
            <h3 className="text-sm font-semibold text-[#1A1A1A]/60 uppercase tracking-wider mb-3">
              {isEn ? 'Popular ElevenLabs Voices' : 'Voces populares de ElevenLabs'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Sarah', id: 'EXAVITQu4vr4xnSDxMaL', desc: isEn ? 'Female, warm and natural' : 'Femenina, cálida y natural', emoji: '👩' },
                { name: 'Charlie', id: 'IKne3meq5aSn9XLyUdCD', desc: isEn ? 'Male, professional' : 'Masculina, profesional', emoji: '👨' },
                { name: 'Laura', id: 'FGY2WhTYpPnrIDTdsKH5', desc: isEn ? 'Female, expressive' : 'Femenina, expresiva', emoji: '👩‍🎤' },
                { name: 'George', id: 'JBFqnCBsd6RMkjVDRZzb', desc: isEn ? 'Male, narrator' : 'Masculina, narrador', emoji: '🎭' },
              ].map(voice => (
                <button
                  key={voice.id}
                  onClick={() => setElevenLabsVoiceId(voice.id)}
                  disabled={hasElevenLabs}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all text-sm ${
                    elevenLabsVoiceId === voice.id
                      ? 'border-purple-400 bg-purple-400/5'
                      : hasElevenLabs
                        ? 'border-[#2D4A3E]/5 opacity-50 cursor-not-allowed'
                        : 'border-[#2D4A3E]/10 hover:border-[#2D4A3E]/30 hover:bg-[#F5F0E8]/50'
                  }`}
                >
                  <span className="text-lg">{voice.emoji}</span>
                  <div>
                    <span className="font-semibold text-[#1A1A1A]">{voice.name}</span>
                    <p className="text-[10px] text-[#1A1A1A]/40">{voice.desc}</p>
                  </div>
                  {elevenLabsVoiceId === voice.id && (
                    <Check className="w-4 h-4 text-purple-500 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-[#F5F0E8] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Mic className="w-5 h-5 text-[#2D4A3E] mt-0.5 shrink-0" />
              <div className="text-xs text-[#1A1A1A]/60 space-y-1">
                <p className="font-semibold text-[#1A1A1A]/80">{isEn ? 'How does OCTOPUS voice work?' : '¿Cómo funciona la voz de OCTOPUS?'}</p>
                <p><strong className="text-emerald-600">{isEn ? 'Google Translate (Free):' : 'Google Translate (Gratis):'}</strong> {isEn ? 'Default engine. Clear and functional voice for responses. No cost or configuration needed.' : 'Motor por defecto. Voz clara y funcional para respuestas en español. Sin costo ni configuración.'}</p>
                <p><strong className="text-purple-600">ElevenLabs (Premium):</strong> {isEn ? 'Ultra-realistic, emotional and human voice. Requires your own API key — you control your credits. OCTOPUS never uses other users\' credits.' : 'Voz ultra-realista, emocional y humana. Requiere tu propia API key — tú controlas tus créditos. OCTOPUS nunca usa los créditos de otros usuarios.'}</p>
                <p className="font-semibold text-[#C4622D]">{isEn ? 'If ElevenLabs fails, OCTOPUS automatically falls back to Google Translate.' : 'Si ElevenLabs falla, OCTOPUS vuelve automáticamente a Google Translate.'}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* FAL.AI VIDEO API CARD */}
      {/* ============================================ */}
      <Card variant="elevated" className="overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-[#7C3AED] to-[#4C1D95] text-white">
          <div className="flex items-center gap-4">
            <motion.div
              animate={hasFalKey ? { scale: [1, 1.15, 1] } : {}}
              transition={{ repeat: hasFalKey ? Infinity : 0, duration: 3 }}
              className="text-4xl"
            >
              🎬
            </motion.div>
            <div className="flex-1">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {isEn ? 'Video AI (fal.ai)' : 'Video IA (fal.ai)'}
                {hasFalKey && (
                  <span className="text-xs bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {isEn ? 'Connected' : 'Conectada'}
                  </span>
                )}
              </h2>
              <p className="text-white/60 text-sm">
                {isEn
                  ? 'Your own fal.ai API key — powers Motion Graphics, UGC Factory, and Creative Studio video generation'
                  : 'Tu propia API key de fal.ai — potencia Motion Graphics, UGC Factory, y generación de video en Creative Studio'}
              </p>
            </div>
            {hasFalKey && (
              <button
                onClick={testFalKey}
                disabled={falTesting}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                title={isEn ? 'Test connection' : 'Probar conexión'}
              >
                {falTesting ? <Loader2 className="w-5 h-5 animate-spin" /> : <TestTube className="w-5 h-5" />}
              </button>
            )}
          </div>

          {hasFalKey && (
            <div className="mt-4 flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2 text-sm">
              <Shield className="w-4 h-4 text-purple-300" />
              <span className="text-white/80">
                {isEn ? 'Active key:' : 'Key activa:'} <strong className="text-purple-300 font-mono">{falKeyPreview}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Success/Error messages */}
          {falSuccess && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm">
              <CheckCircle className="w-4 h-4" />
              {isEn ? 'fal.ai connected successfully!' : '¡fal.ai conectada exitosamente!'}
            </motion.div>
          )}
          {falError && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
              <AlertCircle className="w-4 h-4" />
              {falError}
            </motion.div>
          )}

          {/* Input field */}
          <div>
            <label className="text-sm font-medium text-[#1A1A1A]/70 mb-1.5 block">
              {isEn ? 'fal.ai API Key' : 'API Key de fal.ai'}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showFalKey ? 'text' : 'password'}
                  value={falKey}
                  onChange={(e) => setFalKey(e.target.value)}
                  placeholder={hasFalKey ? (isEn ? 'Paste new key to update...' : 'Pega nueva key para actualizar...') : (isEn ? 'Paste your fal.ai API key...' : 'Pega tu API key de fal.ai...')}
                  className="w-full px-4 py-3 rounded-xl border-2 border-[#2D4A3E]/20 focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 outline-none font-mono text-sm bg-white transition-colors"
                />
                <button
                  onClick={() => setShowFalKey(!showFalKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70"
                >
                  {showFalKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <Button
                onClick={saveFalKey}
                disabled={!falKey.trim() || falSaving}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-6 rounded-xl"
              >
                {falSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {isEn ? 'Save' : 'Guardar'}
              </Button>
            </div>
          </div>

          {/* How to get key */}
          <div className="bg-[#7C3AED]/5 border border-[#7C3AED]/20 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-[#7C3AED]">
              {isEn ? '🔑 How to get your fal.ai API key:' : '🔑 Cómo obtener tu API key de fal.ai:'}
            </p>
            <ol className="text-sm text-[#1A1A1A]/70 space-y-1 list-decimal list-inside">
              <li>{isEn ? 'Go to' : 'Ve a'} <a href="https://fal.ai/dashboard/keys" target="_blank" rel="noopener noreferrer" className="text-[#7C3AED] underline hover:text-[#6D28D9] inline-flex items-center gap-1">fal.ai/dashboard/keys <ExternalLink className="w-3 h-3" /></a></li>
              <li>{isEn ? 'Create an account or sign in' : 'Crea una cuenta o inicia sesión'}</li>
              <li>{isEn ? 'Click "Create Key" and copy it' : 'Haz clic en "Create Key" y cópiala'}</li>
              <li>{isEn ? 'Paste it above and click Save' : 'Pégala arriba y haz clic en Guardar'}</li>
            </ol>
            <p className="text-xs text-[#1A1A1A]/50 mt-2">
              {isEn
                ? '💡 fal.ai offers $10 free credits on signup. Video generation costs vary by model (Kling, Veo, Seedance, etc.).'
                : '💡 fal.ai ofrece $10 de créditos gratis al registrarte. El costo de generación de video varía según el modelo (Kling, Veo, Seedance, etc.).'}
            </p>
          </div>

          {/* Delete key */}
          {hasFalKey && (
            <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]/10">
              <span className="text-sm text-[#1A1A1A]/50">
                {isEn ? 'Remove fal.ai connection' : 'Eliminar conexión de fal.ai'}
              </span>
              <button
                onClick={deleteFalKey}
                disabled={falSaving}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                {falSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isEn ? 'Disconnect' : 'Desconectar'}
              </button>
            </div>
          )}

          {/* Modules that use fal.ai */}
          <div className="pt-2 border-t border-[#1A1A1A]/10">
            <p className="text-xs text-[#1A1A1A]/40 mb-2">{isEn ? 'Modules powered by your fal.ai key:' : 'Módulos que usan tu key de fal.ai:'}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { icon: '🎞️', label: 'Motion Graphics' },
                { icon: '📹', label: 'UGC Factory' },
                { icon: '🎨', label: 'Creative Studio' },
                { icon: '🤖', label: 'OCTOPUS (video)' },
              ].map(m => (
                <span key={m.label} className="inline-flex items-center gap-1 text-xs bg-[#7C3AED]/10 text-[#7C3AED] px-2.5 py-1 rounded-full">
                  {m.icon} {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* WATERMARK CARD */}
      <Card className="bg-white border border-[#2D4A3E]/10 shadow-lg overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={showWatermark ? { opacity: [0.4, 1, 0.4] } : {}}
                transition={{ repeat: showWatermark ? Infinity : 0, duration: 3 }}
              >
                <img src="/octopus-watermark.png" alt="Watermark" className="w-8 h-8" style={{ opacity: showWatermark ? 1 : 0.3 }} />
              </motion.div>
              <div>
                <h3 className="text-lg font-bold text-[#1A1A1A] flex items-center gap-2">
                  {isEn ? 'Watermark' : 'Marca de Agua'}
                  {showWatermark && (
                    <span className="text-[10px] bg-[#2D4A3E] text-white px-2 py-0.5 rounded-full font-medium">{isEn ? 'ACTIVE' : 'ACTIVA'}</span>
                  )}
                </h3>
                <p className="text-xs text-[#1A1A1A]/50">
                  {showWatermark
                    ? (isEn ? 'OCTOPUS logo appears on AI-generated images' : 'El logo de OCTOPUS aparece en imágenes generadas por IA')
                    : (isEn ? 'Images are generated without watermark' : 'Las imágenes se generan sin marca de agua')}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleWatermark(!showWatermark)}
              disabled={watermarkLoading || (userPlan === 'starter' && showWatermark)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                showWatermark
                  ? 'bg-[#2D4A3E]'
                  : 'bg-gray-300'
              } ${(userPlan === 'starter' && showWatermark) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <motion.div
                className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ x: showWatermark ? 32 : 4 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          {userPlan === 'starter' && showWatermark && (
            <div className="bg-[#F5F0E8] rounded-xl p-3 flex items-start gap-2">
              <Lock className="w-4 h-4 text-[#C4622D] mt-0.5 shrink-0" />
              <p className="text-xs text-[#1A1A1A]/60">
                <strong className="text-[#C4622D]">{isEn ? 'Starter Plan:' : 'Plan Starter:'}</strong> {isEn ? 'Watermark is enabled by default. Upgrade your plan to disable it.' : 'La marca de agua está activada por defecto. Upgrade tu plan para poder desactivarla.'}
              </p>
            </div>
          )}

          <div className="bg-[#F5F0E8] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#2D4A3E] mt-0.5 shrink-0" />
              <div className="text-xs text-[#1A1A1A]/60 space-y-1">
                <p className="font-semibold text-[#1A1A1A]/80">{isEn ? 'What is the watermark?' : '¿Qué es la marca de agua?'}</p>
                <p>{isEn ? 'When OCTOPUS generates images with AI, a small transparent logo appears in the corner of the image.' : 'Cuando OCTOPUS genera imágenes con IA, un pequeño logo transparente aparece en la esquina de la imagen.'}</p>
                <p>{isEn ? 'It\'s subtle and doesn\'t interfere with the visual content.' : 'Es sutil y no interfiere con el contenido visual.'}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ============================================ */}
      {/* DATA EXPORT */}
      {/* ============================================ */}
      <DataExportCard />
    </div>
  )
}