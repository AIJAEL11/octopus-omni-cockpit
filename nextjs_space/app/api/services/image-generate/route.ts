import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBlogImage, type BlogImageRequest } from '@/services/image-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/services/image-generate
 * 
 * Generates a brand-aligned blog cover image.
 * Used by VERA and other content agents programmatically.
 *
 * Body: { title, excerpt?, category?, styleOverride?, slug?, aspectRatio? }
 * Returns: { success, imageUrl, cached, prompt } or { success: false, error }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { title, excerpt, category, styleOverride, slug, aspectRatio } = body as BlogImageRequest

    if (!title) {
      return NextResponse.json(
        { error: 'title es requerido' },
        { status: 400 }
      )
    }

    const startTime = Date.now()

    const result = await generateBlogImage({
      title,
      excerpt,
      category,
      styleOverride,
      slug,
      aspectRatio,
      userId: session.user.id,
    })

    const duration = Date.now() - startTime

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'No se pudo generar la imagen. El artículo puede publicarse sin imagen.',
        duration,
      }, { status: 200 }) // 200 because this is non-blocking by design
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      cloudStoragePath: result.cloudStoragePath || null,
      cached: result.cached,
      prompt: result.prompt,
      duration,
    })
  } catch (error) {
    console.error('[ImageGenAPI] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno',
    }, { status: 500 })
  }
}
