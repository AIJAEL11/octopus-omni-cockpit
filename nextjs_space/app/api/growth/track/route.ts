export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1x1 transparent GIF pixel (43 bytes)
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

/**
 * GET /api/growth/track?tid=<trackingId>
 * Returns a 1x1 transparent GIF and records the email open event.
 * This is the classic "tracking pixel" technique used by all major email platforms.
 */
export async function GET(req: NextRequest) {
  const tid = req.nextUrl.searchParams.get('tid')

  // Always return the pixel — even if tid is missing/invalid
  const pixelResponse = () =>
    new NextResponse(TRACKING_PIXEL, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Content-Length': String(TRACKING_PIXEL.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })

  if (!tid) return pixelResponse()

  try {
    // Find the message by tracking ID
    const message = await prisma.growthMessage.findUnique({
      where: { trackingId: tid },
      select: { id: true, openedAt: true, openCount: true, leadId: true, userId: true },
    })

    if (message) {
      const now = new Date()

      // Update message: set openedAt on first open, always increment openCount
      await prisma.growthMessage.update({
        where: { id: message.id },
        data: {
          openedAt: message.openedAt || now,
          openCount: { increment: 1 },
        },
      })

      // Update CampaignLead status to 'opened' if still in 'sent' status
      if (message.leadId) {
        await prisma.campaignLead.updateMany({
          where: {
            leadId: message.leadId,
            status: 'sent',
            campaign: { userId: message.userId, status: 'active' },
          },
          data: {
            status: 'opened',
            openedAt: now,
          },
        })

        // Increment campaign openCount
        const campaignLeads = await prisma.campaignLead.findMany({
          where: {
            leadId: message.leadId,
            campaign: { userId: message.userId },
          },
          select: { campaignId: true },
        })

        const uniqueCampaignIds = [...new Set(campaignLeads.map(cl => cl.campaignId))]
        if (uniqueCampaignIds.length > 0 && !message.openedAt) {
          // Only increment campaign openCount on FIRST open
          await Promise.all(
            uniqueCampaignIds.map(cid =>
              prisma.campaign.update({
                where: { id: cid },
                data: { openCount: { increment: 1 } },
              })
            )
          )
        }
      }

      console.log(`[Email Track] ✅ Open recorded — tid: ${tid}, messageId: ${message.id}, openCount: ${message.openCount + 1}`)
    } else {
      console.log(`[Email Track] ⚠️ Unknown tracking ID: ${tid}`)
    }
  } catch (err) {
    // Never fail — always return the pixel
    console.error('[Email Track] Error recording open:', err)
  }

  return pixelResponse()
}
