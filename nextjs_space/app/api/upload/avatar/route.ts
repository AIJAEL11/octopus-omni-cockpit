import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadBufferToS3Public } from '@/lib/s3'

export const dynamic = 'force-dynamic'

// POST - Subir foto de perfil
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.' },
        { status: 400 }
      )
    }

    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 5MB.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const fileName = `avatar-${session.user.id}-${Date.now()}.${file.type.split('/')[1]}`

    const { publicUrl } = await uploadBufferToS3Public(buffer, fileName, file.type)

    // Actualizar imagen del usuario
    await prisma.user.update({
      where: { id: session.user.id },
      data: { image: publicUrl },
    })

    return NextResponse.json({ image: publicUrl })
  } catch (error) {
    console.error('Error subiendo avatar:', error)
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 })
  }
}
