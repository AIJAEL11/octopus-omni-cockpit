'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Plus, Search, Filter, Send, Eye, CheckCircle2, Clock, Trash2,
  Download, X, Loader2, DollarSign, Receipt, ChevronDown, Copy, Check,
  Mail, Building2, Phone, MapPin, User, Percent, AlertCircle
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'

interface InvoiceItem { id?: string; description: string; quantity: number; unitPrice: number; total: number }
interface Invoice {
  id: string; invoiceNumber: string; type: string; status: string
  clientName: string; clientEmail?: string | null; clientPhone?: string | null
  clientCompany?: string | null; clientAddress?: string | null
  leadId?: string | null; leadSource?: string | null
  subtotal: number; taxRate: number; taxAmount: number; discount: number
  total: number; currency: string; issueDate: string; dueDate?: string | null
  paidAt?: string | null; viewedAt?: string | null; sentAt?: string | null
  notes?: string | null; terms?: string | null; brandColor: string
  items: InvoiceItem[]; createdAt: string
}

const STATUS_CONFIG_DEF: Record<string, { en: string; es: string; icon: any; color: string; bg: string }> = {
  draft: { en: 'Draft', es: 'Borrador', icon: FileText, color: '#888', bg: '#88888815' },
  sent: { en: 'Sent', es: 'Enviada', icon: Send, color: '#0EA5E9', bg: '#0EA5E915' },
  viewed: { en: 'Viewed', es: 'Vista', icon: Eye, color: '#f59e0b', bg: '#f59e0b15' },
  paid: { en: 'Paid', es: 'Pagada', icon: CheckCircle2, color: '#22c55e', bg: '#22c55e15' },
  cancelled: { en: 'Cancelled', es: 'Cancelada', icon: AlertCircle, color: '#ef4444', bg: '#ef444415' },
}
function buildStatusConfig(isEn: boolean) {
  const r: Record<string, { label: string; icon: any; color: string; bg: string }> = {}
  for (const [k, v] of Object.entries(STATUS_CONFIG_DEF)) r[k] = { label: isEn ? v.en : v.es, icon: v.icon, color: v.color, bg: v.bg }
  return r
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const STATUS_CONFIG = buildStatusConfig(isEn)

  useEffect(() => { setMounted(true) }, [])

  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterType) params.set('type', filterType)
      const r = await fetch(`/api/invoices?${params}`)
      if (r.ok) { const d = await r.json(); setInvoices(d.invoices || []) }
    } catch {} finally { setLoading(false) }
  }, [filterStatus, filterType])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const filtered = invoices.filter(inv =>
    !search || inv.clientName.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoiceNumber.toLowerCase().includes(search.toLowerCase())
  )

  /* Stats */
  const totalPending = invoices.filter(i => ['sent', 'viewed'].includes(i.status)).reduce((s, i) => s + i.total, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalDraft = invoices.filter(i => i.status === 'draft').length

  /* Download PDF */
  const handleDownload = async (inv: Invoice) => {
    setDownloadingId(inv.id)
    try {
      const r = await fetch('/api/invoices/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id })
      })
      if (r.ok) {
        const blob = await r.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${inv.invoiceNumber}.pdf`; a.click()
        URL.revokeObjectURL(url)
      }
    } catch {} finally { setDownloadingId(null) }
  }

  /* Send email */
  const handleSend = async (inv: Invoice) => {
    if (!inv.clientEmail) return alert(isEn ? 'Client has no email' : 'El cliente no tiene email')
    setSendingId(inv.id)
    try {
      const r = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: inv.id })
      })
      if (r.ok) {
        fetchInvoices()
        alert(isEn ? 'Sent successfully ✅' : 'Enviada exitosamente ✅')
      }
    } catch {} finally { setSendingId(null) }
  }

  /* Mark paid */
  const markPaid = async (id: string) => {
    await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid' })
    })
    fetchInvoices()
    setSelectedInvoice(null)
  }

  /* Delete */
  const handleDelete = async (id: string) => {
    if (!confirm(isEn ? 'Delete this invoice?' : '¿Eliminar esta factura?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    setInvoices(inv => inv.filter(i => i.id !== id))
    setSelectedInvoice(null)
  }

  const cs = (c: string) => c === 'USD' ? '$' : c === 'EUR' ? '\u20ac' : c

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#F5F0E8] dark:bg-[#1A1A1A] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4622D] to-[#FFD700] flex items-center justify-center">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            {isEn ? 'Quick Invoice' : 'Facturación Express'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isEn ? 'Professional invoices & quotes in seconds' : 'Facturas y cotizaciones profesionales en segundos'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)}
            className="bg-gradient-to-r from-[#C4622D] to-[#2D4A3E] text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> {isEn ? 'New Invoice' : 'Nueva Factura'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <div className="text-xs text-gray-400">{isEn ? 'Pending' : 'Pendientes'}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-[#F5F0E8]">${totalPending.toFixed(2)}</div>
            </div>
          </div>
        </Card>
        <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-gray-400">{isEn ? 'Collected' : 'Cobrado'}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-[#F5F0E8]">${totalPaid.toFixed(2)}</div>
            </div>
          </div>
        </Card>
        <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FileText className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <div className="text-xs text-gray-400">{isEn ? 'Drafts' : 'Borradores'}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-[#F5F0E8]">{totalDraft}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={isEn ? 'Search by client or number...' : 'Buscar por cliente o número...'} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
          </div>
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setLoading(true) }}
            className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
            <option value="">{isEn ? 'All statuses' : 'Todos los estados'}</option>
            <option value="draft">{isEn ? 'Draft' : 'Borrador'}</option>
            <option value="sent">{isEn ? 'Sent' : 'Enviada'}</option>
            <option value="viewed">{isEn ? 'Viewed' : 'Vista'}</option>
            <option value="paid">{isEn ? 'Paid' : 'Pagada'}</option>
          </select>
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setLoading(true) }}
            className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
            <option value="">{isEn ? 'Invoices & Quotes' : 'Facturas y Cotizaciones'}</option>
            <option value="invoice">{isEn ? 'Invoices only' : 'Solo Facturas'}</option>
            <option value="quote">{isEn ? 'Quotes only' : 'Solo Cotizaciones'}</option>
          </select>
        </div>
      </Card>

      {/* Invoice list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" /></div>
      ) : filtered.length === 0 ? (
        <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-12 text-center">
          <Receipt className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">{isEn ? 'No invoices yet' : 'No hay facturas aún'}</h3>
          <p className="text-sm text-gray-400 mt-1">{isEn ? 'Create your first invoice or quote' : 'Crea tu primera factura o cotización'}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => {
            const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft
            const SIcon = st.icon
            const isQuote = inv.type === 'quote'
            return (
              <motion.div key={inv.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4 hover:shadow-xl transition cursor-pointer"
                  onClick={() => setSelectedInvoice(inv)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: isQuote ? '#8B5CF620' : '#C4622D20' }}>
                      {isQuote ? <FileText className="w-5 h-5 text-[#8B5CF6]" /> : <Receipt className="w-5 h-5 text-[#C4622D]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-[#F5F0E8] text-sm">{inv.invoiceNumber}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
                          <SIcon className="w-3 h-3 inline mr-1" />{st.label}
                        </span>
                        {isQuote && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600">{isEn ? 'Quote' : 'Cotización'}</span>}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{inv.clientName}{inv.clientCompany ? ` · ${inv.clientCompany}` : ''}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-lg font-bold text-gray-900 dark:text-[#F5F0E8]">{cs(inv.currency)}{inv.total.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">{new Date(inv.issueDate).toLocaleDateString(isEn ? 'en' : 'es')}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); handleDownload(inv) }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition" title={isEn ? 'Download PDF' : 'Descargar PDF'}>
                        {downloadingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" /> : <Download className="w-4 h-4 text-gray-400" />}
                      </button>
                      {inv.clientEmail && inv.status === 'draft' && (
                        <button onClick={e => { e.stopPropagation(); handleSend(inv) }}
                          className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title={isEn ? 'Send by email' : 'Enviar por email'}>
                          {sendingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <Send className="w-4 h-4 text-blue-400" />}
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchInvoices() }} />}
      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedInvoice && (
          <InvoiceDetailModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)}
            onDelete={handleDelete} onMarkPaid={markPaid} onSend={handleSend} onDownload={handleDownload}
            sendingId={sendingId} downloadingId={downloadingId} />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ====================================== */
/*        CREATE INVOICE MODAL            */
/* ====================================== */
function CreateInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const [type, setType] = useState<'invoice' | 'quote'>('invoice')
  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '', clientCompany: '', clientAddress: '',
    currency: 'USD', taxRate: 0, discount: 0, notes: '', terms: '',
    dueDate: '', leadId: '', leadSource: ''
  })
  const [items, setItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([
    { description: '', quantity: 1, unitPrice: 0 }
  ])
  const [saving, setSaving] = useState(false)
  const [leads, setLeads] = useState<any[]>([])
  const [showLeadPicker, setShowLeadPicker] = useState(false)

  // Fetch leads for quick fill
  useEffect(() => {
    Promise.all([
      fetch('/api/growth').then(r => r.ok ? r.json() : { leads: [] }).catch(() => ({ leads: [] })),
      fetch('/api/sales-agent/capture-lead').then(r => r.ok ? r.json() : { leads: [] }).catch(() => ({ leads: [] }))
    ]).then(([g, s]) => {
      const growthLeads = (g.leads || []).map((l: any) => ({ ...l, _source: 'growth' }))
      const agentLeads = (s.leads || []).map((l: any) => ({ ...l, _source: 'sales_agent' }))
      setLeads([...growthLeads, ...agentLeads])
    })
  }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const updateItem = (idx: number, field: string, val: any) => {
    setItems(items => items.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }
  const addItem = () => setItems(items => [...items, { description: '', quantity: 1, unitPrice: 0 }])
  const removeItem = (idx: number) => setItems(items => items.filter((_, i) => i !== idx))

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const taxAmount = (subtotal - form.discount) * (form.taxRate / 100)
  const total = subtotal - form.discount + taxAmount

  const fillFromLead = (lead: any) => {
    setForm(f => ({
      ...f,
      clientName: lead.contactName || lead.name || lead.visitorName || '',
      clientEmail: lead.email || lead.visitorEmail || '',
      clientPhone: lead.phone || lead.visitorPhone || '',
      clientCompany: lead.company || lead.companyName || '',
      leadId: lead.id,
      leadSource: lead._source
    }))
    setShowLeadPicker(false)
  }

  const handleSave = async () => {
    if (!form.clientName.trim() || items.length === 0) return
    setSaving(true)
    try {
      await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type, items })
      })
      onCreated()
    } catch {} finally { setSaving(false) }
  }

  const cs = form.currency === 'USD' ? '$' : form.currency === 'EUR' ? '\u20ac' : form.currency

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#232323] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#F5F0E8]">{isEn ? `New ${type === 'quote' ? 'Quote' : 'Invoice'}` : `Nueva ${type === 'quote' ? 'Cotización' : 'Factura'}`}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          {/* Type toggle */}
          <div className="flex gap-2 mb-5">
            {(['invoice', 'quote'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                  type === t ? 'bg-[#C4622D] text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                }`}>
                {t === 'invoice' ? (isEn ? '💰 Invoice' : '💰 Factura') : (isEn ? '📋 Quote' : '📋 Cotización')}
              </button>
            ))}
          </div>

          {/* Lead picker */}
          {leads.length > 0 && (
            <div className="mb-4">
              <button onClick={() => setShowLeadPicker(!showLeadPicker)}
                className="text-sm text-[#C4622D] hover:underline flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> {isEn ? 'Import data from a lead' : 'Importar datos de un lead'}
              </button>
              {showLeadPicker && (
                <div className="mt-2 max-h-40 overflow-y-auto bg-gray-50 dark:bg-[#1A1A1A] rounded-xl p-2 space-y-1">
                  {leads.slice(0, 20).map((lead: any) => (
                    <button key={lead.id} onClick={() => fillFromLead(lead)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm transition">
                      <span className="font-medium text-gray-800 dark:text-gray-200">{lead.contactName || lead.name || lead.visitorName || (isEn ? 'No name' : 'Sin nombre')}</span>
                      <span className="text-gray-400 ml-2">{lead.email || lead.visitorEmail || ''}</span>
                      <span className="text-xs ml-2 text-[#C4622D]">{lead._source === 'growth' ? 'Growth' : 'Agent'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Client info */}
          <div className="space-y-3 mb-5">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.clientName} onChange={e => set('clientName', e.target.value)}
                placeholder={isEn ? 'Client name *' : 'Nombre del cliente *'} className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
              <input value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)}
                placeholder="Email" type="email" className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.clientCompany} onChange={e => set('clientCompany', e.target.value)}
                placeholder={isEn ? 'Company' : 'Empresa'} className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
              <input value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)}
                placeholder={isEn ? 'Phone' : 'Teléfono'} className="px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
            </div>
          </div>

          {/* Items */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{isEn ? 'Line Items' : 'Conceptos'}</h3>
              <button onClick={addItem} className="text-xs text-[#C4622D] hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> {isEn ? 'Add' : 'Añadir'}</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder={isEn ? 'Description' : 'Descripción'} className="flex-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
                  <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', +e.target.value)}
                    className="w-16 px-2 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none text-center" min={1} />
                  <input type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', +e.target.value)}
                    placeholder={isEn ? 'Price' : 'Precio'} className="w-24 px-2 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none text-right" min={0} step={0.01} />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-20 text-right">{cs}{(item.quantity * item.unitPrice).toFixed(2)}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tax, discount, currency */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{isEn ? 'Currency' : 'Moneda'}</label>
              <select value={form.currency} onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (\u20ac)</option>
                <option value="MXN">MXN ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{isEn ? 'Tax (%)' : 'Impuesto (%)'}</label>
              <input type="number" value={form.taxRate} onChange={e => set('taxRate', +e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" min={0} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">{isEn ? 'Discount' : 'Descuento'} ({cs})</label>
              <input type="number" value={form.discount} onChange={e => set('discount', +e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" min={0} step={0.01} />
            </div>
          </div>

          {/* Due date */}
          <div className="mb-5">
            <label className="text-xs text-gray-400 mb-1 block">{isEn ? 'Due date (optional)' : 'Fecha vencimiento (opcional)'}</label>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
          </div>

          {/* Notes */}
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder={isEn ? 'Notes (visible to client)' : 'Notas (visible para el cliente)'} rows={2}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none resize-none mb-3" />
          <textarea value={form.terms} onChange={e => set('terms', e.target.value)}
            placeholder={isEn ? 'Terms and conditions' : 'Términos y condiciones'} rows={2}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none resize-none mb-5" />

          {/* Totals preview */}
          <div className="bg-gray-50 dark:bg-[#1A1A1A] rounded-xl p-4 mb-5">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1">
              <span>Subtotal</span><span>{cs}{subtotal.toFixed(2)}</span>
            </div>
            {form.discount > 0 && <div className="flex justify-between text-sm text-red-500 mb-1"><span>{isEn ? 'Discount' : 'Descuento'}</span><span>-{cs}{form.discount.toFixed(2)}</span></div>}
            {form.taxRate > 0 && <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-1"><span>{isEn ? 'Tax' : 'Impuesto'} ({form.taxRate}%)</span><span>{cs}{taxAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-[#C4622D] border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
              <span>Total</span><span>{cs}{total.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="dark:border-gray-700 dark:text-gray-300">{isEn ? 'Cancel' : 'Cancelar'}</Button>
            <Button onClick={handleSave} disabled={saving || !form.clientName.trim() || items.length === 0}
              className="bg-gradient-to-r from-[#C4622D] to-[#2D4A3E] text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {isEn ? `Create ${type === 'quote' ? 'Quote' : 'Invoice'}` : `Crear ${type === 'quote' ? 'Cotización' : 'Factura'}`}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ====================================== */
/*       INVOICE DETAIL MODAL             */
/* ====================================== */
function InvoiceDetailModal({ invoice, onClose, onDelete, onMarkPaid, onSend, onDownload, sendingId, downloadingId }: {
  invoice: Invoice; onClose: () => void; onDelete: (id: string) => void
  onMarkPaid: (id: string) => void; onSend: (inv: Invoice) => void; onDownload: (inv: Invoice) => void
  sendingId: string | null; downloadingId: string | null
}) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const STATUS_CONFIG = buildStatusConfig(isEn)
  const st = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft
  const SIcon = st.icon
  const isQuote = invoice.type === 'quote'
  const cs = invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '\u20ac' : invoice.currency

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#232323] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="h-2 rounded-t-2xl" style={{ backgroundColor: invoice.brandColor }} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-[#F5F0E8]">{invoice.invoiceNumber}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
                  <SIcon className="w-3 h-3 inline mr-1" />{st.label}
                </span>
                {isQuote && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600">{isEn ? 'Quote' : 'Cotización'}</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          {/* Client */}
          <div className="bg-gray-50 dark:bg-[#1A1A1A] rounded-xl p-4 mb-4">
            <div className="font-semibold text-gray-800 dark:text-gray-200">{invoice.clientName}</div>
            {invoice.clientCompany && <div className="text-sm text-gray-500">{invoice.clientCompany}</div>}
            {invoice.clientEmail && <div className="text-sm text-gray-500">{invoice.clientEmail}</div>}
            {invoice.clientPhone && <div className="text-sm text-gray-500">{invoice.clientPhone}</div>}
          </div>

          {/* Items */}
          <div className="mb-4">
            {invoice.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50 text-sm">
                <div className="flex-1">
                  <div className="text-gray-800 dark:text-gray-200">{item.description}</div>
                  <div className="text-xs text-gray-400">{item.quantity} x {cs}{item.unitPrice.toFixed(2)}</div>
                </div>
                <div className="font-semibold text-gray-900 dark:text-[#F5F0E8]">{cs}{item.total.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-gray-50 dark:bg-[#1A1A1A] rounded-xl p-4 mb-4">
            <div className="flex justify-between text-sm text-gray-500 mb-1"><span>Subtotal</span><span>{cs}{invoice.subtotal.toFixed(2)}</span></div>
            {invoice.discount > 0 && <div className="flex justify-between text-sm text-red-500 mb-1"><span>{isEn ? 'Discount' : 'Descuento'}</span><span>-{cs}{invoice.discount.toFixed(2)}</span></div>}
            {invoice.taxRate > 0 && <div className="flex justify-between text-sm text-gray-500 mb-1"><span>{isEn ? 'Tax' : 'Impuesto'} ({invoice.taxRate}%)</span><span>{cs}{invoice.taxAmount.toFixed(2)}</span></div>}
            <div className="flex justify-between text-xl font-bold pt-2 mt-2 border-t" style={{ borderColor: invoice.brandColor, color: invoice.brandColor }}>
              <span>TOTAL</span><span>{cs}{invoice.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-4">
            <span>{isEn ? 'Issued' : 'Emitida'}: {new Date(invoice.issueDate).toLocaleDateString(isEn ? 'en' : 'es')}</span>
            {invoice.dueDate && <span>{isEn ? 'Due' : 'Vence'}: {new Date(invoice.dueDate).toLocaleDateString(isEn ? 'en' : 'es')}</span>}
            {invoice.sentAt && <span>{isEn ? 'Sent' : 'Enviada'}: {new Date(invoice.sentAt).toLocaleDateString(isEn ? 'en' : 'es')}</span>}
            {invoice.viewedAt && <span>{isEn ? 'Viewed' : 'Vista'}: {new Date(invoice.viewedAt).toLocaleDateString(isEn ? 'en' : 'es')}</span>}
            {invoice.paidAt && <span>{isEn ? 'Paid' : 'Pagada'}: {new Date(invoice.paidAt).toLocaleDateString(isEn ? 'en' : 'es')}</span>}
          </div>

          {invoice.notes && <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1A1A1A] p-3 rounded-xl mb-2">{invoice.notes}</p>}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Button onClick={() => onDownload(invoice)} variant="outline" className="dark:border-gray-700 dark:text-gray-300">
              {downloadingId === invoice.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />} PDF
            </Button>
            {invoice.clientEmail && invoice.status === 'draft' && (
              <Button onClick={() => onSend(invoice)} className="bg-blue-500 text-white hover:bg-blue-600">
                {sendingId === invoice.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />} {isEn ? 'Send' : 'Enviar'}
              </Button>
            )}
            {['sent', 'viewed'].includes(invoice.status) && (
              <Button onClick={() => onMarkPaid(invoice.id)} className="bg-green-500 text-white hover:bg-green-600">
                <CheckCircle2 className="w-4 h-4 mr-1" /> {isEn ? 'Mark Paid' : 'Marcar Pagada'}
              </Button>
            )}
            <Button variant="outline" onClick={() => onDelete(invoice.id)}
              className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 ml-auto">
              <Trash2 className="w-4 h-4 mr-1" /> {isEn ? 'Delete' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
