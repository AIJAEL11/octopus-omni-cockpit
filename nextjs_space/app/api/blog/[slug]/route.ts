import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const post = await prisma.octoBlogPost.findUnique({
      where: { slug: params.slug },
    })

    if (!post || post.status !== 'published') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Increment views
    await prisma.octoBlogPost.update({
      where: { id: post.id },
      data: { views: { increment: 1 } },
    }).catch(() => {})

    // Get related posts from same series or category
    const relatedPosts = await prisma.octoBlogPost.findMany({
      where: {
        status: 'published',
        id: { not: post.id },
        OR: [
          ...(post.seriesId ? [{ seriesId: post.seriesId }] : []),
          { category: post.category },
        ],
      },
      select: { title: true, slug: true, coverImage: true, excerpt: true, readTime: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 3,
    })

    return NextResponse.json({ post, relatedPosts })
  } catch (err) {
    console.error('[Blog API] Slug error:', err)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}
