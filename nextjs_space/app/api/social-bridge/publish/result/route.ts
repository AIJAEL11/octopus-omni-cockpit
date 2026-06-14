import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { socialBridgeBus } from '@/lib/social-bridge-events';
import { optionsResponse, jsonWithCors } from '@/lib/social-bridge-cors';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'octopus-social-bridge-secret';

export async function OPTIONS() { return optionsResponse(); }

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return jsonWithCors({ error: 'No autorizado' }, { status: 401 });
    let userId: string;
    try {
      const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch { return jsonWithCors({ error: 'Token inválido' }, { status: 401 }); }

    const { postId, success, platformPostId, platformUrl, error } = await req.json();
    if (!postId) return jsonWithCors({ error: 'postId requerido' }, { status: 400 });

    // Verify the post belongs to this user
    const post = await prisma.socialPost.findFirst({
      where: { id: postId, userId }
    });
    if (!post) return jsonWithCors({ error: 'Post no encontrado' }, { status: 404 });

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: success ? 'published' : 'failed',
        platformPostId: platformPostId || null,
        platformUrl: platformUrl || null,
        errorMessage: error || null,
        publishedAt: success ? new Date() : null,
        retryCount: success ? post.retryCount : post.retryCount + 1
      }
    });

    // Emit SSE event → dashboard updates history instantly
    socialBridgeBus.emitToUser(userId, 'publish_result', {
      postId,
      platform: post.platform,
      success: !!success,
      platformUrl: platformUrl || null,
      error: error || null,
      status: success ? 'published' : 'failed'
    });

    return jsonWithCors({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return jsonWithCors({ error: msg }, { status: 500 });
  }
}
