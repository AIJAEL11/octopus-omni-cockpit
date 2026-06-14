import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { optionsResponse, jsonWithCors } from '@/lib/social-bridge-cors';

export async function OPTIONS() { return optionsResponse(); }

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'octopus-social-bridge-secret';

// POST: Save training pattern from extension
export async function POST(req: Request) {
  try {
    // Accept both extension token and session auth
    let userId: string | null = null;
    const auth = req.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
        userId = decoded.userId;
      } catch { /* ignore */ }
    }
    if (!userId) {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id || null;
    }
    if (!userId) return jsonWithCors({ error: 'No autorizado' }, { status: 401 });

    const { platform, actionType, steps } = await req.json();
    if (!platform || !actionType || !steps?.length) {
      return jsonWithCors({ error: 'platform, actionType y steps son requeridos' }, { status: 400 });
    }

    const pattern = await prisma.trainingPattern.upsert({
      where: { userId_platform_actionType: { userId, platform, actionType } },
      create: {
        userId,
        platform,
        actionType,
        steps: JSON.stringify(steps),
        version: 1
      },
      update: {
        steps: JSON.stringify(steps),
        version: { increment: 1 },
        updatedAt: new Date()
      }
    });

    return jsonWithCors({ ok: true, pattern: { id: pattern.id, version: pattern.version } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return jsonWithCors({ error: msg }, { status: 500 });
  }
}

// GET: Get training patterns
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return jsonWithCors({ error: 'No autorizado' }, { status: 401 });

    const patterns = await prisma.trainingPattern.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' }
    });

    return jsonWithCors({
      patterns: patterns.map(p => ({
        ...p,
        steps: JSON.parse(p.steps)
      }))
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return jsonWithCors({ error: msg }, { status: 500 });
  }
}
