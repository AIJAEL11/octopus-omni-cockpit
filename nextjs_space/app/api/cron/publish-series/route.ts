import { NextRequest, NextResponse } from 'next/server'
import { runOctopusSEOSeries } from '@/app/api/skills/octopus-seo/pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Rafael's userId — owner of octopuskills.com
const OWNER_USER_ID = 'cmogcamql0000rx08iv84penl'

export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // ── Auth: CRON_SECRET header ──
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || token !== cronSecret) {
      console.warn('[Cron/Publish] ❌ Unauthorized attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Optional: theme/instructions from body ──
    let theme: string | undefined
    let instructions: string | undefined
    try {
      const body = await req.json()
      theme = body.theme
      instructions = body.instructions
    } catch {
      // No body = auto-generate topic
    }

    console.log(`[Cron/Publish] ━━━ Automated series publish started ━━━`)
    console.log(`[Cron/Publish] Theme: ${theme || 'auto-generate'}`)
    console.log(`[Cron/Publish] Instructions: ${instructions || 'none'}`)

    // ── Run the series pipeline ──
    const result = await runOctopusSEOSeries(OWNER_USER_ID, {
      theme,
      instructions,
    })

    const duration = Date.now() - startTime

    console.log(`[Cron/Publish] ━━━ Result: ${result.success ? '✅' : '❌'} ━━━`)
    console.log(`[Cron/Publish] Series: "${result.seriesTheme}"`)
    console.log(`[Cron/Publish] Articles: ${result.articlesPublished}/${result.articlesTotal}`)
    console.log(`[Cron/Publish] Duration: ${Math.round(duration / 1000)}s`)
    if (result.error) console.error(`[Cron/Publish] Error: ${result.error}`)

    return NextResponse.json({
      success: result.success,
      seriesTheme: result.seriesTheme,
      articlesPublished: result.articlesPublished,
      articlesTotal: result.articlesTotal,
      duration,
      articles: result.articles.map(a => ({
        title: a.article?.title || 'N/A',
        slug: a.article?.slug || 'N/A',
        url: a.article?.publishedUrl || 'N/A',
        success: a.success,
        error: a.error,
      })),
      error: result.error,
    })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Cron/Publish] ❌ Fatal error:', errorMsg)
    return NextResponse.json(
      { success: false, error: errorMsg, duration: Date.now() - startTime },
      { status: 500 }
    )
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'octopus-seo-series-cron',
    description: 'Automated daily blog series publisher for octopuskills.com',
  })
}
