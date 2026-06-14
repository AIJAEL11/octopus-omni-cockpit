import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Iniciar Sesión',
  description: 'Accede a OCTOPUS Omni Cockpit — tu plataforma de IA creativa y automatización inteligente.',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen relative bg-[#0a1628]">
      {children}
    </div>
  )
}
