'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'

interface LightSweepProps {
  /** Delay antes de activar (ms). Default 150ms */
  delay?: number
  /** Duración del barrido (s). Default 1.4s */
  duration?: number
  /** Opacidad máxima del haz. Default 0.7 */
  intensity?: number
  /** Color del haz. Default azul cian cinematográfico */
  color?: string
  /** Si se ejecuta solo una vez por sesión/ruta (con key única). Default true */
  playOnce?: boolean
  /** Key única para playOnce (ej. pathname). Default 'default' */
  storageKey?: string
}

/**
 * LightSweep — Destello cinematográfico estilo Apple Keynote que barre
 * la pantalla en diagonal al cargar una página.
 *
 * Se monta una sola vez (o cada vez si playOnce=false), aparece con un
 * `gradient beam` en diagonal y se desvanece después.
 */
export function LightSweep({
  delay = 150,
  duration = 1.4,
  intensity = 0.7,
  color = 'rgba(14, 165, 233, 1)', // cyan-500
  playOnce = true,
  storageKey = 'default',
}: LightSweepProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (playOnce) {
      // Usar sessionStorage para que solo se muestre una vez por sesión por ruta
      const key = `lightsweep_${storageKey}`
      if (typeof window !== 'undefined' && sessionStorage.getItem(key)) {
        return
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(key, '1')
      }
    }

    const t = setTimeout(() => setVisible(true), delay)
    const tEnd = setTimeout(
      () => setVisible(false),
      delay + duration * 1000 + 200
    )
    return () => {
      clearTimeout(t)
      clearTimeout(tEnd)
    }
  }, [delay, duration, playOnce, storageKey])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
          aria-hidden
        >
          {/* Haz diagonal principal */}
          <motion.div
            initial={{ x: '-150%', y: '-50%', rotate: 22 }}
            animate={{ x: '150%', y: '50%', rotate: 22 }}
            transition={{ duration, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '220%',
              height: '220%',
              background: `linear-gradient(105deg,
                transparent 0%,
                transparent 40%,
                ${color.replace('1)', `${intensity * 0.15})`)} 45%,
                ${color.replace('1)', `${intensity * 0.5})`)} 49%,
                ${color.replace('1)', `${intensity})`)} 50%,
                ${color.replace('1)', `${intensity * 0.5})`)} 51%,
                ${color.replace('1)', `${intensity * 0.15})`)} 55%,
                transparent 60%,
                transparent 100%)`,
              mixBlendMode: 'screen',
              filter: 'blur(1px)',
            }}
          />
          {/* Haz secundario mas suave (glow) */}
          <motion.div
            initial={{ x: '-150%', y: '-50%', rotate: 22 }}
            animate={{ x: '150%', y: '50%', rotate: 22 }}
            transition={{ duration: duration * 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
            style={{
              position: 'absolute',
              top: '-50%',
              left: '-50%',
              width: '220%',
              height: '220%',
              background: `linear-gradient(105deg,
                transparent 0%,
                transparent 35%,
                ${color.replace('1)', `${intensity * 0.25})`)} 45%,
                ${color.replace('1)', `${intensity * 0.5})`)} 50%,
                ${color.replace('1)', `${intensity * 0.25})`)} 55%,
                transparent 65%,
                transparent 100%)`,
              mixBlendMode: 'screen',
              filter: 'blur(40px)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default LightSweep
