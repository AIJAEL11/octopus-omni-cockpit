import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { captureScreenshots, analyzeDesign, formatDesignReference } from '@/lib/skills/web-vision'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/arms/claude-code/vision
 * Capture screenshots of a URL and analyze the design.
 * Body: { url: string }
 * Returns: { analysis: DesignAnalysis, contextBlock: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { url } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    console.log(`[WebVision] Analyzing design for: ${url}`)

    // Step 1: Capture screenshots
    const screenshots = await captureScreenshots(url)
    console.log(`[WebVision] Screenshots captured: above=${screenshots.above ? 'yes' : 'no'}, full=${screenshots.full ? 'yes' : 'no'}`)

    // Step 2: Analyze design with LLM Vision
    const analysis = await analyzeDesign(screenshots, url, session.user.id)
    console.log(`[WebVision] Design analyzed: aesthetic=${analysis.overall?.aesthetic}, colors=${analysis.colors?.palette?.length || 0}`)

    // Step 3: Format context block
    const contextBlock = formatDesignReference(analysis)

    return NextResponse.json({
      success: true,
      analysis,
      contextBlock,
      screenshotsCaptured: {
        above: !!screenshots.above,
        full: !!screenshots.full,
      },
    })
  } catch (error) {
    console.error('[WebVision] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Vision analysis failed' },
      { status: 500 }
    )
  }
}
