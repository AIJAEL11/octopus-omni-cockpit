export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ────────────────────────────────────────────────────────────────────────────
// GET — public endpoint: returns latest published community sites for landing
// ────────────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sites = await prisma.hostedSite.findMany({
      where: { status: 'active', fileCount: { gte: 1 } },
      orderBy: { updatedAt: 'desc' },
      take: 6,
      select: {
        id: true,
        slug: true,
        name: true,
        fileCount: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com'
    const result = sites.map(s => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      fileCount: s.fileCount,
      createdAt: s.createdAt,
      author: s.user?.name || 'Octopus User',
      url: `${baseUrl}/sites/${s.slug}`,
    }))

    return NextResponse.json({ sites: result })
  } catch (e: unknown) {
    console.error('[CommunitySites] GET error', e)
    return NextResponse.json({ sites: [] })
  }
}
