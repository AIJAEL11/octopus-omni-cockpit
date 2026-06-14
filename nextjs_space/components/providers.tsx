'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/lib/theme-context'
import { I18nProvider } from '@/lib/i18n-context'
import { ReactNode, useEffect, useState } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="min-h-screen bg-[#F5F0E8]" />
  }

  return (
    <SessionProvider>
      <ThemeProvider>
        <I18nProvider>
          {children}
        </I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
