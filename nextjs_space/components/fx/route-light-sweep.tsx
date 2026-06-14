'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LightSweep } from './light-sweep'

/**
 * RouteLightSweep — Dispara el efecto LightSweep cada vez que cambia la ruta,
 * una sola vez por ruta por sesión (sessionStorage).
 *
 * Por defecto se activa solo en rutas "premium" (configurables abajo).
 */
export function RouteLightSweep() {
  const pathname = usePathname()
  const [key, setKey] = useState(0)

  // Rutas donde queremos el efecto de barrido al entrar
  const PREMIUM_ROUTES = [
    '/dashboard',
    '/dashboard/projects',
    '/dashboard/jarvis',
    '/dashboard/creative',
    '/dashboard/ugc-factory',
    '/dashboard/growth-engine',
    '/dashboard/sales-agent',
  ]

  const shouldSweep = PREMIUM_ROUTES.some(
    (r) => pathname === r || pathname === r + '/'
  )

  useEffect(() => {
    // Re-render con nueva key al cambiar ruta para re-montar el LightSweep
    setKey((k) => k + 1)
  }, [pathname])

  if (!shouldSweep) return null

  return (
    <LightSweep
      key={`${pathname}-${key}`}
      storageKey={pathname}
      delay={200}
      duration={1.4}
      intensity={0.7}
      playOnce={true}
    />
  )
}

export default RouteLightSweep
