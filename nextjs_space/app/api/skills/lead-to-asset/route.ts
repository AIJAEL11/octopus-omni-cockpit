// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/skills/lead-to-asset — Mega Skill: Lead-to-Asset
// GET  /api/skills/lead-to-asset?processId=xxx — Check process status
// GET  /api/skills/lead-to-asset — List user processes
// ═══════════════════════════════════════════════════════════════════════════════

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  executeLeadToAsset,
  getProcessStatus,
  listUserProcesses,
  type LeadToAssetRequest,
} from '@/lib/skills/lead-to-asset-service';

// ─── POST: Execute Lead-to-Asset ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate required fields
    if (!body.lead || !body.lead.name) {
      return NextResponse.json(
        { error: 'Missing required field: lead.name' },
        { status: 400 }
      );
    }

    // IRON RULE: Brand DNA is mandatory — brandName must be provided
    if (!body.brand || !body.brand.name || !body.brand.name.trim()) {
      return NextResponse.json(
        { error: 'Brand DNA obligatorio: debes proporcionar el nombre de tu marca en Brand DNA antes de ejecutar.' },
        { status: 400 }
      );
    }

    const request: LeadToAssetRequest = {
      lead: {
        name: body.lead.name,
        email: body.lead.email,
        phone: body.lead.phone,
        company: body.lead.company,
        city: body.lead.city,
        customFields: body.lead.customFields,
      },
      brand: {
        name: body.brand.name.trim(),
        description: body.brand.description || undefined,
        productDescription: body.brand.productDescription || undefined,
        tone: body.brand.tone || undefined,
        audience: body.brand.audience || undefined,
      },
      objective: body.objective || undefined,
      objectiveCustom: body.objectiveCustom || undefined,
      assetType: body.assetType || 'video',
      videoTemplateId: body.videoTemplateId,
      language: body.language || 'es',
      sendEmail: body.sendEmail || false,
      emailTemplateId: body.emailTemplateId,
      projectName: body.projectName,
      metadata: body.metadata,
    };

    console.log(`[Lead-to-Asset] 🚀 New request from user=${session.user.id} lead="${request.lead.name}" type=${request.assetType}`);

    const result = await executeLeadToAsset(session.user.id, request);

    return NextResponse.json(result, { status: 202 });

  } catch (error: unknown) {
    console.error('[Lead-to-Asset] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ─── GET: Check process status or list all ───────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const processId = searchParams.get('processId');

    if (processId) {
      // Get specific process
      const process = await getProcessStatus(processId, session.user.id);
      if (!process) {
        return NextResponse.json({ error: 'Process not found' }, { status: 404 });
      }
      return NextResponse.json(process);
    }

    // List all processes
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const processes = await listUserProcesses(session.user.id, limit);
    return NextResponse.json({ processes, total: processes.length });

  } catch (error: unknown) {
    console.error('[Lead-to-Asset] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
