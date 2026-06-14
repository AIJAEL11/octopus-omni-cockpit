import { callLLM } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildOutreachPrompt } from '@/lib/growth-engine'

export const dynamic = 'force-dynamic'

// POST — Generar email de outreach con AI para un lead
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await req.json()
    const { leadId, email, customSubject, customMessage } = body
    if (!leadId && !email) return NextResponse.json({ error: 'leadId o email requerido' }, { status: 400 })

    // Look up by leadId first, fallback to email
    let lead = leadId
      ? await prisma.growthLead.findFirst({ where: { id: leadId, userId: session.user.id } })
      : null
    if (!lead && email) {
      lead = await prisma.growthLead.findFirst({ where: { email, userId: session.user.id } })
    }
    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
    if (!lead.email) return NextResponse.json({ error: 'Lead no tiene email' }, { status: 400 })

    // Check for existing pending action
    const existingAction = await prisma.growthAction.findFirst({
      where: { leadId, userId: session.user.id, status: 'pending' },
    })
    if (existingAction) {
      return NextResponse.json({ error: 'Ya existe una acción pendiente para este lead', action: existingAction }, { status: 409 })
    }

    // Check if this is a follow-up (lead already contacted)
    const isFollowUp = lead.status === 'contacted' || lead.followUpCount > 0
    const actionType = isFollowUp ? 'send_follow_up' : 'send_outreach_email'

    // Get previous messages for follow-up context
    let previousMessages = ''
    if (isFollowUp) {
      const msgs = await prisma.growthMessage.findMany({
        where: { leadId, userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })
      if (msgs.length > 0) {
        previousMessages = `\n\nMENSAJES PREVIOS (más reciente primero):\n${msgs.map((m) =>
          `[${m.direction}] ${m.subject}: ${m.content?.substring(0, 200)}`
        ).join('\n')}`
      }
    }

    // Get sender name for personalized outreach
    const senderUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
    const senderName = senderUser?.name || session.user.name || 'OctopusSkills Team'

    let emailData: { subject: string; body: string; reasoning: string }

    if (customMessage) {
      // User provided a custom message — use it directly, skip LLM generation
      emailData = {
        subject: customSubject || `Message from ${senderName}`,
        body: customMessage,
        reasoning: 'Custom message provided by user',
      }
    } else {
      // Generate AI outreach
      let prompt = buildOutreachPrompt(lead, senderName)
      if (isFollowUp) {
        prompt += `\n\nIMPORTANTE: Este es un FOLLOW-UP (#${lead.followUpCount + 1}). El lead ya fue contactado pero no ha respondido.
- Usa un approach diferente al email anterior
- Agrega urgencia sutil (ej: "Nuestro plan Starter gratuito no estará disponible por siempre")
- Sé más corto y directo (máximo 80 palabras)
- Referencia el email anterior brevemente${previousMessages}`
      }
      const llmData = await callLLM(session.user.id, [{ role: 'user', content: prompt }], { model: 'gpt-4.1-mini', temperature: 0.7, maxTokens: 1000 })
      const raw = llmData.choices?.[0]?.message?.content || ''

      // Parse JSON from AI response
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        emailData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw)
      } catch {
        emailData = { subject: `Partnership opportunity for ${lead.businessName}`, body: raw, reasoning: 'AI response parsing fallback' }
      }
    }

    // Create pending action
    const action = await prisma.growthAction.create({
      data: {
        userId: session.user.id,
        leadId: lead.id,
        actionType,
        title: `${isFollowUp ? 'Follow-up' : 'Email'} → ${lead.contactName || lead.businessName}: ${emailData.subject}`,
        description: emailData.body.substring(0, 200) + '...',
        payload: JSON.stringify({
          to: lead.email,
          toName: lead.contactName || 'Partner',
          subject: emailData.subject,
          body: emailData.body,
        }),
        reasoning: emailData.reasoning,
        status: 'pending',
      },
    })

    return NextResponse.json({ action, email: emailData })
  } catch (error) {
    console.error('Error generating outreach:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
