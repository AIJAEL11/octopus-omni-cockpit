import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET — List all templates for user
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const templates = await prisma.browserTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ templates })
  } catch (e: any) {
    console.error('[Templates GET]', e.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST — Create, Update, Delete, or Duplicate template
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    // ── CREATE ──
    if (action === 'create') {
      const { name, description, steps, variables, category } = body
      if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
        return NextResponse.json({ error: 'Name and steps are required' }, { status: 400 })
      }

      const template = await prisma.browserTemplate.create({
        data: {
          userId: session.user.id,
          name,
          description: description || null,
          steps,
          variables: variables || null,
          category: category || null,
        },
      })

      return NextResponse.json({ template })
    }

    // ── UPDATE ──
    if (action === 'update') {
      const { id, name, description, steps, variables, category } = body
      if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })

      const existing = await prisma.browserTemplate.findFirst({
        where: { id, userId: session.user.id },
      })
      if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const template = await prisma.browserTemplate.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(steps && { steps }),
          ...(variables !== undefined && { variables }),
          ...(category !== undefined && { category }),
        },
      })

      return NextResponse.json({ template })
    }

    // ── DELETE ──
    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })

      await prisma.browserTemplate.deleteMany({
        where: { id, userId: session.user.id },
      })

      return NextResponse.json({ success: true })
    }

    // ── DUPLICATE ──
    if (action === 'duplicate') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'Template ID required' }, { status: 400 })

      const source = await prisma.browserTemplate.findFirst({
        where: { id, userId: session.user.id },
      })
      if (!source) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

      const template = await prisma.browserTemplate.create({
        data: {
          userId: session.user.id,
          name: source.name + ' (copy)',
          description: source.description,
          steps: source.steps as any,
          variables: source.variables as any,
          category: source.category,
        },
      })

      return NextResponse.json({ template })
    }

    // ── SAVE FROM HISTORY — save session commands as template ──
    if (action === 'save_from_session') {
      const { sessionId, name, description, category } = body
      if (!sessionId || !name) {
        return NextResponse.json({ error: 'sessionId and name required' }, { status: 400 })
      }

      // Get completed commands from session
      const commands = await prisma.browserCommand.findMany({
        where: {
          sessionId,
          userId: session.user.id,
          status: 'completed',
        },
        orderBy: { createdAt: 'asc' },
      })

      if (commands.length === 0) {
        return NextResponse.json({ error: 'No completed commands in session' }, { status: 400 })
      }

      // Convert commands to template steps
      const steps = commands.map((cmd) => ({
        type: cmd.type,
        params: cmd.params || {},
      }))

      // Auto-detect variables from text/URL params
      const variables: { name: string; label: string; type: string; defaultValue: string }[] = []
      const seenVars = new Set<string>()

      steps.forEach((step, i) => {
        const p = step.params as Record<string, any>
        if (step.type === 'type' && p.text && !seenVars.has('text_' + i)) {
          const varName = 'text_' + i
          variables.push({
            name: varName,
            label: `Text for step ${i + 1}`,
            type: 'string',
            defaultValue: p.text,
          })
          p.text = `{{${varName}}}`
          seenVars.add(varName)
        }
      })

      const template = await prisma.browserTemplate.create({
        data: {
          userId: session.user.id,
          name,
          description: description || `Saved from session (${commands.length} steps)`,
          steps,
          variables: variables.length > 0 ? (variables as any) : undefined,
          category: category || null,
        },
      })

      return NextResponse.json({ template })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e: any) {
    console.error('[Templates POST]', e.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
