import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { runWildverseSEOPipeline } from './pipeline'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await req.json()
    const { topic, keyword, instructions } = body

    const result = await runWildverseSEOPipeline(userId, { topic, keyword, instructions })

    const statusCode = result.success ? 200
      : result.pipeline === 'rejected' ? 422
      : result.pipeline === 'blocked' ? 403
      : 500

    return NextResponse.json(result, { status: statusCode })
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[Wildverse-SEO] Route error:', errorMsg)
    return NextResponse.json({ success: false, error: errorMsg, pipeline: 'error' }, { status: 500 })
  }
}
