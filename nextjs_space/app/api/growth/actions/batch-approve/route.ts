import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGmailTokenVerified, sendGmailEmail, getGmailProfile, buildTrackedHtmlEmail } from '@/lib/gmail-growth'
import { checkPlanGate } from '@/lib/plan-gate'
import crypto from 'crypto'

// Cola de envíos: procesamos en chunks para no agotar el timeout del servidor.
// El frontend re-llama mientras `remaining > 0`.
const SEND_CHUNK_SIZE = 10

export const dynamic = 'force-dynamic'

/**
 * POST /api/growth/actions/batch-approve
 * Approve and send ALL pending outreach actions.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // ⚡ Rate limit por plan: emails diarios
    const gate = await checkPlanGate(session.user.id, 'emails_daily')
    const dailyBudget = Math.max(0, gate.limit - gate.current)
    if (dailyBudget <= 0) {
      return NextResponse.json({
        approved: 0, sent: 0, failed: 0, remaining: 0,
        rateLimited: true,
        rateLimit: { limit: gate.limit, usedToday: gate.current, planId: gate.planId, upgradeRequired: gate.upgradeRequired },
        error: `Límite diario de envíos alcanzado (${gate.current}/${gate.limit} en plan ${gate.planId}). Vuelve mañana o mejora tu plan.`,
      }, { status: 429 })
    }

    // Total de acciones pendientes (para informar cuántas quedan en cola)
    const totalPending = await prisma.growthAction.count({
      where: {
        userId: session.user.id,
        status: 'pending',
        actionType: { in: ['send_outreach_email', 'send_follow_up'] },
      },
    })

    if (totalPending === 0) {
      return NextResponse.json({ approved: 0, sent: 0, failed: 0, remaining: 0, message: 'No hay acciones pendientes' })
    }

    // Chunk de esta pasada: mínimo entre tamaño de cola, chunk fijo y presupuesto diario
    const chunkSize = Math.min(SEND_CHUNK_SIZE, dailyBudget, totalPending)

    const pendingActions = await prisma.growthAction.findMany({
      where: {
        userId: session.user.id,
        status: 'pending',
        actionType: { in: ['send_outreach_email', 'send_follow_up'] },
      },
      include: { lead: true },
      orderBy: { createdAt: 'asc' },
      take: chunkSize,
    })

    console.log(`[Batch Approve] Processing ${pendingActions.length} pending actions`)

    // Get sender info
    const senderUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
    const senderName = senderUser?.name || session.user.name || 'OCTOPUS Team'

    // Get Gmail token with verification + auto-refresh
    let accessToken: string | null = null
    try {
      accessToken = await getUserGmailTokenVerified(session.user.id)
    } catch (err) {
      console.error('[Batch Approve] ❌ getUserGmailTokenVerified FAILED:', err)
      // Retry once after a short delay
      try {
        await new Promise(r => setTimeout(r, 1500))
        accessToken = await getUserGmailTokenVerified(session.user.id)
        console.log('[Batch Approve] ✅ getUserGmailTokenVerified succeeded on retry')
      } catch (err2) {
        console.error('[Batch Approve] ❌ Retry also failed:', err2)
      }
    }
    console.log(`[Batch Approve] Gmail token: ${accessToken ? 'OK (' + accessToken.substring(0, 10) + '...)' : 'NULL — Gmail not connected or token expired'}`)

    let gmailProfile: { emailAddress: string } | null = null
    if (accessToken) {
      try {
        gmailProfile = await getGmailProfile(accessToken)
        console.log(`[Batch Approve] Gmail profile: ${gmailProfile?.emailAddress || 'NULL'}`)
      } catch (err) {
        console.error('[Batch Approve] ❌ Gmail profile error:', err)
      }
    } else {
      console.warn('[Batch Approve] ⚠️ No Gmail access token — emails will be approved but NOT sent')
    }

    let approved = 0
    let sent = 0
    let failed = 0

    for (const action of pendingActions) {
      try {
        const payload = action.payload ? JSON.parse(action.payload) : {}
        let emailSent = false
        let gmailMessageId: string | null = null
        let gmailThreadId: string | null = null

        // Try sending via Gmail (with tracking pixel)
        let trackingId: string | null = null
        const canSend = action.actionType.includes('email') && payload.to && accessToken && gmailProfile
        if (!canSend && action.actionType.includes('email')) {
          // Log why we can't send
          const reasons: string[] = []
          if (!payload.to) reasons.push('no recipient email (payload.to missing)')
          if (!accessToken) reasons.push('no Gmail token')
          if (!gmailProfile) reasons.push('no Gmail profile')
          console.log(`[Batch Approve] ⏭️ Skipping send for ${action.lead?.businessName || action.id}: ${reasons.join(', ')}`)
        }
        if (canSend) {
          try {
            // Generate a unique tracking ID for this email
            trackingId = crypto.randomBytes(16).toString('hex')

            // Build the tracking pixel URL using NEXTAUTH_URL (production URL)
            const baseUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
            const trackingPixelUrl = `${baseUrl}/api/growth/track?tid=${trackingId}`

            // Convert plain text body to HTML with tracking pixel
            const emailBody = payload.body || ''
            const htmlBody = buildTrackedHtmlEmail(emailBody, trackingPixelUrl)

            const result = await sendGmailEmail({
              accessToken: accessToken!,
              from: gmailProfile!.emailAddress,
              fromName: senderName,
              to: payload.to,
              toName: payload.toName || 'Partner',
              subject: payload.subject || 'Partnership Opportunity',
              body: emailBody,
              htmlBody,
            })
            emailSent = true
            gmailMessageId = result.id
            gmailThreadId = result.threadId
            sent++
            console.log(`[Batch Approve] ✅ Email sent to ${payload.to} (tracking: ${trackingId})`)
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : 'Send failed'
            console.error(`[Batch Approve] ❌ Gmail send failed for ${payload.to}:`, errMsg)
            trackingId = null // Don't save tracking ID if email failed
          }
        }

        // Update action status — store Gmail IDs in payload for tracking
        await prisma.growthAction.update({
          where: { id: action.id },
          data: {
            status: emailSent ? 'executed' : 'approved',
            executedAt: emailSent ? new Date() : null,
            payload: JSON.stringify({
              ...payload,
              gmailMessageId,
              gmailThreadId,
              emailSent,
              sentAt: emailSent ? new Date().toISOString() : null,
            }),
          },
        })

        // Update lead status
        if (action.leadId && action.actionType.includes('email')) {
          await prisma.growthLead.update({
            where: { id: action.leadId },
            data: {
              status: 'contacted',
              lastContactedAt: new Date(),
              followUpCount: { increment: 1 },
            },
          })

          // Save message record
          if (emailSent) {
            await prisma.growthMessage.create({
              data: {
                userId: session.user.id,
                leadId: action.leadId,
                direction: 'outbound',
                channel: 'email',
                subject: payload.subject || '',
                content: payload.body || '',
                trackingId: trackingId || undefined,
                metadata: JSON.stringify({
                  gmailMessageId,
                  gmailThreadId,
                  emailSent,
                  trackingId,
                }),
              },
            })

            // 🔥 FIX — Update campaign progress: mark CampaignLead as sent + increment Campaign.sentCount
            const campaignLeads = await prisma.campaignLead.findMany({
              where: {
                leadId: action.leadId,
                status: 'pending',
                campaign: { status: 'active', userId: session.user.id },
              },
              include: { campaign: { select: { id: true } } },
            })

            if (campaignLeads.length > 0) {
              const now = new Date()
              await prisma.campaignLead.updateMany({
                where: { id: { in: campaignLeads.map(cl => cl.id) } },
                data: { status: 'sent', sentAt: now },
              })
              await Promise.all(
                campaignLeads.map(cl =>
                  prisma.campaign.update({
                    where: { id: cl.campaign.id },
                    data: { sentCount: { increment: 1 } },
                  })
                )
              )
            }
          }
        }

        approved++
      } catch (err: unknown) {
        failed++
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`[Batch Approve] ❌ Failed action ${action.id}:`, errMsg)
        // Mark as rejected
        await prisma.growthAction.update({
          where: { id: action.id },
          data: { status: 'rejected' },
        }).catch(() => {})
      }
    }

    const remaining = Math.max(0, totalPending - pendingActions.length)
    const budgetLeft = Math.max(0, dailyBudget - sent)
    console.log(`[Batch Approve] Chunk complete: ${approved} approved, ${sent} sent, ${failed} failed, ${remaining} remaining in queue, daily budget left: ${budgetLeft}`)

    return NextResponse.json({
      approved,
      sent,
      failed,
      total: pendingActions.length,
      remaining,
      rateLimited: remaining > 0 && budgetLeft <= 0,
      rateLimit: { limit: gate.limit, usedToday: gate.current + sent, planId: gate.planId },
      message: remaining > 0
        ? `${sent} emails enviados. Quedan ${remaining} en cola${budgetLeft <= 0 ? ' (límite diario alcanzado)' : ''}.`
        : `${sent} emails enviados via Gmail. ${approved} acciones aprobadas.`,
    })
  } catch (error: unknown) {
    console.error('[Batch Approve] Error:', error)
    const errMsg = error instanceof Error ? error.message : 'Error del servidor'
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}