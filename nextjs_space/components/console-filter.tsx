'use client'

import { useEffect } from 'react'

export default function ConsoleFilter() {
  useEffect(() => {
    const origWarn = console.warn
    const origError = console.error
    const splineNoise = ['end of buffer not reached', 'Invalid origin', 'Received message from invalid origin']
    console.warn = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : ''
      if (splineNoise.some(s => msg.includes(s))) return
      origWarn.apply(console, args)
    }
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : String(args[0] ?? '')
      if (splineNoise.some(s => msg.includes(s))) return
      origError.apply(console, args)
    }
    return () => { console.warn = origWarn; console.error = origError }
  }, [])
  return null
}
