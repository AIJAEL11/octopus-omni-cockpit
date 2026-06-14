export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET — estado real del checklist de primeros pasos (calculado desde la DB)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const [brazos, leads, campaigns, agents, skills, mcps, chats] = await Promise.all([
      prisma.armConnection.count({ where: { userId } }),
      prisma.growthLead.count({ where: { userId } }),
      prisma.campaign.count({ where: { userId } }),
      prisma.customAgent.count({ where: { userId } }),
      prisma.customSkill.count({ where: { userId } }),
      prisma.customMcp.count({ where: { userId } }),
      prisma.chatSession.count({ where: { userId } }),
    ])

    const steps = [
      {
        id: 'chat_octopus',
        title: 'Habla con OCTOPUS',
        description: 'Pídele lo que necesites en lenguaje natural — él hace el resto.',
        cta: 'Abrir OCTOPUS',
        href: '/dashboard/jarvis',
        done: chats > 0,
      },
      {
        id: 'connect_brazo',
        title: 'Conecta tu primer Brazo',
        description: 'Gmail, Calendar, redes sociales… dale superpoderes a tu cuenta.',
        cta: 'Conectar Brazo',
        href: '/dashboard/brazos',
        done: brazos > 0,
      },
      {
        id: 'import_leads',
        title: 'Trae tus primeros leads',
        description: 'Impórtalos o dile a OCTOPUS que prospecte por ti.',
        cta: 'Ir a Growth Engine',
        href: '/dashboard/growth',
        done: leads > 0,
      },
      {
        id: 'launch_campaign',
        title: 'Lanza tu primera campaña',
        description: 'Outreach con IA y aprobación humana antes de enviar.',
        cta: 'Crear campaña',
        href: '/dashboard/growth?tab=campaigns',
        done: campaigns > 0,
      },
      {
        id: 'create_tool',
        title: 'Crea tu primera herramienta',
        description: 'Dile a OCTOPUS: “créame un agente copywriter” — lo hace solo.',
        cta: 'Crear con OCTOPUS',
        href: '/dashboard/jarvis',
        done: agents + skills + mcps > 0,
      },
    ]

    const completed = steps.filter(s => s.done).length
    return NextResponse.json({ steps, completed, total: steps.length, allDone: completed === steps.length })
  } catch (error) {
    console.error('[Onboarding Checklist] error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
