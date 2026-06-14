'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'

export type Theme = 'cream' | 'dark' | 'terminal' | 'ocean' | 'hermes'

// Themes that need the Tailwind `dark` class for existing overrides to apply
const DARK_THEMES = new Set<Theme>(['dark', 'terminal', 'ocean', 'hermes'])

export interface ThemeConfig {
  id: Theme
  labelEs: string
  labelEn: string
  /** swatch color for the picker */
  swatch: string
  isDark: boolean
}

export const THEMES: ThemeConfig[] = [
  { id: 'cream',    labelEs: 'Crema',    labelEn: 'Cream',    swatch: '#F5F0E8', isDark: false },
  { id: 'dark',     labelEs: 'Oscuro',   labelEn: 'Dark',     swatch: '#1A2332', isDark: true  },
  { id: 'terminal', labelEs: 'Terminal', labelEn: 'Terminal', swatch: '#0a0e0a', isDark: true  },
  { id: 'ocean',    labelEs: 'Océano',   labelEn: 'Ocean',    swatch: '#060d18', isDark: true  },
  { id: 'hermes',   labelEs: 'Hermes',   labelEn: 'Hermes',   swatch: '#120e07', isDark: true  },
]

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  isDark: boolean
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'cream',
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: false,
})

function applyTheme(newTheme: Theme) {
  const root = document.documentElement
  // Remove all theme-* classes
  root.classList.remove('dark', 'theme-terminal', 'theme-ocean', 'theme-hermes')
  if (DARK_THEMES.has(newTheme)) root.classList.add('dark')
  if (newTheme !== 'dark' && newTheme !== 'cream') root.classList.add(`theme-${newTheme}`)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('cream')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('octopus-theme')
    const valid: Theme[] = ['cream', 'dark', 'terminal', 'ocean', 'hermes']
    // Migrate old 'light' value to 'cream'
    const migrated = stored === 'light' ? 'cream' : stored
    const resolved: Theme = valid.includes(migrated as Theme) ? migrated as Theme : 'cream'
    setThemeState(resolved)
    applyTheme(resolved)
    setMounted(true)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem('octopus-theme', newTheme)
    applyTheme(newTheme)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'cream' ? 'dark' : 'cream')
  }, [theme, setTheme])

  if (!mounted) return null

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: DARK_THEMES.has(theme) }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
