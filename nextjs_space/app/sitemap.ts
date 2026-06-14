import { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers()
  const host = headersList.get('x-forwarded-host') || 'octopuskills.com'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const siteUrl = `${protocol}://${host}`

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${siteUrl}/pricing`,
      lastModified: new Date('2026-04-14'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${siteUrl}/login`,
      lastModified: new Date('2026-04-06'),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${siteUrl}/legal`,
      lastModified: new Date('2026-03-22'),
      changeFrequency: 'yearly',
      priority: 0.2,
    },
  ]

  // Dynamic blog articles from database
  let blogPages: MetadataRoute.Sitemap = []
  try {
    const articles = await prisma.octoBlogPost.findMany({
      where: { status: 'published' },
      select: {
        slug: true,
        updatedAt: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
    })

    blogPages = articles.map((article) => ({
      url: `${siteUrl}/blog/${article.slug}`,
      lastModified: article.updatedAt || article.publishedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
  } catch (err) {
    console.error('[Sitemap] Error fetching blog articles:', err)
  }

  return [...staticPages, ...blogPages]
}
