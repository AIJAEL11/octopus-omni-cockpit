import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { optionsResponse, jsonWithCors } from '@/lib/social-bridge-cors';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'octopus-social-bridge-secret';

export async function OPTIONS() { return optionsResponse(); }

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return jsonWithCors({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return jsonWithCors({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return jsonWithCors({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, type: 'extension' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return jsonWithCors({ token, userId: user.id, name: user.name });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    console.error('[SocialBridge Auth]', msg);
    return jsonWithCors({ error: msg }, { status: 500 });
  }
}
