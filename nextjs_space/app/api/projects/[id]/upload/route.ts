import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generatePresignedUploadUrl } from '@/lib/s3'
import { getBucketConfig } from '@/lib/aws-config'

export const dynamic = 'force-dynamic'

// POST: Get presigned upload URL
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    // Verify project belongs to user
    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const { fileName, contentType } = await req.json()
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'fileName y contentType requeridos' }, { status: 400 })
    }

    // Generate presigned URL (public since these are gallery images)
    const { uploadUrl, cloud_storage_path } = await generatePresignedUploadUrl(fileName, contentType, true)

    return NextResponse.json({ uploadUrl, cloud_storage_path })
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return NextResponse.json({ error: 'Error al generar URL de subida' }, { status: 500 })
  }
}

// PUT: Complete upload — create CreativeAsset linked to project
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const project = await prisma.project.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })
    }

    const { cloud_storage_path, fileName } = await req.json()
    if (!cloud_storage_path) {
      return NextResponse.json({ error: 'cloud_storage_path requerido' }, { status: 400 })
    }

    // Build public URL
    const { bucketName } = getBucketConfig()
    const region = process.env.AWS_REGION || 'us-west-2'
    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`

    // Create CreativeAsset linked to this project
    const asset = await prisma.creativeAsset.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: 'uploaded_image',
        title: fileName || 'Imagen subida',
        description: 'Imagen subida manualmente al proyecto',
        prompt: 'Upload manual',
        content: publicUrl,
        thumbnail: publicUrl,
        platform: 'upload',
        format: 'image',
        status: 'ready',
      },
    })

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Error completing upload:', error)
    return NextResponse.json({ error: 'Error al completar subida' }, { status: 500 })
  }
}
