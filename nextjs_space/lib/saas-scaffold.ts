/**
 * SaaS Scaffold — generador determinístico de proyectos SaaS full-stack.
 *
 * Fase 3 del Code Engine. En vez de pedirle al LLM que genere todo el
 * boilerplate (lento y propenso a errores), inyectamos un esqueleto Next.js 14
 * + Prisma + NextAuth + Stripe ya cableado y FUNCIONAL. El AI construye solo la
 * lógica de negocio encima.
 *
 * Decisión clave para WebContainers: la base de datos es SQLite
 * (file:./dev.db) — corre 100% en el navegador sin servidor de Postgres. El
 * script `dev` ejecuta `prisma generate && prisma db push` antes de `next dev`,
 * así el runtime arranca con el esquema aplicado.
 *
 * SEGURIDAD: este archivo NO contiene secretos reales. Genera placeholders
 * (.env con valores de ejemplo) que el usuario reemplaza. Ningún secreto del
 * OCTOPUS pasa al proyecto generado.
 */

export interface ScaffoldOptions {
  /** Nombre legible de la app (ej. "Acme SaaS"). */
  appName?: string
  /** Color de acento hex (default violeta #8B5CF6). */
  accent?: string
  /** Autenticación con NextAuth (credenciales email+password, Prisma adapter). */
  auth?: boolean
  /** Base de datos Prisma + SQLite (requerida si auth o payments). */
  database?: boolean
  /** Pagos con Stripe (checkout + webhook + página de precios). */
  payments?: boolean
}

export interface ScaffoldFile {
  path: string
  content: string
}

const DEFAULTS: Required<ScaffoldOptions> = {
  appName: 'Acme SaaS',
  accent: '#8B5CF6',
  auth: true,
  database: true,
  payments: false,
}

/** Convierte un nombre a un slug npm-válido. */
function pkgName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'saas-app'
}

/**
 * Genera el árbol completo de archivos del scaffold.
 * Devuelve un Record<path, content> listo para ce_write_files / WebContainers.
 */
export function buildSaasScaffold(opts: ScaffoldOptions = {}): Record<string, string> {
  const o = { ...DEFAULTS, ...opts }
  // payments y auth requieren base de datos
  if (o.payments || o.auth) o.database = true

  const name = o.appName
  const slug = pkgName(name)
  const accent = o.accent
  const files: Record<string, string> = {}

  /* ── package.json ──────────────────────────────────────────────────────── */
  const deps: Record<string, string> = {
    next: '14.2.5',
    react: '18.3.1',
    'react-dom': '18.3.1',
  }
  const devDeps: Record<string, string> = {
    typescript: '5.5.4',
    '@types/node': '20.14.12',
    '@types/react': '18.3.3',
    '@types/react-dom': '18.3.0',
    tailwindcss: '3.4.7',
    postcss: '8.4.40',
    autoprefixer: '10.4.19',
  }
  if (o.database) {
    deps['@prisma/client'] = '5.18.0'
    devDeps['prisma'] = '5.18.0'
  }
  if (o.auth) {
    deps['next-auth'] = '4.24.7'
    deps['@auth/prisma-adapter'] = '2.4.2'
    deps['bcryptjs'] = '2.4.3'
    devDeps['@types/bcryptjs'] = '2.4.6'
  }
  if (o.payments) {
    deps['stripe'] = '16.6.0'
  }

  // El script dev prepara Prisma antes de Next (clave para WebContainers).
  const devScript = o.database
    ? 'prisma generate && prisma db push --skip-generate && next dev'
    : 'next dev'

  files['package.json'] = JSON.stringify({
    name: slug,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: devScript,
      build: o.database ? 'prisma generate && next build' : 'next build',
      start: 'next start',
      ...(o.database ? { postinstall: 'prisma generate' } : {}),
    },
    dependencies: deps,
    devDependencies: devDeps,
  }, null, 2) + '\n'

  /* ── Configuración base ────────────────────────────────────────────────── */
  files['next.config.js'] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}
module.exports = nextConfig
`

  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./*'] },
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules'],
  }, null, 2) + '\n'

  files['postcss.config.js'] = `module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
`

  files['tailwind.config.ts'] = `import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { accent: '${accent}' },
    },
  },
  plugins: [],
}
export default config
`

  files['next-env.d.ts'] = `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`

  files['.gitignore'] = `node_modules
.next
.env
*.db
*.db-journal
`

  /* ── .env (placeholders, sin secretos reales) ──────────────────────────── */
  const envLines: string[] = []
  if (o.database) envLines.push('DATABASE_URL="file:./dev.db"')
  if (o.auth) {
    envLines.push('NEXTAUTH_URL="http://localhost:3000"')
    envLines.push('NEXTAUTH_SECRET="dev-secret-change-me-in-production-min-32-chars"')
  }
  if (o.payments) {
    envLines.push('STRIPE_SECRET_KEY="sk_test_replace_me"')
    envLines.push('STRIPE_WEBHOOK_SECRET="whsec_replace_me"')
    envLines.push('NEXT_PUBLIC_STRIPE_PRICE_ID="price_replace_me"')
  }
  files['.env'] = envLines.join('\n') + '\n'
  files['.env.example'] = envLines.join('\n') + '\n'

  /* ── Prisma schema ─────────────────────────────────────────────────────── */
  if (o.database) {
    const models: string[] = []
    if (o.auth) {
      models.push(`model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  passwordHash  String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  accounts      Account[]
  sessions      Session[]${o.payments ? `
  stripeCustomerId    String?
  stripeSubscription  String?
  plan                String   @default("free")` : ''}
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime
  @@unique([identifier, token])
}`)
    }
    // Modelo de ejemplo de negocio (siempre presente)
    models.push(`model Item {
  id          String   @id @default(cuid())
  title       String
  description String?
  createdAt   DateTime @default(now())
}`)

    files['prisma/schema.prisma'] = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

${models.join('\n\n')}
`

    files['lib/prisma.ts'] = `import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
`
  }

  /* ── Auth (NextAuth credenciales) ──────────────────────────────────────── */
  if (o.auth) {
    files['lib/auth.ts'] = `import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({ where: { email: credentials.email } })
        if (!user?.passwordHash) return null
        const ok = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!ok) return null
        return { id: user.id, email: user.email, name: user.name }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) (session.user as any).id = token.id as string
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
`

    files['app/api/auth/[...nextauth]/route.ts'] = `import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
`

    files['app/api/register/route.ts'] = `import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json()
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Email y contraseña (mín. 6) requeridos' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 409 })
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ data: { email, name: name || null, passwordHash } })
    return NextResponse.json({ id: user.id, email: user.email })
  } catch {
    return NextResponse.json({ error: 'Error al registrar' }, { status: 500 })
  }
}
`

    files['components/auth-provider.tsx'] = `'use client'
import { SessionProvider } from 'next-auth/react'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
`

    files['app/login/page.tsx'] = `'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError('Credenciales inválidas')
    else router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-2xl font-bold text-white">Iniciar sesión</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <input className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white" type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
        <button disabled={loading} className="w-full rounded-lg py-3 font-semibold text-white" style={{ background: '${accent}' }}>
          {loading ? '...' : 'Entrar'}
        </button>
        <p className="text-center text-sm text-slate-400">¿No tienes cuenta? <Link href="/register" className="text-white underline">Regístrate</Link></p>
      </form>
    </main>
  )
}
`

    files['app/register/page.tsx'] = `'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Error al registrar'); setLoading(false); return
    }
    await signIn('credentials', { email, password, redirect: false })
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <input className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white" placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} />
        <input className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg bg-slate-800 px-4 py-3 text-white" type="password" placeholder="Contraseña (mín. 6)" value={password} onChange={e => setPassword(e.target.value)} required />
        <button disabled={loading} className="w-full rounded-lg py-3 font-semibold text-white" style={{ background: '${accent}' }}>
          {loading ? '...' : 'Crear cuenta'}
        </button>
        <p className="text-center text-sm text-slate-400">¿Ya tienes cuenta? <Link href="/login" className="text-white underline">Inicia sesión</Link></p>
      </form>
    </main>
  )
}
`

    files['app/dashboard/page.tsx'] = `import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { signOutAction } from './actions'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')

  return (
    <main className="min-h-screen bg-slate-950 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <form action={signOutAction}>
            <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Salir</button>
          </form>
        </div>
        <p className="mt-4 text-slate-400">Hola, {session.user.name || session.user.email} 👋</p>
        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
          <h2 className="text-xl font-semibold text-white">Tu área protegida</h2>
          <p className="mt-2 text-slate-400">Construye aquí la lógica de tu SaaS. La autenticación, la base de datos${o.payments ? ' y los pagos' : ''} ya están cableados.</p>
        </div>
      </div>
    </main>
  )
}
`

    files['app/dashboard/actions.ts'] = `'use server'
import { redirect } from 'next/navigation'

// Sign-out vía la ruta de NextAuth (la sesión JWT se limpia ahí).
export async function signOutAction() {
  redirect('/api/auth/signout')
}
`

    files['middleware.ts'] = `export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*'],
}
`
  }

  /* ── Pagos (Stripe) ────────────────────────────────────────────────────── */
  if (o.payments) {
    files['lib/stripe.ts'] = `import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-06-20',
})
`

    files['app/api/checkout/route.ts'] = `import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const origin = req.headers.get('origin') || 'http://localhost:3000'
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: \`\${origin}/dashboard?checkout=success\`,
      cancel_url: \`\${origin}/pricing?checkout=cancel\`,
      customer_email: session.user.email || undefined,
    })
    return NextResponse.json({ url: checkout.url })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error de checkout' }, { status: 500 })
  }
}
`

    files['app/api/webhooks/stripe/route.ts'] = `import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET || '')
  } catch (err: any) {
    return NextResponse.json({ error: \`Webhook inválido: \${err.message}\` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as any
    if (s.customer_email) {
      await prisma.user.updateMany({
        where: { email: s.customer_email },
        data: { plan: 'pro', stripeCustomerId: s.customer as string },
      })
    }
  }
  return NextResponse.json({ received: true })
}
`

    files['app/pricing/page.tsx'] = `'use client'
import { useState } from 'react'

export default function PricingPage() {
  const [loading, setLoading] = useState(false)
  async function subscribe() {
    setLoading(true)
    const res = await fetch('/api/checkout', { method: 'POST' })
    const d = await res.json()
    if (d.url) window.location.href = d.url
    else setLoading(false)
  }
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-20">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <h1 className="text-3xl font-bold text-white">Plan Pro</h1>
        <p className="mt-2 text-slate-400">Todo lo que necesitas para escalar.</p>
        <p className="mt-6 text-5xl font-extrabold text-white">$29<span className="text-lg text-slate-400">/mes</span></p>
        <button onClick={subscribe} disabled={loading} className="mt-8 w-full rounded-xl py-3 font-semibold text-white" style={{ background: '${accent}' }}>
          {loading ? '...' : 'Suscribirme'}
        </button>
      </div>
    </main>
  )
}
`
  }

  /* ── Layout + landing (siempre) ────────────────────────────────────────── */
  files['app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

body { background: #050510; color: #fff; }
`

  const layoutBody = o.auth
    ? `<AuthProvider>{children}</AuthProvider>`
    : `{children}`
  const layoutImport = o.auth ? `import AuthProvider from '@/components/auth-provider'\n` : ''

  files['app/layout.tsx'] = `import type { Metadata } from 'next'
import './globals.css'
${layoutImport}
export const metadata: Metadata = {
  title: '${name}',
  description: '${name} — built with the OCTOPUS Code Engine',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>${layoutBody}</body>
    </html>
  )
}
`

  const ctaLinks = o.auth
    ? `        <a href="/register" className="rounded-full px-6 py-3 font-semibold text-white" style={{ background: '${accent}' }}>Empezar gratis</a>
        <a href="/login" className="rounded-full border border-slate-700 px-6 py-3 font-semibold text-white">Iniciar sesión</a>`
    : `        <a href="#" className="rounded-full px-6 py-3 font-semibold text-white" style={{ background: '${accent}' }}>Empezar</a>`

  files['app/page.tsx'] = `export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-4 text-center">
      <span className="rounded-full border border-slate-700 px-4 py-1 text-xs uppercase tracking-widest text-slate-300">
        ⚡ Powered by OCTOPUS Code Engine
      </span>
      <h1 className="max-w-3xl text-5xl font-extrabold leading-tight md:text-6xl">
        ${name}
        <span className="block bg-gradient-to-r from-white to-[${accent}] bg-clip-text text-transparent">
          tu SaaS, listo para escalar
        </span>
      </h1>
      <p className="max-w-xl text-lg text-slate-400">
        Base full-stack con ${[o.auth && 'autenticación', o.database && 'base de datos', o.payments && 'pagos'].filter(Boolean).join(', ')} ya cableados. Construye solo lo que te hace único.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
${ctaLinks}
      </div>
    </main>
  )
}
`

  /* ── README ────────────────────────────────────────────────────────────── */
  files['README.md'] = `# ${name}

Generado por el **OCTOPUS Code Engine** (scaffold determinístico Fase 3).

## Stack
- Next.js 14 (App Router)
${o.database ? '- Prisma + SQLite (corre en el navegador vía WebContainers)\n' : ''}${o.auth ? '- NextAuth (credenciales email + password)\n' : ''}${o.payments ? '- Stripe (checkout de suscripción + webhook)\n' : ''}- Tailwind CSS

## Desarrollo
\`\`\`bash
npm install
npm run dev
\`\`\`
${o.database ? '\nEl script `dev` ejecuta `prisma generate && prisma db push` automáticamente antes de arrancar Next.\n' : ''}
## Rutas
- \`/\` — landing
${o.auth ? '- `/register`, `/login` — auth\n- `/dashboard` — área protegida (middleware)\n' : ''}${o.payments ? '- `/pricing` — suscripción Stripe\n' : ''}
> Reemplaza los valores de \`.env\` por tus credenciales reales antes de producción.
`

  return files
}

/** Devuelve el scaffold como array de archivos (para ce_write_files). */
export function buildSaasScaffoldFiles(opts: ScaffoldOptions = {}): ScaffoldFile[] {
  const map = buildSaasScaffold(opts)
  return Object.entries(map).map(([path, content]) => ({ path, content }))
}
