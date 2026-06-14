'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { FileText, Clock, CheckCircle2, Eye, Send, Loader2, Download } from 'lucide-react'

interface InvoiceData {
  id: string; invoiceNumber: string; type: string; status: string
  clientName: string; clientEmail?: string; clientPhone?: string
  clientCompany?: string; clientAddress?: string
  subtotal: number; taxRate: number; taxAmount: number; discount: number
  total: number; currency: string; issueDate: string; dueDate?: string
  notes?: string; terms?: string; brandColor: string
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[]
  user?: { name: string; email: string }
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
  draft: { label: 'Borrador', icon: FileText, color: '#888' },
  sent: { label: 'Enviada', icon: Send, color: '#0EA5E9' },
  viewed: { label: 'Vista', icon: Eye, color: '#f59e0b' },
  paid: { label: 'Pagada', icon: CheckCircle2, color: '#22c55e' },
  cancelled: { label: 'Cancelada', icon: Clock, color: '#ef4444' },
}

export default function InvoiceViewPage() {
  const params = useParams()
  const id = params?.id as string
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/invoices/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => setInvoice(d.invoice))
      .catch(() => setError('No se pudo cargar la factura'))
      .finally(() => setLoading(false))
  }, [id])

  if (!mounted) return null

  if (loading) return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
    </div>
  )

  if (error || !invoice) return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
      <div className="text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-700">{error || 'No encontrada'}</h1>
      </div>
    </div>
  )

  const isQuote = invoice.type === 'quote'
  const title = isQuote ? 'COTIZACIÓN' : 'FACTURA'
  const color = invoice.brandColor || '#C4622D'
  const cs = invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '€' : invoice.currency
  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.draft
  const SIcon = statusInfo.icon
  const issueDate = new Date(invoice.issueDate).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' })
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' }) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#e8e0d0] py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        
        {/* Color header */}
        <div className="h-3" style={{ backgroundColor: color }} />

        <div className="p-6 md:p-10">
          {/* Top row */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold" style={{ color }}>{title}</h1>
              <p className="text-gray-400 text-sm mt-1">{invoice.invoiceNumber}</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
              style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color }}>
              <SIcon className="w-4 h-4" /> {statusInfo.label}
            </div>
          </div>

          {/* Client + Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Para</div>
              <div className="font-semibold text-gray-800">{invoice.clientName}</div>
              {invoice.clientCompany && <div className="text-sm text-gray-500">{invoice.clientCompany}</div>}
              {invoice.clientEmail && <div className="text-sm text-gray-500">{invoice.clientEmail}</div>}
              {invoice.clientPhone && <div className="text-sm text-gray-500">{invoice.clientPhone}</div>}
              {invoice.clientAddress && <div className="text-sm text-gray-500 mt-1">{invoice.clientAddress}</div>}
            </div>
            <div className="text-right">
              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-widest text-gray-400">De</div>
                <div className="font-semibold text-gray-800">{invoice.user?.name || 'OCTOPUS'}</div>
                {invoice.user?.email && <div className="text-sm text-gray-500">{invoice.user.email}</div>}
              </div>
              <div className="mb-2">
                <div className="text-[10px] uppercase tracking-widest text-gray-400">Fecha</div>
                <div className="text-sm text-gray-700">{issueDate}</div>
              </div>
              {dueDate && (
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-400">Vencimiento</div>
                  <div className="text-sm text-gray-700">{dueDate}</div>
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: color }}>
                  <th className="px-4 py-3 text-left text-white text-xs uppercase tracking-wider rounded-l-lg">Descripción</th>
                  <th className="px-4 py-3 text-center text-white text-xs uppercase tracking-wider">Cant.</th>
                  <th className="px-4 py-3 text-right text-white text-xs uppercase tracking-wider">Precio</th>
                  <th className="px-4 py-3 text-right text-white text-xs uppercase tracking-wider rounded-r-lg">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map(item => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-sm text-gray-800">{item.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-center">{item.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 text-right">{cs}{item.unitPrice.toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{cs}{item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-72">
              <div className="flex justify-between py-2 text-sm text-gray-500">
                <span>Subtotal</span><span>{cs}{invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between py-2 text-sm text-red-500">
                  <span>Descuento</span><span>-{cs}{invoice.discount.toFixed(2)}</span>
                </div>
              )}
              {invoice.taxRate > 0 && (
                <div className="flex justify-between py-2 text-sm text-gray-500">
                  <span>Impuesto ({invoice.taxRate}%)</span><span>{cs}{invoice.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-3 text-xl font-bold border-t-2 mt-2" style={{ borderColor: color, color }}>
                <span>TOTAL</span><span>{cs}{invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 bg-gray-50 rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Notas</div>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className="mt-3 bg-gray-50 rounded-2xl p-5">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Términos</div>
              <p className="text-sm text-gray-600 whitespace-pre-line">{invoice.terms}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">Generado con <span className="font-semibold">OCTOPUS</span> Omni Cockpit · Wildverse LLC</p>
        </div>
      </motion.div>
    </div>
  )
}
