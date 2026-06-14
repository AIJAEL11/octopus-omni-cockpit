import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH: Update a scheduled post (content, scheduledFor, status)
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const { id, content, scheduledFor, status } = body;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Verify ownership
    const post = await prisma.socialPost.findFirst({ where: { id, userId: session.user.id } });
    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });

    // Only allow editing queued posts (not published or failed)
    if (post.status === 'published') {
      return NextResponse.json({ error: 'No se puede editar un post ya publicado' }, { status: 400 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (content !== undefined) updateData.content = content;
    if (scheduledFor !== undefined) updateData.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;
    if (status !== undefined) {
      // Allow: queued, paused, cancelled
      if (['queued', 'paused', 'cancelled'].includes(status)) {
        updateData.status = status;
      }
    }

    const updated = await prisma.socialPost.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ success: true, post: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    if (deleteAll) {
      const result = await prisma.socialPost.deleteMany({ where: { userId: session.user.id } });
      return NextResponse.json({ deleted: result.count });
    }

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    // Verify ownership
    const post = await prisma.socialPost.findFirst({ where: { id, userId: session.user.id } });
    if (!post) return NextResponse.json({ error: 'Post no encontrado' }, { status: 404 });

    await prisma.socialPost.delete({ where: { id } });
    return NextResponse.json({ deleted: 1, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = { userId: session.user.id };
    if (platform) where.platform = platform;
    if (status) where.status = status;

    const posts = await prisma.socialPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100)
    });

    const stats = await prisma.socialPost.groupBy({
      by: ['status'],
      where: { userId: session.user.id },
      _count: true
    });

    const platformStats = await prisma.socialPost.groupBy({
      by: ['platform'],
      where: { userId: session.user.id, status: 'published' },
      _count: true
    });

    return NextResponse.json({
      posts,
      stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {} as Record<string, number>),
      platformStats: platformStats.reduce((acc, s) => ({ ...acc, [s.platform]: s._count }), {} as Record<string, number>)
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
