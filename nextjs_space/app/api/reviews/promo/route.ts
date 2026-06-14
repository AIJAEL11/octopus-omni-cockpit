export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ADMIN_EMAILS = ['1billontopview@gmail.com']

// ─── POST /api/reviews/promo ─── Generate social proof ad (image + LinkedIn copy)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { reviewId } = body
    if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

    // Get the review with user info
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { User: { select: { name: true, email: true, planId: true } } },
    })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    if (review.rating < 4) return NextResponse.json({ error: 'Only positive reviews (4-5 stars) can generate promos' }, { status: 400 })

    // Mark as generating
    await prisma.review.update({ where: { id: reviewId }, data: { promoStatus: 'generating' } })

    const userName = review.User?.name || review.User?.email?.split('@')[0] || 'User'
    const reviewText = review.comment || `${review.rating}/5 stars`
    const feedbackLabel = review.feedbackType === 'emotion' ? 'Motion/Audio' : review.feedbackType === 'usability' ? 'Ad Factory' : review.feedbackType === 'results' ? 'Growth Engine' : 'Octopus'

    // ── Step 1: Generate LinkedIn copy via LLM ──
    let promoCopy = ''
    try {
      const copyRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4.1',
          max_tokens: 300,
          temperature: 0.8,
          messages: [
            {
              role: 'system',
              content: `You are a viral LinkedIn copywriter for Octopus, an AI-powered marketing platform. Write a compelling LinkedIn post that leverages a real user testimonial as social proof. The post should:
- Start with a hook emoji and attention-grabbing first line
- Quote the user review naturally
- Include the user's first name
- End with a subtle CTA and relevant hashtags
- Be 3-5 short paragraphs, optimized for LinkedIn engagement
- Sound authentic, not salesy
- Include 3-4 relevant hashtags at the end
Output ONLY the LinkedIn post text. No labels or explanations.`
            },
            {
              role: 'user',
              content: `User: ${userName}\nRating: ${review.rating}/5 stars\nModule used: ${feedbackLabel}\nReview: "${reviewText}"\n\nWrite the LinkedIn post:`
            }
          ]
        }),
      })
      if (copyRes.ok) {
        const copyData = await copyRes.json()
        promoCopy = copyData.choices?.[0]?.message?.content?.trim() || ''
      }
    } catch (err) {
      console.error('[Promo] Copy generation error:', err)
    }

    if (!promoCopy) {
      promoCopy = `🐙 Another happy user!\n\n"${reviewText}"\n— ${userName}\n\nSee why ${userName} is scaling with Octopus. ${review.rating}/5 stars on ${feedbackLabel}.\n\n#Octopus #AIMarketing #SocialProof #Growth`
    }

    // ── Step 2: Generate social proof ad image via LLM ──
    let promoImageUrl = ''
    try {
      const imgRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4.1',
          max_tokens: 300,
          modalities: ['image'],
          image_config: { size: '1024x1024' },
          messages: [
            {
              role: 'user',
              content: `Create a premium, modern social proof advertisement image for LinkedIn. Dark navy/black background with subtle geometric patterns. Include:
- A large gold octopus logo/icon at the top center (elegant, minimal)
- Gold 5-star rating icons below the logo
- The quote "${reviewText.slice(0, 80)}" in elegant white serif typography, centered
- "— ${userName}" in smaller gold text below the quote
- "OCTOPUS" in bold gold letters at the bottom
- Subtle gold gradient accents and light rays
- Professional, premium feel like a Tesla or Apple testimonial ad
- Clean, minimal layout with generous whitespace
Style: Dark luxury brand aesthetic, gold and white on dark background.`
            }
          ]
        }),
      })
      if (imgRes.ok) {
        const imgData = await imgRes.json()
        // Extract image URL from response
        const choices = imgData.choices || []
        if (choices[0]?.message) {
          const msg = choices[0].message
          if (typeof msg.image_url === 'string') promoImageUrl = msg.image_url
          else if (msg.image_url?.url) promoImageUrl = msg.image_url.url
          else if (msg.images?.[0]) {
            const img = msg.images[0]
            if (typeof img === 'string') promoImageUrl = img
            else if (img.url) promoImageUrl = img.url
            else if (img.image_url) promoImageUrl = typeof img.image_url === 'string' ? img.image_url : img.image_url.url || ''
          }
          // Fallback: search in content
          if (!promoImageUrl && typeof msg.content === 'string') {
            const urlMatch = msg.content.match(/https?:\/\/[^\s)\]"'<>]+/i)
            if (urlMatch) promoImageUrl = urlMatch[0]
          }
        }
      }
    } catch (err) {
      console.error('[Promo] Image generation error:', err)
    }

    // ── Save to database ──
    const updated = await prisma.review.update({
      where: { id: reviewId },
      data: {
        promoStatus: 'ready',
        promoImageUrl: promoImageUrl || null,
        promoCopy,
      },
    })

    return NextResponse.json({
      success: true,
      promoImageUrl: updated.promoImageUrl,
      promoCopy: updated.promoCopy,
      promoStatus: updated.promoStatus,
    })
  } catch (error) {
    console.error('[Promo] Error:', error)
    return NextResponse.json({ error: 'Promo generation failed' }, { status: 500 })
  }
}

// ─── GET /api/reviews/promo?reviewId=xxx ─── Get promo status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const reviewId = new URL(req.url).searchParams.get('reviewId')
    if (!reviewId) return NextResponse.json({ error: 'reviewId required' }, { status: 400 })

    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { promoStatus: true, promoImageUrl: true, promoCopy: true, promoVideoUrl: true, promoVoiceUrl: true },
    })
    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    return NextResponse.json(review)
  } catch (error) {
    console.error('[Promo] GET error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
