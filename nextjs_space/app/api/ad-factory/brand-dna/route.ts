import { callLLM } from '@/lib/turbo-llm'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MASTER_BRAND_RESEARCH_PROMPT } from '@/lib/ad-factory-templates'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { brandName, brandUrl } = await request.json()
    if (!brandName || !brandUrl) {
      return NextResponse.json({ error: 'brandName and brandUrl are required' }, { status: 400 })
    }

    const prompt = MASTER_BRAND_RESEARCH_PROMPT
      .replace('[BRAND_NAME]', brandName)
      .replace('[BRAND_URL]', brandUrl)

    // Call LLM via centralized helper (Turbo Mode + Abacus AI fallback)
    const data = await callLLM(session.user.id, [
      {
        role: 'system',
        content: 'You are a Senior Brand Strategist with expertise in visual identity, advertising creative, and brand analysis. You produce detailed, actionable brand DNA documents for AI image generation.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ], { model: 'gpt-4.1', maxTokens: 4000, temperature: 0.7 })

    const content = data.choices?.[0]?.message?.content || ''

    return NextResponse.json({ brandDNA: content })
  } catch (error) {
    console.error('Brand DNA error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
