'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1419] px-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🐙</div>
        <h2 className="text-xl font-bold text-white mb-2">Algo salió mal</h2>
        <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
          Ocurrió un error inesperado. Esto puede deberse a una conexión temporal.
          Intenta recargar la página.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-[#FFD700] text-[#0a1628] font-semibold rounded-xl hover:bg-[#F0C030] transition-colors text-sm"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-zinc-800 text-white font-medium rounded-xl hover:bg-zinc-700 transition-colors text-sm"
          >
            Ir al Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
