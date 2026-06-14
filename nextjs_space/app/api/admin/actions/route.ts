import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/admin-guard'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// OCTOPUS IA Action Executor — Allows IA to execute platform actions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { action, params } = await request.json()

    switch (action) {
      case 'send_email': {
        const { templateType, recipientFilter, customSubject, customBody } = params || {}
        
        // Get recipients based on filter
        let where: any = {}
        if (recipientFilter === 'inactive') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          where = { updatedAt: { lt: sevenDaysAgo } }
        } else if (recipientFilter === 'new') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          where = { createdAt: { gte: sevenDaysAgo } }
        } else if (recipientFilter === 'active') {
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          where = { updatedAt: { gte: sevenDaysAgo } }
        }
        // 'all' → no where filter

        const users = await prisma.user.findMany({ where, select: { email: true, name: true } })
        if (users.length === 0) {
          return NextResponse.json({ success: true, result: 'No se encontraron usuarios con ese filtro.' })
        }

        // Send emails via internal email API
        const emailApiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/admin/email`
        const emailRes = await fetch(emailApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            subject: customSubject || getTemplateSubject(templateType),
            body: customBody || getTemplateBody(templateType),
            type: templateType === 'announcement' ? 'announcement' : 'onboarding',
            sendToAll: recipientFilter === 'all',
            recipientEmails: recipientFilter !== 'all' ? users.map((u: any) => u.email) : undefined,
          }),
        })

        const emailResult = await emailRes.json()
        return NextResponse.json({
          success: true,
          result: `✅ Email enviado a ${emailResult.sent || users.length} usuarios (filtro: ${recipientFilter}). Template: ${templateType}.`
        })
      }

      case 'get_user_details': {
        const { email } = params || {}
        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true, name: true, email: true, createdAt: true, updatedAt: true,
            planId: true, turboEnabled: true, turboModel: true, onboardedAt: true,
            lastReactivationAt: true, reactivationTemplate: true,
            _count: { select: { Project: true, ChatSession: true, CreativeAsset: true, GrowthLead: true, SmartDevice: true } }
          },
        })
        if (!user) return NextResponse.json({ success: false, result: 'Usuario no encontrado.' })
        return NextResponse.json({ success: true, result: JSON.stringify(user, null, 2) })
      }

      case 'get_platform_stats': {
        const [users, messages, sessions, assets, leads, devices] = await Promise.all([
          prisma.user.count(),
          prisma.chatMessage.count(),
          prisma.chatSession.count(),
          prisma.creativeAsset.count(),
          prisma.growthLead.count(),
          prisma.smartDevice.count(),
        ])
        return NextResponse.json({
          success: true,
          result: `📊 Usuarios: ${users} | Mensajes: ${messages} | Sesiones: ${sessions} | Assets: ${assets} | Leads: ${leads} | Dispositivos IoT: ${devices}`
        })
      }

      default:
        return NextResponse.json({ success: false, result: `Acción '${action}' no reconocida.` })
    }
  } catch (error) {
    console.error('[Admin Actions] Error:', error)
    return NextResponse.json({ error: 'Error ejecutando acción' }, { status: 500 })
  }
}

function getTemplateSubject(type: string): string {
  const subjects: Record<string, string> = {
    welcome: '🐙 Bienvenido a OCTOPUS Omni Cockpit',
    smart_home: '🏠 Controla tu hogar inteligente con OCTOPUS',
    jarvis: '🤖 Jarvis, tu asistente IA, te espera',
    ad_factory: '🎨 Crea contenido épico con Ad Factory',
    growth: '📈 Activa tu Growth Engine con OCTOPUS',
    announcement: '📢 Novedades de OCTOPUS Omni Cockpit',
  }
  return subjects[type] || subjects.welcome
}

function getTemplateBody(type: string): string {
  const bodies: Record<string, string> = {
    welcome: 'Tu plataforma de gestión empresarial con IA está lista. Explora Smart Home, Jarvis, Ad Factory, Growth Engine y más.',
    smart_home: 'Conecta y controla todos tus dispositivos inteligentes desde un solo lugar. Compatible con WiZ, HubSpace y más plataformas IoT.',
    jarvis: 'Tu asistente de IA personal está listo. Búsqueda web, análisis de documentos, generación de contenido y control por voz.',
    ad_factory: 'Genera contenido profesional con inteligencia artificial. Imágenes, textos, campañas publicitarias y más, todo en segundos.',
    growth: 'Encuentra leads de calidad, automatiza seguimientos y haz crecer tu negocio con nuestro motor de crecimiento inteligente.',
    announcement: 'Tenemos novedades emocionantes para ti en OCTOPUS Omni Cockpit. ¡Descubre las últimas actualizaciones!',
  }
  return bodies[type] || bodies.welcome
}
