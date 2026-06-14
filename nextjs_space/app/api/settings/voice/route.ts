import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET: Obtener configuración de voz del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        elevenLabsKey: true,
        elevenLabsVoiceId: true,
        elevenLabsEnabled: true,
      },
    })

    return NextResponse.json({
      hasElevenLabs: !!(user?.elevenLabsKey),
      elevenLabsEnabled: user?.elevenLabsEnabled ?? true,
      voiceId: user?.elevenLabsVoiceId || '',
      // No devolver la API key completa por seguridad
      apiKeyPreview: user?.elevenLabsKey
        ? '••••' + user.elevenLabsKey.slice(-6)
        : '',
    })
  } catch (error) {
    console.error('Error fetching voice settings:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// POST: Guardar configuración de voz o re-validar
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action, apiKey, voiceId } = body

    // Acción: re-validar la key guardada
    if (action === 'validate') {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { elevenLabsKey: true },
      })
      if (!user?.elevenLabsKey) {
        return NextResponse.json({ valid: false, error: 'No hay API key guardada' })
      }
      try {
        const testResp = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': user.elevenLabsKey },
        })
        if (testResp.ok) {
          const userData = await testResp.json()
          return NextResponse.json({
            valid: true,
            subscription: userData.subscription?.tier || 'free',
            characterCount: userData.subscription?.character_count || 0,
            characterLimit: userData.subscription?.character_limit || 0,
          })
        } else {
          return NextResponse.json({ valid: false, error: `ElevenLabs respondió con error ${testResp.status}` })
        }
      } catch {
        return NextResponse.json({ valid: false, error: 'No se pudo conectar con ElevenLabs' })
      }
    }

    // Acción: listar voces disponibles
    if (action === 'list_voices') {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { elevenLabsKey: true },
      })
      if (!user?.elevenLabsKey) {
        return NextResponse.json({ voices: [] })
      }
      try {
        const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
          headers: { 'xi-api-key': user.elevenLabsKey },
        })
        if (resp.ok) {
          const data = await resp.json()
          const voices = (data.voices || []).map((v: { voice_id: string; name: string; labels?: Record<string, string>; category?: string }) => ({
            id: v.voice_id,
            name: v.name,
            accent: v.labels?.accent || '',
            gender: v.labels?.gender || '',
            category: v.category || '',
          }))
          return NextResponse.json({ voices })
        }
        return NextResponse.json({ voices: [] })
      } catch {
        return NextResponse.json({ voices: [] })
      }
    }

    // Acción: activar/desactivar ElevenLabs (sin borrar la key)
    if (action === 'toggle_enabled') {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { elevenLabsEnabled: true },
      })
      const newValue = !(user?.elevenLabsEnabled ?? true)
      await prisma.user.update({
        where: { id: session.user.id },
        data: { elevenLabsEnabled: newValue },
      })
      return NextResponse.json({ success: true, elevenLabsEnabled: newValue })
    }

    // Acción por defecto: guardar key + voiceId
    if (apiKey) {
      try {
        const testResp = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': apiKey },
        })
        if (!testResp.ok) {
          return NextResponse.json({ error: `API key de ElevenLabs inválida (código ${testResp.status})` }, { status: 400 })
        }
      } catch {
        return NextResponse.json({ error: 'No se pudo verificar la API key' }, { status: 400 })
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        elevenLabsKey: apiKey || null,
        elevenLabsVoiceId: voiceId || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving voice settings:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}

// DELETE: Eliminar configuración de voz (volver a Google Translate)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        elevenLabsKey: null,
        elevenLabsVoiceId: null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting voice settings:', error)
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
