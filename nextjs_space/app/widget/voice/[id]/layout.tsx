import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'OCTOPUS Voice Agent',
  description: 'Voice-powered AI sales agent',
}

export default function VoiceWidgetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ margin: 0, padding: 0, background: 'transparent', overflow: 'hidden', minHeight: '100vh' }}>
      {children}
    </div>
  )
}
