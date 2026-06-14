import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET: List user's sales agents
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const agents = await prisma.salesAgent.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { chatLogs: true } }
      }
    })

    return NextResponse.json(agents)
  } catch (error) {
    console.error('Error fetching sales agents:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST: Create a new sales agent
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const body = await req.json()
    const { 
      name, productName, productDesc, productPrice, purchaseLink, 
      brandVoice, greeting, objections, accentColor, logoUrl,
      targetAudience, keyBenefits, faq, socialProof, guarantee,
      urgencyTriggers, closingStyle, agentLanguage, maxDiscount, competitorInfo
    } = body

    if (!name || !productName || !productDesc) {
      return NextResponse.json({ error: 'Nombre, producto y descripción son requeridos' }, { status: 400 })
    }

    const agent = await prisma.salesAgent.create({
      data: {
        userId: user.id,
        name,
        productName,
        productDesc,
        productPrice: productPrice || null,
        purchaseLink: purchaseLink || null,
        brandVoice: brandVoice || null,
        greeting: greeting || `¡Hola! 👋 Soy tu asistente. ¿Te interesa saber más sobre ${productName}?`,
        objections: objections || null,
        targetAudience: targetAudience || null,
        keyBenefits: keyBenefits || null,
        faq: faq || null,
        socialProof: socialProof || null,
        guarantee: guarantee || null,
        urgencyTriggers: urgencyTriggers || null,
        closingStyle: closingStyle || null,
        agentLanguage: agentLanguage || 'auto',
        maxDiscount: maxDiscount || null,
        competitorInfo: competitorInfo || null,
        accentColor: accentColor || '#C4622D',
        logoUrl: logoUrl || null,
      }
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('Error creating sales agent:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
