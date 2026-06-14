export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectName, description, assetIds, brandName, productName } = await request.json()

    if (!assetIds || assetIds.length === 0) {
      return NextResponse.json({ error: 'No assets selected' }, { status: 400 })
    }

    // Create a new project for this campaign
    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: projectName || `${brandName || 'Ad'} Campaign`,
        description: description || `Ad Factory campaign for ${brandName}`,
        projectType: 'portfolio',
        status: 'completed',
        progress: 100,
      },
    })

    // Link the selected CreativeAssets to this project
    await prisma.creativeAsset.updateMany({
      where: {
        id: { in: assetIds },
        userId: session.user.id,
      },
      data: {
        projectId: project.id,
      },
    })

    // Fetch updated project with assets count
    const updatedProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        creativeAssets: { select: { id: true, title: true, content: true } },
      },
    })

    return NextResponse.json({
      success: true,
      project: updatedProject,
      linkedAssets: assetIds.length,
    })
  } catch (error) {
    console.error('Save to project error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Remove an asset from a project
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assetId, action } = await request.json()

    if (action === 'remove' && assetId) {
      await prisma.creativeAsset.update({
        where: {
          id: assetId,
          userId: session.user.id,
        },
        data: { projectId: null },
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Patch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
