import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { BlogArticleClient } from './blog-article-client'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.octoBlogPost.findUnique({
    where: { slug: params.slug },
    select: { title: true, metaDescription: true, excerpt: true, coverImage: true, keyword: true },
  })

  if (!post) return { title: 'Post Not Found' }

  return {
    title: post.title,
    description: post.metaDescription || post.excerpt || '',
    keywords: post.keyword ? [post.keyword] : [],
    openGraph: {
      title: post.title,
      description: post.metaDescription || post.excerpt || '',
      type: 'article',
      ...(post.coverImage ? { images: [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription || post.excerpt || '',
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const post = await prisma.octoBlogPost.findUnique({
    where: { slug: params.slug },
  })

  if (!post || post.status !== 'published') notFound()

  // Increment views
  await prisma.octoBlogPost.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  }).catch(() => {})

  // Get related posts
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

  const postData = {
    ...post,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }

  const relatedData = relatedPosts.map(r => ({
    ...r,
    publishedAt: r.publishedAt?.toISOString() || null,
  }))

  return <BlogArticleClient post={postData} relatedPosts={relatedData} />
}
