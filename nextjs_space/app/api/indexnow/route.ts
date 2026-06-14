import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const INDEXNOW_KEY = 'octopus-ai-indexnow-2025'

export async function GET() {
  return NextResponse.json({
    message: 'IndexNow endpoint active',
    key: INDEXNOW_KEY,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { urls } = body as { urls?: string[] }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array is required' }, { status: 400 })
    }

    const host = new URL(urls[0]).host

    const payload = {
      host,
      key: INDEXNOW_KEY,
      keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`,
      urlList: urls.slice(0, 10000),
    }

    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })

    return NextResponse.json({
      success: true,
      status: response.status,
      submitted: urls.length,
    })
  } catch (error) {
    console.error('IndexNow error:', error)
    return NextResponse.json({ error: 'Failed to submit URLs' }, { status: 500 })
  }
}
