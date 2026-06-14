export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import dns from 'dns/promises'

// ────────────────────────────────────────────────────────────────────────────
// POST — save/update custom domain for a site
// GET  — verify DNS + provision SSL
// DELETE — remove custom domain
// ────────────────────────────────────────────────────────────────────────────

const ALLOWED_CNAME_TARGETS = ['octopuskills.com', 'octopuskills.com.']

function isValidDomain(d: string): boolean {
  // Must be a subdomain (has at least one dot separating labels)
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)
}

// ── POST: Save custom domain ──
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { siteId, domain } = (await req.json()) as { siteId?: string; domain?: string }
    if (!siteId || !domain) return NextResponse.json({ error: 'siteId and domain required' }, { status: 400 })

    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')

    if (!isValidDomain(cleanDomain)) {
      return NextResponse.json({ error: 'Invalid domain format. Use a subdomain like blog.miempresa.com' }, { status: 400 })
    }

    // Block octopuskills.com subdomains — those are auto-managed
    if (cleanDomain.endsWith('.octopuskills.com')) {
      return NextResponse.json({ error: 'Cannot use octopuskills.com subdomains as custom domains' }, { status: 400 })
    }

    // Verify ownership
    const site = await prisma.hostedSite.findFirst({
      where: { id: siteId, userId: session.user.id },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    // Check if domain is already taken by another site
    const existing = await prisma.hostedSite.findUnique({ where: { customDomain: cleanDomain } })
    if (existing && existing.id !== siteId) {
      return NextResponse.json({ error: 'Domain already in use by another site' }, { status: 409 })
    }

    // Save domain with pending status
    await prisma.hostedSite.update({
      where: { id: siteId },
      data: { customDomain: cleanDomain, domainStatus: 'pending' },
    })

    return NextResponse.json({
      success: true,
      domain: cleanDomain,
      status: 'pending',
      instructions: {
        type: 'CNAME',
        host: cleanDomain,
        target: 'octopuskills.com',
      },
    })
  } catch (e: unknown) {
    console.error('[Domain] POST error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── GET: Verify DNS configuration ──
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const siteId = req.nextUrl.searchParams.get('siteId')
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

    const site = await prisma.hostedSite.findFirst({
      where: { id: siteId, userId: session.user.id },
      select: { id: true, slug: true, customDomain: true, domainStatus: true },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    if (!site.customDomain) {
      return NextResponse.json({ success: true, domain: null, status: null })
    }

    // DNS verification
    let dnsVerified = false
    let dnsRecords: string[] = []
    let dnsError: string | null = null

    try {
      const cnames = await dns.resolveCname(site.customDomain)
      dnsRecords = cnames
      dnsVerified = cnames.some(c => ALLOWED_CNAME_TARGETS.includes(c.toLowerCase()))
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'ENODATA' || code === 'ENOTFOUND') {
        dnsError = 'No CNAME record found'
      } else {
        dnsError = `DNS lookup failed: ${code || 'unknown'}`
      }
    }

    // Update status in DB
    const newStatus = dnsVerified ? 'verified' : (dnsError ? 'error' : 'pending')
    if (site.domainStatus !== newStatus) {
      await prisma.hostedSite.update({
        where: { id: siteId },
        data: { domainStatus: newStatus },
      })
    }

    // If verified, provision SSL cert on VPS (fire-and-forget)
    if (dnsVerified && site.domainStatus !== 'verified') {
      const certApiUrl = process.env.VPS_CERT_API_URL
      const certApiKey = process.env.VPS_CERT_API_KEY
      if (certApiUrl && certApiKey) {
        // Use the custom-domain endpoint
        const apiBase = certApiUrl.replace(/\/provision-cert\/?$/, '')
        fetch(`${apiBase}/custom-domain`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${certApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ domain: site.customDomain, slug: site.slug }),
          signal: AbortSignal.timeout(30000),
        }).then(r => r.json()).then(d => {
          console.log(`[Domain] SSL provision for ${site.customDomain}: ${d.status}`)
        }).catch(err => {
          console.warn(`[Domain] SSL provision failed for ${site.customDomain}:`, err.message)
        })
      }
    }

    return NextResponse.json({
      success: true,
      domain: site.customDomain,
      status: newStatus,
      dnsVerified,
      dnsRecords,
      dnsError,
      instructions: {
        type: 'CNAME',
        host: site.customDomain,
        target: 'octopuskills.com',
      },
    })
  } catch (e: unknown) {
    console.error('[Domain] GET error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ── DELETE: Remove custom domain ──
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { siteId } = (await req.json()) as { siteId?: string }
    if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 })

    const site = await prisma.hostedSite.findFirst({
      where: { id: siteId, userId: session.user.id },
    })
    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 })

    await prisma.hostedSite.update({
      where: { id: siteId },
      data: { customDomain: null, domainStatus: null },
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error('[Domain] DELETE error', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
