import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const category = url.searchParams.get('category')
    const language = url.searchParams.get('lang') || 'en'
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)

    const where: Record<string, unknown> = { status: 'published' }
    if (category && category !== 'all') where.category = category
    if (language) where.language = language
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { keyword: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [posts, total] = await Promise.all([
      prisma.octoBlogPost.findMany({
        where: where as any,
        select: {
          id: true, title: true, slug: true, excerpt: true, metaDescription: true,
          coverImage: true, category: true, language: true, author: true,
          readTime: true, wordCount: true, seriesTheme: true, seriesPosition: true,
          publishedAt: true, views: true,
        },
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.octoBlogPost.count({ where: where as any }),
    ])

    return NextResponse.json({ posts, total, page, limit, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[Blog API] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}
