'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Clock, ChevronLeft, ChevronRight, User, Mail, Phone, FileText, Check, Loader2 } from 'lucide-react'
import { useParams } from 'next/navigation'

interface SlotInfo { time: string; label: string }
interface BookingCfg {
  title: string; description?: string | null; duration: number; brandColor: string
  userName?: string; availableDays: number[]
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

export default function BookingPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [config, setConfig] = useState<BookingCfg | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [slots, setSlots] = useState<SlotInfo[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [step, setStep] = useState<'date' | 'form' | 'done'>('date')
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  /* fetch config */
  useEffect(() => {
    if (!slug) return
    fetch(`/api/calendar/booking?slug=${slug}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { if (d.config) setConfig(d.config); else setError('Enlace no encontrado') })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }, [slug])

  /* fetch slots when date selected */
  useEffect(() => {
    if (!selectedDate || !slug) return
    setLoadingSlots(true)
    setSelectedSlot(null)
    const dateStr = selectedDate.toISOString().slice(0, 10)
    fetch(`/api/calendar/slots?slug=${slug}&date=${dateStr}`)
      .then(r => r.json())
      .then(d => setSlots(d.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false))
  }, [selectedDate, slug])

  /* submit booking */
  const handleSubmit = async () => {
    if (!selectedDate || !selectedSlot || !form.name || !form.email) return
    setSubmitting(true)
    try {
      const dateStr = selectedDate.toISOString().slice(0, 10)
      const r = await fetch(`/api/calendar/booking?slug=${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, time: selectedSlot, ...form })
      })
      if (r.ok) setStep('done')
    } catch {} finally { setSubmitting(false) }
  }

  /* calendar helpers */
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate()
  const firstDayOfWeek = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1).getDay()
  const today = new Date(); today.setHours(0,0,0,0)
  const isAvailableDay = (d: Date) => {
    if (d < today) return false
    return config?.availableDays?.includes(d.getDay()) ?? false
  }

  const brandColor = config?.brandColor || '#C4622D'

  if (!mounted) return null

  if (loading) return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#C4622D]" />
    </div>
  )

  if (error || !config) return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center">
      <div className="text-center">
        <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-gray-700">{error || 'No encontrado'}</h1>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F0E8] to-[#e8e0d0] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: brandColor }}>
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{config.title}</h1>
              {config.userName && <p className="text-sm text-gray-500">con {config.userName}</p>}
            </div>
          </div>
          {config.description && <p className="text-sm text-gray-500 mt-1">{config.description}</p>}
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" /> {config.duration} minutos
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'done' ? (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="p-10 text-center">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: brandColor + '20' }}>
                <Check className="w-8 h-8" style={{ color: brandColor }} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva Confirmada!</h2>
              <p className="text-gray-500">Te hemos reservado para el {selectedDate && `${DAYS_FULL[selectedDate.getDay()]} ${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()]}`} a las {selectedSlot}.</p>
              <p className="text-gray-400 text-sm mt-2">Recibirás una confirmación pronto.</p>
            </motion.div>
          ) : (
            <motion.div key="booking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                      className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-4 h-4 text-gray-500" /></button>
                    <span className="text-sm font-semibold text-gray-700">{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</span>
                    <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                      className="p-1.5 hover:bg-gray-100 rounded-lg"><ChevronRight className="w-4 h-4 text-gray-500" /></button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-1">
                    {DAYS_ES.map(d => <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = new Date(calMonth.getFullYear(), calMonth.getMonth(), i + 1)
                      const avail = isAvailableDay(d)
                      const sel = selectedDate && d.getTime() === selectedDate.getTime()
                      return (
                        <button key={i} disabled={!avail}
                          onClick={() => { setSelectedDate(d); setStep('date') }}
                          className={`w-full aspect-square rounded-lg text-sm font-medium transition ${
                            sel ? 'text-white shadow-md' : avail ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
                          }`} style={sel ? { backgroundColor: brandColor } : {}}>
                          {i + 1}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Slots or Form */}
                <div>
                  {!selectedDate ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <Calendar className="w-8 h-8 mb-2" />
                      <p className="text-sm">Selecciona un día</p>
                    </div>
                  ) : step === 'date' ? (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">
                        {DAYS_FULL[selectedDate.getDay()]} {selectedDate.getDate()} de {MONTHS[selectedDate.getMonth()]}
                      </h3>
                      {loadingSlots ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: brandColor }} /></div>
                      ) : slots.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No hay horarios disponibles</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                          {slots.map(s => (
                            <button key={s.time} onClick={() => { setSelectedSlot(s.time); setStep('form') }}
                              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition border ${
                                selectedSlot === s.time
                                  ? 'text-white border-transparent shadow-md'
                                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
                              }`} style={selectedSlot === s.time ? { backgroundColor: brandColor } : {}}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <button onClick={() => setStep('date')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3">
                        <ChevronLeft className="w-4 h-4" /> Cambiar horario
                      </button>
                      <p className="text-sm text-gray-500 mb-4">
                        {DAYS_FULL[selectedDate.getDay()]} {selectedDate.getDate()} · {selectedSlot}
                      </p>
                      <div className="space-y-3">
                        <div className="relative">
                          <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Tu nombre *" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#C4622D]/30" />
                        </div>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="Tu email *" type="email" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#C4622D]/30" />
                        </div>
                        <div className="relative">
                          <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                            placeholder="Teléfono (opcional)" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#C4622D]/30" />
                        </div>
                        <div className="relative">
                          <FileText className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="Notas adicionales" rows={2}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#C4622D]/30 resize-none" />
                        </div>
                        <button onClick={handleSubmit} disabled={submitting || !form.name || !form.email}
                          className="w-full py-3 rounded-xl text-white font-semibold text-sm transition hover:opacity-90 disabled:opacity-50"
                          style={{ backgroundColor: brandColor }}>
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar Reserva'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400">Powered by <span className="font-semibold">OCTOPUS</span> Omni Cockpit</p>
        </div>
      </motion.div>
    </div>
  )
}
