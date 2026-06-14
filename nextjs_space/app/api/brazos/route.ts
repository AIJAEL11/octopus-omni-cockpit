import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'

export const dynamic = 'force-dynamic'

// GET - Obtener todas las conexiones del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const connections = await prisma.armConnection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ connections })
  } catch (error) {
    console.error('Error fetching connections:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear o actualizar una conexión
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { type, credentials, name, status: requestedStatus } = body

    if (!type || !credentials) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    // Para brazos OAuth, se puede guardar como 'pending' primero
    const finalStatus = requestedStatus === 'pending' ? 'pending' : 'connected'

    // Verificar si ya existe una conexión de este tipo
    const existing = await prisma.armConnection.findFirst({
      where: {
        userId: session.user.id,
        armType: type as string,
      },
    })

    // Plan gate: only check when creating NEW connection
    if (!existing) {
      const gate = await checkPlanGate(session.user.id, 'brazos')
      if (!gate.allowed) {
        return NextResponse.json({ error: 'plan_limit', gate }, { status: 403 })
      }
    }

    let connection
    if (existing) {
      // Actualizar conexión existente
      connection = await prisma.armConnection.update({
        where: { id: existing.id },
        data: {
          credentials: JSON.stringify(credentials),
          status: finalStatus,
          connectedAt: finalStatus === 'connected' ? new Date() : existing.connectedAt,
          name: name || type,
        },
      })
    } else {
      // Crear nueva conexión
      connection = await prisma.armConnection.create({
        data: {
          userId: session.user.id,
          armType: type,
          credentials: JSON.stringify(credentials),
          status: finalStatus,
          connectedAt: finalStatus === 'connected' ? new Date() : null,
          name: name || type,
        },
      })
    }

    return NextResponse.json({ success: true, connection })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// DELETE - Desconectar un brazo
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (!type) {
      return NextResponse.json({ error: 'Tipo requerido' }, { status: 400 })
    }

    await prisma.armConnection.deleteMany({
      where: {
        userId: session.user.id,
        armType: type,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting connection:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
