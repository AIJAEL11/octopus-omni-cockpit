// API para gestionar Workspaces (Multi-cuenta/Multi-marca)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET - Listar workspaces del usuario
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        Workspace: {
          orderBy: { createdAt: 'asc' }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Si no tiene workspaces, crear uno por defecto
    if (user.Workspace.length === 0) {
      // Check for existing LinkedIn connection to migrate
      const existingLinkedin = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'linkedin' } }
      })

      const defaultWorkspace = await prisma.workspace.create({
        data: {
          userId: user.id,
          name: user.name || 'Mi Marca',
          slug: 'default',
          isDefault: true,
          description: 'Workspace principal',
          // Migrate existing LinkedIn credentials to default workspace
          ...(existingLinkedin?.accessToken ? {
            linkedinAccessToken: existingLinkedin.accessToken,
            linkedinRefreshToken: existingLinkedin.refreshToken,
            linkedinTokenExpiry: existingLinkedin.tokenExpiry,
            linkedinUserId: existingLinkedin.platformUserId,
            linkedinUsername: existingLinkedin.username,
            linkedinProfileUrl: existingLinkedin.profileUrl,
            linkedinProfileImage: existingLinkedin.profileImage,
          } : {}),
        }
      })

      // Link existing SocialConnection to default workspace
      if (existingLinkedin) {
        await prisma.socialConnection.update({
          where: { id: existingLinkedin.id },
          data: { workspaceId: defaultWorkspace.id }
        })
        console.log(`[Workspaces] Migrated LinkedIn credentials to default workspace for ${user.email}`)
      }

      // Establecer como activo
      await prisma.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: defaultWorkspace.id }
      })

      return NextResponse.json({
        workspaces: [defaultWorkspace],
        activeWorkspaceId: defaultWorkspace.id
      })
    }

    // Check if default workspace needs LinkedIn migration (existing workspaces but no LinkedIn creds)
    const defaultWs = user.Workspace.find(w => w.isDefault)
    if (defaultWs && !defaultWs.linkedinAccessToken) {
      const existingLinkedin = await prisma.socialConnection.findUnique({
        where: { userId_platform: { userId: user.id, platform: 'linkedin' } }
      })
      if (existingLinkedin?.accessToken && !existingLinkedin.workspaceId) {
        await prisma.workspace.update({
          where: { id: defaultWs.id },
          data: {
            linkedinAccessToken: existingLinkedin.accessToken,
            linkedinRefreshToken: existingLinkedin.refreshToken,
            linkedinTokenExpiry: existingLinkedin.tokenExpiry,
            linkedinUserId: existingLinkedin.platformUserId,
            linkedinUsername: existingLinkedin.username,
            linkedinProfileUrl: existingLinkedin.profileUrl,
            linkedinProfileImage: existingLinkedin.profileImage,
          }
        })
        await prisma.socialConnection.update({
          where: { id: existingLinkedin.id },
          data: { workspaceId: defaultWs.id }
        })
        console.log(`[Workspaces] Late-migrated LinkedIn to default workspace`)
        // Refresh workspace data
        const refreshed = await prisma.workspace.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'asc' }
        })
        return NextResponse.json({
          workspaces: refreshed,
          activeWorkspaceId: user.activeWorkspaceId
        })
      }
    }

    return NextResponse.json({
      workspaces: user.Workspace,
      activeWorkspaceId: user.activeWorkspaceId
    })

  } catch (error) {
    console.error('[Workspaces API] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// POST - Crear nuevo workspace
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, logo, primaryColor, secondaryColor, brandVoice } = body

    if (!name) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
    }

    // Generar slug único
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 30)
    let slug = baseSlug
    let counter = 1
    
    while (await prisma.workspace.findFirst({ where: { userId: user.id, slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    const workspace = await prisma.workspace.create({
      data: {
        userId: user.id,
        name,
        slug,
        description,
        logo,
        primaryColor: primaryColor || '#FFD700',
        secondaryColor: secondaryColor || '#1a1a2e',
        brandVoice
      }
    })

    console.log(`[Workspaces] Created: ${workspace.name} for user ${user.email}`)

    return NextResponse.json({ workspace })

  } catch (error) {
    console.error('[Workspaces API] Create error:', error)
    return NextResponse.json({ error: 'Error creando workspace' }, { status: 500 })
  }
}

// PATCH - Actualizar workspace activo o datos
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const body = await request.json()
    
    // Cambiar workspace activo
    if (body.activeWorkspaceId) {
      // Verificar que el workspace pertenece al usuario
      const workspace = await prisma.workspace.findFirst({
        where: { id: body.activeWorkspaceId, userId: user.id }
      })

      if (!workspace) {
        return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { activeWorkspaceId: body.activeWorkspaceId }
      })

      console.log(`[Workspaces] Switched to: ${workspace.name}`)

      return NextResponse.json({ success: true, activeWorkspace: workspace })
    }

    // Actualizar datos del workspace
    if (body.workspaceId) {
      const { workspaceId, ...updateData } = body

      const workspace = await prisma.workspace.findFirst({
        where: { id: workspaceId, userId: user.id }
      })

      if (!workspace) {
        return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
      }

      const updated = await prisma.workspace.update({
        where: { id: workspaceId },
        data: updateData
      })

      return NextResponse.json({ workspace: updated })
    }

    return NextResponse.json({ error: 'Acción no especificada' }, { status: 400 })

  } catch (error) {
    console.error('[Workspaces API] Update error:', error)
    return NextResponse.json({ error: 'Error actualizando workspace' }, { status: 500 })
  }
}

// DELETE - Eliminar workspace
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { Workspace: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('id')

    if (!workspaceId) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, userId: user.id }
    })

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
    }

    if (workspace.isDefault) {
      return NextResponse.json({ error: 'No puedes eliminar el workspace por defecto' }, { status: 400 })
    }

    // Si es el activo, cambiar al default
    if (user.activeWorkspaceId === workspaceId) {
      const defaultWs = user.Workspace.find(w => w.isDefault)
      if (defaultWs) {
        await prisma.user.update({
          where: { id: user.id },
          data: { activeWorkspaceId: defaultWs.id }
        })
      }
    }

    await prisma.workspace.delete({ where: { id: workspaceId } })

    console.log(`[Workspaces] Deleted: ${workspace.name}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Workspaces API] Delete error:', error)
    return NextResponse.json({ error: 'Error eliminando workspace' }, { status: 500 })
  }
}
