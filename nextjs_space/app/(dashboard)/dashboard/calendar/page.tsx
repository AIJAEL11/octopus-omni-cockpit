'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, Clock, MapPin,
  Video, Phone, Target, Coffee, Users, X, Trash2, Copy, Check, ExternalLink,
  Link2, Settings, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'

/* ─── types ─── */
interface CalEvent {
  id: string; title: string; description?: string | null
  startTime: string; endTime: string; allDay: boolean
  location?: string | null; color: string; type: string; status: string
  leadId?: string | null; leadName?: string | null; leadEmail?: string | null
  isBooking: boolean; bookingNotes?: string | null; reminder?: number | null
}
interface BookingCfg {
  id: string; enabled: boolean; slug: string; title: string; description?: string | null
  duration: number; bufferTime: number; availableDays: number[]; startHour: number
  endHour: number; timezone: string; brandColor: string
}

const EVENT_TYPES_DEF = [
  { value: 'meeting', en: 'Meeting', es: 'Reunión', icon: Video, color: '#C4622D' },
  { value: 'call', en: 'Call', es: 'Llamada', icon: Phone, color: '#2D4A3E' },
  { value: 'follow_up', en: 'Follow-up', es: 'Seguimiento', icon: Target, color: '#f59e0b' },
  { value: 'coffee', en: 'Coffee / Social', es: 'Café / Social', icon: Coffee, color: '#8B5CF6' },
  { value: 'booking', en: 'Booking', es: 'Reserva', icon: Users, color: '#0EA5E9' },
]

const DAYS_SHORT = { en: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], es: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'] }
const DAYS_FULL_I18N = { en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], es: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'] }
const MONTHS_I18N = { en: ['January','February','March','April','May','June','July','August','September','October','November','December'], es: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'] }

function fmtTime(d: Date) { return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false }) }
function isSameDay(a: Date, b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate() }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(r.getDate() - r.getDay()); r.setHours(0,0,0,0); return r }

export default function CalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [showCreate, setShowCreate] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null)
  const [showBookingCfg, setShowBookingCfg] = useState(false)
  const [bookingCfg, setBookingCfg] = useState<BookingCfg | null>(null)
  const [saving, setSaving] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const { locale } = useI18n()
  const isEn = locale === 'en'
  const L = isEn ? 'en' : 'es' as const
  const MONTHS = MONTHS_I18N[L]
  const DAYS_ES = DAYS_SHORT[L]
  const DAYS_FULL = DAYS_FULL_I18N[L]
  const EVENT_TYPES = EVENT_TYPES_DEF.map(t => ({ ...t, label: isEn ? t.en : t.es }))

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d
  })
  const today = new Date()

  /* ─── fetch events ─── */
  const fetchEvents = useCallback(async () => {
    try {
      const s = new Date(weekStart); s.setDate(s.getDate() - 1)
      const e = new Date(weekStart); e.setDate(e.getDate() + 8)
      const r = await fetch(`/api/calendar?start=${s.toISOString()}&end=${e.toISOString()}`)
      if (r.ok) { const d = await r.json(); setEvents(d.events || []) }
    } catch {} finally { setLoading(false) }
  }, [weekStart])

  const fetchBooking = useCallback(async () => {
    try {
      const r = await fetch('/api/calendar/booking')
      if (r.ok) { 
        const d = await r.json()
        // API returns config directly (or { exists: false })
        if (d && !d.exists && d.id) setBookingCfg(d)
      }
    } catch {}
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { fetchBooking() }, [fetchBooking])

  /* ─── navigation ─── */
  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); setLoading(true) }
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); setLoading(true) }
  const goToday = () => { setWeekStart(startOfWeek(new Date())); setLoading(true) }

  /* ─── delete ─── */
  const deleteEvent = async (id: string) => {
    await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' })
    setEvents(ev => ev.filter(e => e.id !== id))
    setSelectedEvent(null)
  }

  /* ─── events for day ─── */
  const eventsForDay = (day: Date) =>
    events.filter(e => isSameDay(new Date(e.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const todayEvents = events.filter(e => isSameDay(new Date(e.startTime), today))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  /* ─── copy booking link ─── */
  const copyBookingLink = () => {
    if (!bookingCfg) return
    const url = `${window.location.origin}/book/${bookingCfg.slug}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const typeInfo = (t: string) => EVENT_TYPES.find(x => x.value === t) || EVENT_TYPES[0]

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#F5F0E8] dark:bg-[#1A1A1A] p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4622D] to-[#2D4A3E] flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-white" />
            </div>
            {isEn ? 'Smart Calendar' : 'Agenda Inteligente'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{isEn ? 'Calendar, appointments & bookings in one place' : 'Calendario, citas y reservas en un solo lugar'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowBookingCfg(true)} variant="outline"
            className="border-[#2D4A3E]/30 dark:border-[#F5F0E8]/20 text-gray-700 dark:text-gray-300">
            <Link2 className="w-4 h-4 mr-2" /> Booking Link
          </Button>
          <Button onClick={() => setShowCreate(true)}
            className="bg-gradient-to-r from-[#C4622D] to-[#2D4A3E] text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" /> {isEn ? 'New Event' : 'Nuevo Evento'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main calendar */}
        <div className="xl:col-span-3">
          <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl overflow-hidden">
            {/* Week nav */}
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-2">
                <button onClick={prevWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
                <button onClick={goToday} className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#C4622D]/10 text-[#C4622D] hover:bg-[#C4622D]/20 transition">
                  {isEn ? 'Today' : 'Hoy'}
                </button>
                <button onClick={nextWeek} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-[#F5F0E8]">
                {MONTHS[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
                {weekDays[6].getMonth() !== weekDays[0].getMonth()
                  ? ` – ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
                  : ''}
              </h2>
            </div>

            {/* Week grid */}
            <div className="grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700/50">
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today)
                const dayEv = eventsForDay(day)
                return (
                  <div key={i} className={`min-h-[180px] md:min-h-[260px] p-2 ${isToday ? 'bg-[#C4622D]/5 dark:bg-[#C4622D]/10' : ''}`}>
                    <div className="text-center mb-2">
                      <div className="text-xs text-gray-400 dark:text-gray-500 uppercase">{DAYS_ES[day.getDay()]}</div>
                      <div className={`text-lg font-bold mt-0.5 ${
                        isToday ? 'w-8 h-8 mx-auto rounded-full bg-[#C4622D] text-white flex items-center justify-center text-sm'
                                : 'text-gray-700 dark:text-gray-200'
                      }`}>{day.getDate()}</div>
                    </div>
                    <div className="space-y-1">
                      {dayEv.map(ev => {
                        const ti = typeInfo(ev.type)
                        const Icon = ti.icon
                        return (
                          <motion.button key={ev.id} onClick={() => setSelectedEvent(ev)}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                            className="w-full text-left p-1.5 rounded-lg text-xs transition group"
                            style={{ backgroundColor: ti.color + '18' }}>
                            <div className="flex items-center gap-1">
                              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: ti.color }} />
                              <span className="truncate font-medium text-gray-800 dark:text-gray-200">{ev.title}</span>
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {fmtTime(new Date(ev.startTime))}
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Booking link card */}
          {bookingCfg && (
            <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-[#F5F0E8] text-sm">Booking Link</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  bookingCfg.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                     : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>{bookingCfg.enabled ? (isEn ? 'Active' : 'Activo') : (isEn ? 'Inactive' : 'Inactivo')}</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-[#1A1A1A] rounded-lg p-2">
                <code className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">/book/{bookingCfg.slug}</code>
                <button onClick={copyBookingLink}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition">
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                <a href={`/book/${bookingCfg.slug}`} target="_blank" rel="noreferrer"
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </a>
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {bookingCfg.duration} min · {bookingCfg.bufferTime} min buffer
              </div>
            </Card>
          )}

          {/* Today's events */}
          <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 dark:text-[#F5F0E8] text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#C4622D]" /> {isEn ? 'Today' : 'Hoy'}
              <span className="ml-auto text-xs text-gray-400">{todayEvents.length} {isEn ? (todayEvents.length !== 1 ? 'events' : 'event') : (todayEvents.length !== 1 ? 'eventos' : 'evento')}</span>
            </h3>
            {todayEvents.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">{isEn ? 'No events today 🎉' : 'No hay eventos hoy 🎉'}</p>
            ) : (
              <div className="space-y-2">
                {todayEvents.map(ev => {
                  const ti = typeInfo(ev.type)
                  const Icon = ti.icon
                  return (
                    <button key={ev.id} onClick={() => setSelectedEvent(ev)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1A1A1A] transition">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: ti.color + '20' }}>
                          <Icon className="w-4 h-4" style={{ color: ti.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{ev.title}</div>
                          <div className="text-xs text-gray-500">{fmtTime(new Date(ev.startTime))} – {fmtTime(new Date(ev.endTime))}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Event types legend */}
          <Card className="bg-white dark:bg-[#232323] border-0 shadow-lg rounded-2xl p-4">
            <h3 className="font-semibold text-gray-900 dark:text-[#F5F0E8] text-sm mb-3">{isEn ? 'Event Types' : 'Tipos de Evento'}</h3>
            <div className="space-y-2">
              {EVENT_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <div key={t.value} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                    <span className="text-gray-600 dark:text-gray-400">{t.label}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Create Event Modal ─── */}
      <AnimatePresence>
        {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchEvents() }} />}
      </AnimatePresence>

      {/* ─── Event Detail Modal ─── */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)}
            onDelete={(id) => deleteEvent(id)} />
        )}
      </AnimatePresence>

      {/* ─── Booking Config Modal ─── */}
      <AnimatePresence>
        {showBookingCfg && (
          <BookingConfigModal config={bookingCfg} onClose={() => setShowBookingCfg(false)}
            onSaved={(cfg) => { setBookingCfg(cfg); setShowBookingCfg(false) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══════════════════════════════════════ */
/*         CREATE EVENT MODAL              */
/* ═══════════════════════════════════════ */
function CreateEventModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const EVENT_TYPES = EVENT_TYPES_DEF.map(t => ({ ...t, label: isEn ? t.en : t.es }))
  const [form, setForm] = useState({
    title: '', type: 'meeting', startDate: new Date().toISOString().slice(0, 10),
    startHour: '10:00', endHour: '10:30', location: '', description: '',
    leadName: '', leadEmail: ''
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const st = new Date(`${form.startDate}T${form.startHour}:00`)
      const et = new Date(`${form.startDate}T${form.endHour}:00`)
      await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, type: form.type, startTime: st.toISOString(), endTime: et.toISOString(),
          location: form.location || null, description: form.description || null,
          leadName: form.leadName || null, leadEmail: form.leadEmail || null,
          color: EVENT_TYPES.find(t => t.value === form.type)?.color || '#C4622D'
        })
      })
      onCreated()
    } catch {} finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#232323] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#F5F0E8]">{isEn ? 'New Event' : 'Nuevo Evento'}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          <div className="space-y-4">
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder={isEn ? 'Event title' : 'Título del evento'} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm focus:ring-2 focus:ring-[#C4622D] outline-none" />

            {/* Type pills */}
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.filter(t => t.value !== 'booking').map(t => {
                const Icon = t.icon
                return (
                  <button key={t.value} onClick={() => set('type', t.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      form.type === t.value ? 'text-white shadow-md' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`} style={form.type === t.value ? { backgroundColor: t.color } : {}}>
                    <Icon className="w-3.5 h-3.5" /> {t.label}
                  </button>
                )
              })}
            </div>

            {/* Date & time */}
            <div className="grid grid-cols-3 gap-3">
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)}
                className="col-span-1 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
              <input type="time" value={form.startHour} onChange={e => set('startHour', e.target.value)}
                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
              <input type="time" value={form.endHour} onChange={e => set('endHour', e.target.value)}
                className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
            </div>

            <input value={form.location} onChange={e => set('location', e.target.value)}
              placeholder={isEn ? '📍 Location (optional)' : '📍 Ubicación (opcional)'} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />

            {/* Lead info */}
            <div className="grid grid-cols-2 gap-3">
              <input value={form.leadName} onChange={e => set('leadName', e.target.value)}
                placeholder={isEn ? 'Lead name' : 'Nombre del lead'} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
              <input value={form.leadEmail} onChange={e => set('leadEmail', e.target.value)}
                placeholder={isEn ? 'Lead email' : 'Email del lead'} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />
            </div>

            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder={isEn ? 'Notes or description...' : 'Notas o descripción...'} rows={3}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none resize-none" />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose} className="dark:border-gray-700 dark:text-gray-300">{isEn ? 'Cancel' : 'Cancelar'}</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="bg-gradient-to-r from-[#C4622D] to-[#2D4A3E] text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {isEn ? 'Create Event' : 'Crear Evento'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════ */
/*         EVENT DETAIL MODAL              */
/* ═══════════════════════════════════════ */
function EventDetailModal({ event, onClose, onDelete }: { event: CalEvent; onClose: () => void; onDelete: (id: string) => void }) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const Lk = isEn ? 'en' : 'es' as const
  const EVENT_TYPES = EVENT_TYPES_DEF.map(t => ({ ...t, label: isEn ? t.en : t.es }))
  const DAYS_FULL = DAYS_FULL_I18N[Lk]
  const MONTHS = MONTHS_I18N[Lk]
  const ti = EVENT_TYPES.find(t => t.value === event.type) || EVENT_TYPES[0]
  const Icon = ti.icon
  const st = new Date(event.startTime)
  const et = new Date(event.endTime)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#232323] rounded-2xl shadow-2xl w-full max-w-md">
        {/* Color header */}
        <div className="h-2 rounded-t-2xl" style={{ backgroundColor: ti.color }} />
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: ti.color + '20' }}>
                <Icon className="w-5 h-5" style={{ color: ti.color }} />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-[#F5F0E8]">{event.title}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ti.color + '20', color: ti.color }}>{ti.label}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{DAYS_FULL[st.getDay()]} {st.getDate()} {MONTHS[st.getMonth()]} · {fmtTime(st)} – {fmtTime(et)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="w-4 h-4" /> <span>{event.location}</span>
              </div>
            )}
            {event.leadName && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Users className="w-4 h-4" /> <span>{event.leadName} {event.leadEmail ? `(${event.leadEmail})` : ''}</span>
              </div>
            )}
            {event.description && (
              <p className="text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1A1A1A] p-3 rounded-xl">{event.description}</p>
            )}
            {event.isBooking && event.bookingNotes && (
              <p className="text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl">
                <strong className="text-blue-600 dark:text-blue-400">{isEn ? 'Booking notes:' : 'Notas de reserva:'}</strong> {event.bookingNotes}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => onDelete(event.id)}
              className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
              <Trash2 className="w-4 h-4 mr-1" /> {isEn ? 'Delete' : 'Eliminar'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ═══════════════════════════════════════ */
/*        BOOKING CONFIG MODAL             */
/* ═══════════════════════════════════════ */
function BookingConfigModal({ config, onClose, onSaved }: {
  config: BookingCfg | null; onClose: () => void; onSaved: (c: BookingCfg) => void
}) {
  const { locale } = useI18n()
  const isEn = locale === 'en'
  const DAYS_ES = DAYS_SHORT[isEn ? 'en' : 'es']
  const [form, setForm] = useState({
    title: config?.title || (isEn ? 'Meeting with me' : 'Reunión conmigo'),
    description: config?.description || '',
    duration: config?.duration || 30,
    bufferTime: config?.bufferTime || 10,
    startHour: config?.startHour || 9,
    endHour: config?.endHour || 18,
    availableDays: config?.availableDays || [1, 2, 3, 4, 5],
    enabled: config?.enabled ?? true,
  })
  const [saving, setSaving] = useState(false)
  const toggleDay = (d: number) => setForm(f => ({
    ...f,
    availableDays: f.availableDays.includes(d) ? f.availableDays.filter(x => x !== d) : [...f.availableDays, d]
  }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/calendar/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      if (r.ok) { const d = await r.json(); onSaved(d) }
    } catch {} finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#232323] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-[#F5F0E8] flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#C4622D]" /> {isEn ? 'Configure Booking' : 'Configurar Booking'}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          <div className="space-y-4">
            {/* Enabled toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1A1A1A] rounded-xl">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{isEn ? 'Bookings active' : 'Reservas activas'}</span>
              <button onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}>
                {form.enabled
                  ? <ToggleRight className="w-8 h-8 text-green-500" />
                  : <ToggleLeft className="w-8 h-8 text-gray-400" />
                }
              </button>
            </div>

            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={isEn ? 'Page title' : 'Título de la página'} className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none" />

            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={isEn ? 'Description (visible to your clients)' : 'Descripción (visible para tus clientes)'} rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none resize-none" />

            {/* Duration & buffer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{isEn ? 'Duration (min)' : 'Duración (min)'}</label>
                <select value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
                  {[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{isEn ? 'Buffer (min)' : 'Buffer (min)'}</label>
                <select value={form.bufferTime} onChange={e => setForm(f => ({ ...f, bufferTime: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
                  {[0, 5, 10, 15, 30].map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
              </div>
            </div>

            {/* Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{isEn ? 'Start hour' : 'Hora inicio'}</label>
                <select value={form.startHour} onChange={e => setForm(f => ({ ...f, startHour: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{isEn ? 'End hour' : 'Hora fin'}</label>
                <select value={form.endHour} onChange={e => setForm(f => ({ ...f, endHour: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1A1A1A] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-[#F5F0E8] text-sm outline-none">
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                </select>
              </div>
            </div>

            {/* Days */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-2 block">{isEn ? 'Available days' : 'Días disponibles'}</label>
              <div className="flex gap-1">
                {DAYS_ES.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium transition ${
                      form.availableDays.includes(i)
                        ? 'bg-[#2D4A3E] text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                    }`}>{d}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose} className="dark:border-gray-700 dark:text-gray-300">{isEn ? 'Cancel' : 'Cancelar'}</Button>
            <Button onClick={handleSave} disabled={saving}
              className="bg-gradient-to-r from-[#C4622D] to-[#2D4A3E] text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {isEn ? 'Save' : 'Guardar'}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
