// Octopus Omni Cockpit Design Tokens
export const colors = {
  verdeMosgo: '#2D4A3E',
  arcilla: '#C4622D',
  crema: '#F5F0E8',
  carbon: '#1A1A1A',
  verdeMosgoLight: '#3D5A4E',
  arcillaLight: '#D4723D',
  cremaLight: '#FAF7F2',
  carbonLight: '#2A2A2A',
} as const

export const typography = {
  display: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '700',
  },
  displayBold: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '900',
  },
  body: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
  },
} as const

export const borderRadius = {
  sm: '0.75rem',
  md: '1.5rem',
  lg: '2rem',
} as const
