// Simple token generator for preview URLs (prevents unauthorized access)
// Shared between preview-render route and self-review skill
export function generatePreviewToken(sessionId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'octopus-preview-secret'
  let hash = 0
  const str = sessionId + secret
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
