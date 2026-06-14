'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Link2,
  ArrowLeft,
  Plus,
  Search,
  Check,
  X,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  ExternalLink,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  Copy,
  BookOpen,
  CreditCard,
  Filter
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useMetrics } from '@/lib/metrics-context'
import { useI18n } from '@/lib/i18n-context'
import { usePlanGate } from '@/hooks/use-plan-gate'
import { UpgradeModal } from '@/components/upgrade-modal'
import {
  API_SERVICE_CONFIGS,
  ApiServiceType,
  ApiKeyStatus,
  getServicesByCategory,
  getLocalizedService,
  getLocalizedCategories,
  type ApiServiceConfig
} from '@/lib/api-hub-types'

interface StoredApiKey {
  id: string
  serviceType: string
  name: string
  apiKey: string
  baseUrl?: string
  status: ApiKeyStatus
  lastTested?: string
  lastUsed?: string
  usageCount: number
  createdAt: string
}

const statusIcons: Record<ApiKeyStatus, React.ReactNode> = {
  active: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  inactive: <Clock className="w-4 h-4 text-gray-400" />,
  error: <AlertCircle className="w-4 h-4 text-red-500" />,
  testing: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
}

export default function ApiHubPage() {
  const [apiKeys, setApiKeys] = useState<StoredApiKey[]>([])
  const { t, locale } = useI18n()

  const statusLabels: Record<ApiKeyStatus, string> = {
    active: t('api.status.active'),
    inactive: t('api.status.untested'),
    error: t('api.status.error'),
    testing: t('api.status.testing')
  }

  const localizedCategories = getLocalizedCategories(locale)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedService, setSelectedService] = useState<ApiServiceConfig | null>(null)
  const [newApiKey, setNewApiKey] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customName, setCustomName] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency?: number } | null>(null)
  
  const { addActivity, updateMetrics } = useMetrics()
  const { upgradeModal, closeUpgradeModal, handlePlanError } = usePlanGate()

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    try {
      const response = await fetch('/api/api-hub')
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data)
        updateMetrics({ apiConnections: data.filter((k: StoredApiKey) => k.status === 'active').length })
      }
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setLoading(false)
    }
  }, [updateMetrics])

  useEffect(() => {
    fetchApiKeys()
  }, [fetchApiKeys])

  // Filter services (search on both localized and original text)
  const filteredServices = getServicesByCategory(selectedCategory).map(s => getLocalizedService(s, locale)).filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Check if service has a stored key
  const getStoredKey = (serviceType: string): StoredApiKey | undefined => {
    return apiKeys.find(k => k.serviceType === serviceType)
  }

  // Open modal for service
  const openServiceModal = (service: ApiServiceConfig) => {
    setSelectedService(service)
    setNewApiKey('')
    setCustomBaseUrl(service.baseUrl)
    setCustomName(service.name)
    setShowApiKey(false)
    setTestResult(null)
    setShowModal(true)
  }

  // Save API key
  const saveApiKey = async () => {
    if (!selectedService || !newApiKey.trim()) return
    
    setSaving(true)
    try {
      const response = await fetch('/api/api-hub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: selectedService.type,
          name: customName || selectedService.name,
          apiKey: newApiKey.trim(),
          baseUrl: (selectedService.type === 'custom' || selectedService.type === 'content_publisher') ? customBaseUrl : undefined
        })
      })

      if (response.ok) {
        addActivity(`🔑 ${selectedService.name} — ${t('api.activity.saved')}`)
        await fetchApiKeys()
        setShowModal(false)
      } else if (await handlePlanError(response.clone(), 'api_keys')) {
        // Plan limit — modal shown
      } else {
        const error = await response.json()
        setTestResult({ success: false, message: error.error || (locale === 'en' ? 'Error saving' : 'Error al guardar') })
      }
    } catch (error) {
      setTestResult({ success: false, message: locale === 'en' ? 'Connection error' : 'Error de conexión' })
    } finally {
      setSaving(false)
    }
  }

  // Test API key
  const testApiKey = async (keyId?: string) => {
    if (!selectedService && !keyId) return
    
    const idToTest = keyId || undefined
    setTesting(idToTest || 'new')
    setTestResult(null)

    try {
      const response = await fetch('/api/api-hub/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idToTest ? {
          id: idToTest
        } : {
          serviceType: selectedService?.type,
          apiKey: newApiKey.trim(),
          baseUrl: (selectedService?.type === 'custom' || selectedService?.type === 'content_publisher') ? customBaseUrl : undefined
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setTestResult({
          success: true,
          message: result.message || (locale === 'en' ? 'Connection successful' : 'Conexión exitosa'),
          latency: result.latency
        })
        addActivity(`✅ ${selectedService?.name || 'Service'} — ${t('api.activity.testOk')} (${result.latency}ms)`)
        if (idToTest) {
          await fetchApiKeys()
        }
      } else {
        setTestResult({
          success: false,
          message: result.error || (locale === 'en' ? 'Connection error' : 'Error de conexión')
        })
        addActivity(`❌ ${selectedService?.name || 'Service'} — ${t('api.activity.testFailed')}`)
      }
    } catch (error) {
      setTestResult({ success: false, message: locale === 'en' ? 'Connection error' : 'Error de conexión' })
    } finally {
      setTesting(null)
    }
  }

  // Delete API key
  const deleteApiKey = async (id: string, serviceName: string) => {
    if (!confirm(`${t('api.confirmDelete')} ${serviceName}?`)) return

    try {
      const response = await fetch(`/api/api-hub?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        addActivity(`🗑️ ${serviceName} — ${t('api.activity.disconnected')}`)
        await fetchApiKeys()
      }
    } catch (error) {
      console.error('Error deleting API key:', error)
    }
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    addActivity(`📋 ${locale === 'en' ? 'Copied to clipboard' : 'Copiado al portapapeles'}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('common.back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#1A1A1A] flex items-center gap-2">
              <Link2 className="w-7 h-7 text-[#2D4A3E]" />
              {t('api.title')}
            </h1>
            <p className="text-sm text-[#1A1A1A]/60">{t('api.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-[#1A1A1A]/60">
            <span className="font-medium text-[#2D4A3E]">{apiKeys.filter(k => k.status === 'active').length}</span> {t('api.active')}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A1A1A]/40" />
            <input
              type="text"
              placeholder={t('api.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#F5F0E6] border border-[#2D4A3E]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
            {localizedCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-[#2D4A3E] text-white'
                    : 'bg-[#F5F0E6] text-[#1A1A1A]/70 hover:bg-[#2D4A3E]/10'
                }`}
              >
                <span className="mr-2">{cat.icon}</span>
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Connected APIs */}
      {apiKeys.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#1A1A1A] flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#C4622D]" />
            {t('api.connectedApis')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiKeys.map((key) => {
              const config = API_SERVICE_CONFIGS[key.serviceType as ApiServiceType]
              return (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${config?.color}20` }}
                        >
                          {config?.icon || '⚙️'}
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#1A1A1A]">{key.name}</h3>
                          <div className="flex items-center gap-1 text-xs">
                            {statusIcons[key.status]}
                            <span className="text-[#1A1A1A]/60">{statusLabels[key.status]}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => testApiKey(key.id)}
                          disabled={testing === key.id}
                          className="p-2 hover:bg-[#F5F0E6] rounded-lg transition-colors"
                          title={t('api.testConnection')}
                        >
                          {testing === key.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#2D4A3E]" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-[#1A1A1A]/60" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteApiKey(key.id, key.name)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('api.delete')}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    <div className="text-sm text-[#1A1A1A]/60 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-[#F5F0E6] px-2 py-0.5 rounded">{key.apiKey}</span>
                        <button
                          onClick={() => copyToClipboard(key.apiKey)}
                          className="p-1 hover:bg-[#F5F0E6] rounded"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      {key.lastTested && (
                        <p className="text-xs">
                          {t('api.lastTest')}: {new Date(key.lastTested).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* Available Services */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1A1A1A] flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#2D4A3E]" />
          {t('api.availableServices')}
        </h2>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#2D4A3E]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((service) => {
              const storedKey = getStoredKey(service.type)
              const isConnected = storedKey?.status === 'active'
              
              return (
                <motion.div
                  key={service.type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card 
                    className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                      isConnected ? 'ring-2 ring-emerald-500/30' : ''
                    }`}
                    onClick={() => openServiceModal(service)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                        style={{ backgroundColor: `${service.color}15` }}
                      >
                        {service.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-[#1A1A1A] truncate">{service.name}</h3>
                          {isConnected && (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-[#1A1A1A]/70 line-clamp-2">
                          {service.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {service.features.slice(0, 2).map((feature, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 bg-[#F5F0E6] text-[#1A1A1A]/70 rounded-full"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#2D4A3E]/10">
                      <div className="flex gap-2">
                        {service.docsUrl && (
                          <a
                            href={service.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#2D4A3E] hover:underline flex items-center gap-1"
                          >
                            <BookOpen className="w-3 h-3" /> {t('api.docs')}
                          </a>
                        )}
                        {service.pricingUrl && (
                          <a
                            href={service.pricingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-[#A14420] hover:underline flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3" /> {t('api.pricing')}
                          </a>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant={storedKey ? 'secondary' : 'primary'}
                        onClick={(e) => {
                          e.stopPropagation()
                          openServiceModal(service)
                        }}
                      >
                        {storedKey ? t('api.edit') : t('api.connect')}
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}

        {filteredServices.length === 0 && !loading && (
          <Card className="p-12 text-center">
            <Filter className="w-12 h-12 mx-auto text-[#1A1A1A]/20 mb-4" />
            <p className="text-[#1A1A1A]/60">{t('api.noServicesFound')}</p>
          </Card>
        )}
      </div>

      {/* Connection Modal */}
      <AnimatePresence>
        {showModal && selectedService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-[#2D4A3E]/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: `${selectedService.color}15` }}
                  >
                    {selectedService.icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1A1A]">
                      {getStoredKey(selectedService.type) ? t('api.edit') : t('api.connect')} {selectedService.name}
                    </h2>
                    <p className="text-sm text-[#1A1A1A]/60">{selectedService.description}</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Features */}
                <div className="flex flex-wrap gap-2">
                  {selectedService.features.map((feature, i) => (
                    <span
                      key={i}
                      className="text-sm px-3 py-1 rounded-full"
                      style={{ backgroundColor: `${selectedService.color}15`, color: selectedService.color }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                {/* Custom Name (for custom type) */}
                {selectedService.type === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                      {t('api.serviceName')}
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={t('api.serviceNamePlaceholder')}
                      className="w-full px-4 py-2 border border-[#2D4A3E]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20"
                    />
                  </div>
                )}

                {/* Base URL (for custom + content_publisher) */}
                {(selectedService.type === 'custom' || selectedService.type === 'content_publisher') && (
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                      {selectedService.type === 'content_publisher' ? t('api.endpointUrl') : t('api.baseUrl')}
                      {selectedService.type === 'content_publisher' && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    <input
                      type="url"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      placeholder={selectedService.type === 'content_publisher'
                        ? 'https://your-api.com/functions/v1/publish'
                        : 'https://api.example.com/v1'}
                      className="w-full px-4 py-2 border border-[#2D4A3E]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20"
                    />
                    {selectedService.type === 'content_publisher' && (
                      <p className="text-xs text-[#1A1A1A]/50 mt-1">
                        {t('api.publisherHelp')}
                      </p>
                    )}
                  </div>
                )}

                {/* API Key Input */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1A1A] mb-1">
                    {selectedService.type === 'content_publisher' ? 'API Key (Bearer Token)' : 'API Key'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={newApiKey}
                      onChange={(e) => setNewApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-4 py-2 pr-20 border border-[#2D4A3E]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D4A3E]/20 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-[#F5F0E6] rounded"
                    >
                      {showApiKey ? (
                        <EyeOff className="w-4 h-4 text-[#1A1A1A]/60" />
                      ) : (
                        <Eye className="w-4 h-4 text-[#1A1A1A]/60" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[#1A1A1A]/50 mt-1">
                    {t('api.apiKeySecure')}
                  </p>
                </div>

                {/* Test Result */}
                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg flex items-center gap-2 ${
                      testResult.success
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm">
                      {testResult.message}
                      {testResult.latency && ` (${testResult.latency}ms)`}
                    </span>
                  </motion.div>
                )}

                {/* Available Models */}
                {selectedService.models && selectedService.models.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A1A] mb-2">
                      {t('api.availableModels')}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {selectedService.models.map((model, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-[#F5F0E6] text-[#1A1A1A]/70 rounded font-mono"
                        >
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Links */}
                <div className="flex gap-4 pt-2">
                  {selectedService.docsUrl && (
                    <a
                      href={selectedService.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#2D4A3E] hover:underline flex items-center gap-1"
                    >
                      <BookOpen className="w-4 h-4" /> {t('api.documentation')}
                    </a>
                  )}
                  {selectedService.pricingUrl && (
                    <a
                      href={selectedService.pricingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#C4622D] hover:underline flex items-center gap-1"
                    >
                      <CreditCard className="w-4 h-4" /> {t('api.viewPricing')}
                    </a>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-[#2D4A3E]/10 flex justify-between gap-3">
                <Button
                  variant="secondary"
                  onClick={() => testApiKey()}
                  disabled={!newApiKey.trim() || testing === 'new'}
                >
                  {testing === 'new' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {t('api.testBtn')}
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setShowModal(false)}>
                    {t('api.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={saveApiKey}
                    disabled={!newApiKey.trim() || saving || (selectedService.type === 'content_publisher' && !customBaseUrl.trim())}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    {t('api.save')}
                  </Button>
                </div>
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