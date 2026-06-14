// Utilidades de encriptación compartidas para API keys

export function encryptApiKey(apiKey: string): string {
  const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
  return Buffer.from(`${salt}:${apiKey}`).toString('base64')
}

export function decryptApiKey(encrypted: string): string {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8')
    const salt = process.env.NEXTAUTH_SECRET || 'octopus-salt'
    return decoded.replace(`${salt}:`, '')
  } catch {
    return encrypted
  }
}
