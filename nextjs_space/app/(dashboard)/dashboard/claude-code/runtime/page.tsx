'use client'

/**
 * /dashboard/claude-code/runtime
 *
 * Página aislada que corre el WebContainer runtime del Code Engine.
 * Se carga dentro de un iframe desde la página principal con los headers COOP/COEP
 * habilitados (configurados en next.config.js) — requeridos por @webcontainer/api.
 *
 * Modos de carga:
 * A) ?sessionId=xxx  → fetch de archivos desde /api/arms/claude-code/runtime-boot
 * B) postMessage({ type: 'octopus-runtime-load', files, meta }) desde el padre
 *
 * Responde al padre con postMessage:
 *   { type: 'octopus-runtime-ready', url }  cuando el servidor está listo
 *   { type: 'octopus-runtime-error', error } si algo falla
 */

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import dynamic from 'next/dynamic'

// Dynamic import: WebContainers solo funciona en cliente con COOP/COEP activos
const CodeEngineRuntime = dynamic(() => import('@/components/code-engine-runtime'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-2 font-mono text-sm">
      <Loader2 size={18} className="animate-spin" />
      <span>Inicializando WebContainer…</span>
    </div>
  ),
})

interface RuntimeData {
  files: Record<string, string>
  meta: {
    hasPackageJson: boolean
    isNextJs: boolean
    isVite: boolean
    isReact: boolean
    devCmd: string
    fileCount: number
  }
  name?: string
}

function RuntimeContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [data, setData] = useState<RuntimeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Modo B: escuchar postMessage del padre
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'octopus-runtime-load' && e.data.files) {
        setData({ files: e.data.files, meta: e.data.meta, name: e.data.name })
        setLoading(false)
      }
    }
    window.addEventListener('message', onMessage)

    // Modo A: cargar desde API
    if (sessionId) {
      fetch(`/api/arms/claude-code/runtime-boot?sessionId=${sessionId}`)
        .then(r => r.json())
        .then(d => {
          if (d.error) throw new Error(d.error)
          setData({ files: d.files, meta: d.meta })
          setLoading(false)
        })
        .catch(err => {
          setError(err.message || 'Error cargando archivos')
          setLoading(false)
        })
    } else if (!sessionId) {
      // Esperar postMessage
      setLoading(false)
    }

    return () => window.removeEventListener('message', onMessage)
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-2 font-mono text-sm">
        <Loader2 size={18} className="animate-spin" />
        <span>Cargando archivos del proyecto…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-red-400 gap-3 font-mono text-sm px-8 text-center">
        <AlertCircle size={32} />
        <p className="font-semibold">Error al cargar el runtime</p>
        <p className="text-zinc-500 text-xs">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-500 gap-2 font-mono text-sm">
        <Loader2 size={18} className="animate-spin" />
        <span>Esperando archivos del proyecto…</span>
      </div>
    )
  }

  return (
    <CodeEngineRuntime
      files={data.files}
      meta={data.meta}
      projectName={data.name}
    />
  )
}

export default function RuntimePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-2 font-mono text-sm">
          <Loader2 size={18} className="animate-spin" />
          <span>Cargando…</span>
        </div>
      }
    >
      <RuntimeContent />
    </Suspense>
  )
}
