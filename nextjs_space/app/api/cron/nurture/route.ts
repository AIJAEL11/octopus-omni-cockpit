import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * POST /api/cron/nurture
 * Drip Sequence Orchestrator — runs every hour via cron.
 * 
 * For each active nurture campaign:
 *   1. Find CampaignLeads ready for their next drip step
 *   2. Send the email via notification API (auto-send, no approval)
 *   3. Update step tracking
 *
 * Auth: CRON_SECRET header
 */
export async function POST(req: NextRequest) {
  try {
    const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const results: { campaignId: string; campaignName: string; sent: number; errors: number }[] = []

    // Find all active nurture campaigns
    const campaigns = await prisma.campaign.findMany({
      where: {
        campaignType: 'nurture',
        status: 'active',
      },
      include: {
        leads: {
          where: {
            status: { in: ['pending', 'sent'] }, // not replied/converted/bounced
          },
          include: {
            lead: true,
          },
        },
        User: { select: { id: true, name: true, email: true, businessEmail: true } },
      },
    })

    console.log(`[Nurture Cron] Processing ${campaigns.length} active nurture campaigns`)

    for (const campaign of campaigns) {
      let sent = 0
      let errors = 0

      // Parse the sequence (JSON array of email steps)
      let sequence: NurtureStep[]
      try {
        sequence = campaign.sequence ? JSON.parse(campaign.sequence) : []
      } catch {
        console.error(`[Nurture Cron] Invalid sequence JSON for campaign ${campaign.id}`)
        continue
      }

      if (sequence.length === 0) {
        console.log(`[Nurture Cron] Campaign ${campaign.name} has no sequence steps, skipping`)
        continue
      }

      for (const campaignLead of campaign.leads) {
        try {
          const lead = campaignLead.lead
          if (!lead.email || lead.emailBounced) continue

          const currentStep = campaignLead.currentStep || 0

          // Already completed all steps?
          if (currentStep >= sequence.length) continue

          const stepConfig = sequence[currentStep]
          if (!stepConfig) continue

          // Check timing: is it time to send this step?
          const isReady = isStepReady(campaignLead, stepConfig, now)
          if (!isReady) continue

          // Send the email
          const senderName = campaign.User?.name || 'OctopusSkills'
          const senderEmail = campaign.User?.businessEmail || campaign.User?.email || `noreply@${getHostname()}`

          const emailSent = await sendNurtureEmail({
            to: lead.email,
            toName: lead.contactName || lead.businessName || 'there',
            subject: stepConfig.subject,
            body: stepConfig.body,
            senderName,
            senderEmail,
          })

          if (emailSent) {
            // Update CampaignLead: advance step
            const isLastStep = currentStep + 1 >= sequence.length
            await prisma.campaignLead.update({
              where: { id: campaignLead.id },
              data: {
                currentStep: currentStep + 1,
                lastStepAt: now,
                status: isLastStep ? 'sent' : 'pending', // 'sent' means completed all steps
                sentAt: campaignLead.sentAt || now, // first send time
              },
            })

            // Update campaign stats
            await prisma.campaign.update({
              where: { id: campaign.id },
              data: { sentCount: { increment: 1 } },
            })

            // Update lead status
            if (lead.status === 'new') {
              await prisma.growthLead.update({
                where: { id: lead.id },
                data: {
                  status: 'contacted',
                  lastContactedAt: now,
                },
              })
            }

            // Log the action
            await prisma.growthAction.create({
              data: {
                userId: campaign.userId,
                leadId: lead.id,
                actionType: 'nurture_email',
                title: `Nurture Step ${currentStep + 1}/${sequence.length} → ${lead.contactName || lead.email}: ${stepConfig.subject}`,
                description: stepConfig.body.substring(0, 200) + '...',
                payload: JSON.stringify({
                  campaignId: campaign.id,
                  step: currentStep + 1,
                  to: lead.email,
                  subject: stepConfig.subject,
                }),
                status: 'executed',
                executedAt: now,
              },
            })

            sent++
            console.log(`[Nurture Cron] ✅ Sent step ${currentStep + 1} to ${lead.email} (campaign: ${campaign.name})`)
          } else {
            errors++
          }
        } catch (err) {
          console.error(`[Nurture Cron] Error processing lead ${campaignLead.leadId}:`, err)
          errors++
        }
      }

      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        sent,
        errors,
      })
    }

    const totalSent = results.reduce((sum, r) => sum + r.sent, 0)
    const totalErrors = results.reduce((sum, r) => sum + r.errors, 0)
    console.log(`[Nurture Cron] Complete: ${totalSent} sent, ${totalErrors} errors across ${campaigns.length} campaigns`)

    return NextResponse.json({
      success: true,
      campaignsProcessed: campaigns.length,
      totalSent,
      totalErrors,
      results,
    })
  } catch (error) {
    console.error('[Nurture Cron] Fatal error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// --- Types ---

interface NurtureStep {
  subject: string
  body: string
  delayHours: number  // hours after enrollment (or after previous step)
  delayMode?: 'from_enrollment' | 'from_previous' // default: from_enrollment
}

// --- Timing logic ---

function isStepReady(
  campaignLead: { currentStep: number; lastStepAt: Date | null; createdAt: Date },
  stepConfig: NurtureStep,
  now: Date
): boolean {
  const delayMs = (stepConfig.delayHours || 0) * 60 * 60 * 1000
  const mode = stepConfig.delayMode || 'from_enrollment'

  if (mode === 'from_previous' && campaignLead.currentStep > 0) {
    // Delay from when the previous step was sent
    const lastSent = campaignLead.lastStepAt || campaignLead.createdAt
    return now.getTime() - new Date(lastSent).getTime() >= delayMs
  }

  // Default: delay from enrollment time
  const enrolledAt = new Date(campaignLead.createdAt)
  return now.getTime() - enrolledAt.getTime() >= delayMs
}

// --- Email sending via notification API ---

async function sendNurtureEmail(opts: {
  to: string
  toName: string
  subject: string
  body: string
  senderName: string
  senderEmail: string
}): Promise<boolean> {
  try {
    const htmlBody = buildNurtureHtml(opts.body, opts.toName)

    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: process.env.NOTIF_ID_LEAD_NURTURE_SEQUENCE,
        subject: opts.subject,
        body: htmlBody,
        is_html: true,
        recipient_email: opts.to,
        sender_email: opts.senderEmail,
        sender_alias: opts.senderName,
        reply_to: opts.senderEmail,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Nurture Email] API error (${res.status}):`, errText)
      return false
    }

    return true
  } catch (err) {
    console.error('[Nurture Email] Send failed:', err)
    return false
  }
}

// --- HTML email builder ---

function buildNurtureHtml(body: string, recipientName: string): string {
  // Replace {name} placeholder in body
  const personalizedBody = body.replace(/\{name\}/gi, recipientName)

  // Convert plain text to simple HTML paragraphs
  const htmlParagraphs = personalizedBody
    .split('\n\n')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #333;">${p.replace(/\n/g, '<br>')}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      ${htmlParagraphs}
    </div>
    <div style="text-align: center; padding: 16px 0; color: #999; font-size: 12px;">
      <p>Powered by OctopusSkills 🐙</p>
    </div>
  </div>
</body>
</html>`
}

function getHostname(): string {
  try {
    const url = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
    return new URL(url).hostname
  } catch {
    return 'octopuskills.com'
  }
}
