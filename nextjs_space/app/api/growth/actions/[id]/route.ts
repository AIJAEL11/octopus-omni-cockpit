import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserGmailTokenVerified, sendGmailEmail, getGmailProfile, buildTrackedHtmlEmail } from '@/lib/gmail-growth'
import { checkPlanGate } from '@/lib/plan-gate'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// PATCH — Aprobar o rechazar una acción (approve sends real email via Gmail)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    // Support both { action: 'approve' } and { status: 'approved' }
    const actionCmd = body.action || (body.status === 'approved' ? 'approve' : body.status === 'rejected' ? 'reject' : '')

    const existing = await prisma.growthAction.findFirst({
      where: { id: params.id, userId: session.user.id },
      include: { lead: true },
    })
    if (!existing) return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
    if (existing.status !== 'pending') return NextResponse.json({ error: 'Acción ya procesada' }, { status: 400 })

    if (actionCmd === 'approve') {
      const payload = existing.payload ? JSON.parse(existing.payload) : {}
      let emailSent = false
      let gmailMessageId: string | null = null
      let gmailThreadId: string | null = null
      let trackingId: string | null = null

      // ⚡ Rate limit por plan: emails diarios (solo si la acción implica enviar email)
      if (existing.leadId && existing.actionType.includes('email') && payload.to) {
        const gate = await checkPlanGate(session.user.id, 'emails_daily')
        if (!gate.allowed) {
          return NextResponse.json({
            error: `Límite diario de envíos alcanzado (${gate.current}/${gate.limit} en plan ${gate.planId}). Vuelve mañana o mejora tu plan.`,
            plan_limit: true,
            rateLimit: { limit: gate.limit, usedToday: gate.current, planId: gate.planId, upgradeRequired: gate.upgradeRequired },
          }, { status: 429 })
        }
      }

      // Get user's real name for email sender
      const senderUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
      const senderName = senderUser?.name || session.user.name || 'OCTOPUS Team'

      // Try to send real email via Gmail
      if (existing.leadId && existing.actionType.includes('email') && payload.to) {
        const accessToken = await getUserGmailTokenVerified(session.user.id)
        if (accessToken) {
          try {
            const profile = await getGmailProfile(accessToken)
            // Tracking pixel para registrar aperturas (open rate)
            trackingId = crypto.randomBytes(16).toString('hex')
            const baseUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
            const trackingPixelUrl = `${baseUrl}/api/growth/track?tid=${trackingId}`
            const htmlBody = buildTrackedHtmlEmail(payload.body || '', trackingPixelUrl)
            const result = await sendGmailEmail({
              accessToken,
              from: profile.emailAddress,
              fromName: senderName,
              to: payload.to,
              toName: payload.toName || 'Partner',
              subject: payload.subject || 'Partnership Opportunity',
              body: payload.body || '',
              htmlBody,
            })
            emailSent = true
            gmailMessageId = result.id
            gmailThreadId = result.threadId
            console.log(`[Growth] ✅ Email sent to ${payload.to} — Gmail ID: ${result.id}`)
          } catch (err: any) {
            console.error('[Growth] ❌ Gmail send failed:', err.message)
            trackingId = null // No guardar tracking si el envío falló
            // Don't fail the approval — mark as approved but note send failure
          }
        } else {
          console.warn('[Growth] Gmail not connected — email not sent')
        }
      }

      // Mark action as approved (or executed if email was sent)
      const updated = await prisma.growthAction.update({
        where: { id: params.id },
        data: {
          status: emailSent ? 'executed' : 'approved',
          executedAt: emailSent ? new Date() : null,
          // Store Gmail IDs in payload for tracking
          payload: JSON.stringify({
            ...payload,
            gmailMessageId,
            gmailThreadId,
            emailSent,
            sentAt: emailSent ? new Date().toISOString() : null,
          }),
        },
      })
      // If it's an email action and lead exists, update lead status
      if (existing.leadId && existing.actionType.includes('email')) {
        await prisma.growthLead.update({
          where: { id: existing.leadId },
          data: {
            status: 'contacted',
            lastContactedAt: new Date(),
            followUpCount: { increment: 1 },
          },
        })

        // Save the outreach as a message
        await prisma.growthMessage.create({
          data: {
            userId: session.user.id,
            leadId: existing.leadId,
            direction: 'outbound',
            channel: 'email',
            subject: payload.subject || existing.title,
            content: payload.body || existing.description || '',
            trackingId: trackingId || undefined,
            metadata: JSON.stringify({
              gmailMessageId,
              gmailThreadId,
              emailSent,
              trackingId,
            }),
          },
        })

        // 🔥 FIX — Update campaign progress: mark CampaignLead as 'sent' and increment Campaign.sentCount
        // Only if the email was actually sent (not just approved)
        if (emailSent) {
          const campaignLeads = await prisma.campaignLead.findMany({
            where: {
              leadId: existing.leadId,
              status: 'pending',
              campaign: { status: 'active', userId: session.user.id },
            },
            include: { campaign: { select: { id: true } } },
          })

          if (campaignLeads.length > 0) {
            const now = new Date()
            // Mark each CampaignLead as sent
            await prisma.campaignLead.updateMany({
              where: { id: { in: campaignLeads.map(cl => cl.id) } },
              data: { status: 'sent', sentAt: now },
            })
            // Increment sentCount on each parent Campaign
            await Promise.all(
              campaignLeads.map(cl =>
                prisma.campaign.update({
                  where: { id: cl.campaign.id },
                  data: { sentCount: { increment: 1 } },
                })
              )
            )
            console.log(`[Growth] 📊 Updated ${campaignLeads.length} campaign(s) for lead ${existing.leadId}`)
          }
        }
      }

      return NextResponse.json({ ...updated, emailSent })
    } else if (actionCmd === 'reject') {
      const updated = await prisma.growthAction.update({
        where: { id: params.id },
        data: { status: 'rejected' },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Acción inválida. Usa approve o reject' }, { status: 400 })
  } catch (error) {
    console.error('Error processing action:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}