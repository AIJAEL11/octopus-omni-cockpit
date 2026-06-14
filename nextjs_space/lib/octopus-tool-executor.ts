/**
 * OCTOPUS Tool Executor v1.0
 * 
 * The "engine" of the race car.
 * Executes tool calls from the LLM and returns REAL results.
 * No hallucination possible — every result comes from the actual database or API.
 * 
 * Architecture:
 * - Growth Engine tools: Direct Prisma queries (fast, no HTTP overhead)
 * - Google Workspace: Delegates to /api/brazos/google/* endpoints
 * - Creative/Media: Returns action descriptor for frontend execution
 * - System: Direct execution (navigation returns route, theme returns command)
 */

import { prisma } from '@/lib/prisma'
import { checkPlanGate } from '@/lib/plan-gate'
import { assessSkillCode } from '@/lib/skill-validation'

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  /** Human-readable summary for the LLM to include in its response */
  summary: string
  /** If the tool produces a UI action the frontend should execute */
  frontendAction?: {
    type: string
    payload: Record<string, unknown>
  }
}

/**
 * Execute a tool call and return the result.
 * This is the single entry point for all tool execution.
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  try {
    console.log(`[Tool Executor] Executing: ${toolName}`, JSON.stringify(args).substring(0, 200))
    
    // Route to the appropriate handler
    // IMPORTANT: specific growth tools BEFORE the generic growth_ prefix handler
    if (toolName === 'growth_prospect_web') return executeGrowthProspectWeb(toolName, args, userId)
    if (toolName.startsWith('growth_')) return executeGrowthTool(toolName, args, userId)
    if (toolName.startsWith('gmail_') || toolName.startsWith('calendar_')) return executeGoogleTool(toolName, args, userId)
    if (toolName.startsWith('generate_')) return executeCreativeTool(toolName, args, userId)
    if (toolName.startsWith('browser_')) return executeBrowserTool(toolName, args, userId)
    if (toolName === 'navigate_to') return executeNavigate(args)
    if (toolName === 'toggle_theme') return executeThemeToggle(args)
    if (toolName === 'web_search') return executeWebSearch(args)
    if (toolName === 'introspect_system') return executeIntrospect(args, userId)
    if (toolName === 'iot_control_device') return executeIoT(args, userId)
    if (toolName === 'social_publish_linkedin') return executeSocial(toolName, args, userId)
    if (toolName === 'content_publish_blog') return executeContentPublish(args, userId)
    if (toolName.startsWith('create_') || toolName === 'delegate_to_agent') return executeCreation(toolName, args, userId)
    
    return { success: false, error: `Unknown tool: ${toolName}`, summary: `Herramienta desconocida: ${toolName}` }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Tool Executor] Error in ${toolName}:`, msg)
    return { success: false, error: msg, summary: `Error ejecutando ${toolName}: ${msg}` }
  }
}

// ═══════════════════════════════════════════════════════════════
// GROWTH ENGINE EXECUTOR — Direct Prisma queries
// ═══════════════════════════════════════════════════════════════

async function executeGrowthTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  switch (toolName) {
    // ===== LIST LEADS =====
    case 'growth_list_leads': {
      const where: Record<string, unknown> = { userId }
      if (args.status) where.status = args.status
      if (args.source) where.leadSource = args.source
      
      const limit = Math.min(Number(args.limit) || 25, 100)
      const leads = await prisma.growthLead.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, businessName: true, contactName: true, email: true,
          status: true, priority: true, city: true, leadSource: true,
          qualificationScore: true, createdAt: true, lastContactedAt: true,
          emailBounced: true, followUpCount: true,
        },
      })
      
      const total = await prisma.growthLead.count({ where: { userId } })
      
      return {
        success: true,
        data: { leads, total, returned: leads.length },
        summary: `Pipeline: ${total} leads total, mostrando ${leads.length}. Estados: ${Object.entries(leads.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {} as Record<string, number>)).map(([k, v]) => `${k}:${v}`).join(', ')}`,
      }
    }
    
    // ===== GET STATS =====
    case 'growth_get_stats': {
      const [total, byStatus, campaigns, actions] = await Promise.all([
        prisma.growthLead.count({ where: { userId } }),
        prisma.growthLead.groupBy({ by: ['status'], where: { userId }, _count: true }),
        prisma.campaign.findMany({ where: { userId }, select: { id: true, name: true, status: true, sentCount: true, replyCount: true, totalLeads: true } }),
        prisma.growthAction.count({ where: { userId, status: 'pending' } }),
      ])
      
      const statusMap = Object.fromEntries(byStatus.map(s => [s.status, s._count]))
      
      return {
        success: true,
        data: { total, byStatus: statusMap, campaigns, pendingActions: actions },
        summary: `Pipeline: ${total} leads (new:${statusMap.new || 0}, contacted:${statusMap.contacted || 0}, qualified:${statusMap.qualified || 0}, converted:${statusMap.converted || 0}). ${campaigns.length} campañas. ${actions} acciones pendientes.`,
      }
    }
    
    // ===== DEDUPLICATE LEADS =====
    case 'growth_deduplicate_leads': {
      const dryRun = args.dry_run !== false
      
      // Find duplicates by email
      const allLeads = await prisma.growthLead.findMany({
        where: { userId, email: { not: null } },
        select: { id: true, email: true, businessName: true, contactName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      })
      
      // Group by email
      const emailGroups: Record<string, typeof allLeads> = {}
      for (const lead of allLeads) {
        if (!lead.email) continue
        const key = lead.email.toLowerCase()
        if (!emailGroups[key]) emailGroups[key] = []
        emailGroups[key].push(lead)
      }
      
      // Find groups with >1 entry
      const duplicates = Object.entries(emailGroups)
        .filter(([, leads]) => leads.length > 1)
        .map(([email, leads]) => ({
          email,
          count: leads.length,
          keep: leads[0], // Most recent (ordered by createdAt desc)
          remove: leads.slice(1),
        }))
      
      if (duplicates.length === 0) {
        return { success: true, data: { duplicates: [] }, summary: 'No se encontraron leads duplicados. Pipeline limpio.' }
      }
      
      if (dryRun) {
        return {
          success: true,
          data: {
            duplicates: duplicates.map(d => ({
              email: d.email,
              count: d.count,
              keepId: d.keep.id,
              removeIds: d.remove.map(r => r.id),
            })),
            totalDuplicates: duplicates.reduce((acc, d) => acc + d.remove.length, 0),
          },
          summary: `Encontré ${duplicates.length} emails duplicados (${duplicates.reduce((acc, d) => acc + d.remove.length, 0)} leads a eliminar): ${duplicates.map(d => `${d.email} (${d.count}x)`).join(', ')}. Usa dry_run=false para eliminarlos.`,
        }
      }
      
      // Actually delete duplicates
      const idsToDelete = duplicates.flatMap(d => d.remove.map(r => r.id))
      
      // First delete related records
      await prisma.growthAction.deleteMany({ where: { leadId: { in: idsToDelete } } })
      await prisma.campaignLead.deleteMany({ where: { leadId: { in: idsToDelete } } })
      await prisma.growthMessage.deleteMany({ where: { leadId: { in: idsToDelete } } }).catch(() => { /* table might not exist */ })
      
      // Then delete the leads
      const deleted = await prisma.growthLead.deleteMany({ where: { id: { in: idsToDelete } } })
      
      return {
        success: true,
        data: { deletedCount: deleted.count, duplicateGroups: duplicates.length },
        summary: `Eliminados ${deleted.count} leads duplicados de ${duplicates.length} grupos. Pipeline limpio.`,
      }
    }
    
    // ===== CREATE LEAD =====
    case 'growth_create_lead': {
      const lead = await prisma.growthLead.create({
        data: {
          userId,
          businessName: (args.businessName as string) || 'Sin nombre',
          contactName: args.contactName as string || undefined,
          email: args.email as string || undefined,
          businessType: args.businessType as string || undefined,
          phone: args.phone as string || undefined,
          city: args.city as string || undefined,
          notes: args.notes as string || undefined,
          leadSource: args.leadSource as string || 'manual',
          status: 'new',
        },
      })
      return {
        success: true,
        data: { id: lead.id, businessName: lead.businessName, email: lead.email },
        summary: `Lead creado: ${lead.businessName} (${lead.email || 'sin email'}). ID: ${lead.id}`,
      }
    }
    
    // ===== RESEARCH LEAD =====
    case 'growth_research_lead': {
      // Find the lead
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lead: any = null
      if (args.leadId) {
        lead = await prisma.growthLead.findFirst({ where: { id: args.leadId as string, userId } })
      } else if (args.email) {
        lead = await prisma.growthLead.findFirst({ where: { email: args.email as string, userId } })
      } else if (args.name) {
        lead = await prisma.growthLead.findFirst({
          where: { userId, OR: [{ contactName: { contains: args.name as string } }, { businessName: { contains: args.name as string } }] },
        })
      }
      
      if (!lead) {
        return { success: false, summary: 'Lead no encontrado. Verifica el ID, email o nombre.' }
      }
      
      // Return lead data for the LLM to analyze
      return {
        success: true,
        data: lead,
        summary: `Lead encontrado: ${lead.businessName} - ${lead.contactName || 'Sin contacto'} (${lead.email || 'sin email'}). Estado: ${lead.status}, Score: ${lead.qualificationScore}, Ciudad: ${lead.city || 'N/A'}, Fuente: ${lead.leadSource || 'N/A'}. Notas: ${lead.notes || 'ninguna'}.`,
      }
    }
    
    // ===== LIST CAMPAIGNS =====
    case 'growth_list_campaigns': {
      const where: Record<string, unknown> = { userId }
      if (args.status) where.status = args.status
      
      const campaigns = await prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, status: true, campaignType: true,
          totalLeads: true, sentCount: true, replyCount: true, convertedCount: true,
          createdAt: true, startedAt: true,
        },
      })
      
      return {
        success: true,
        data: { campaigns },
        summary: campaigns.length > 0
          ? `${campaigns.length} campañas: ${campaigns.map(c => `"${c.name}" (${c.status}, ${c.totalLeads} leads, ${c.sentCount} enviados, ${c.replyCount} respuestas)`).join('; ')}`
          : 'No hay campañas creadas aún.',
      }
    }
    
    // ===== CREATE CAMPAIGN =====
    case 'growth_create_campaign': {
      const campaign = await prisma.campaign.create({
        data: {
          userId,
          name: (args.name as string) || 'Nueva Campaña',
          campaignType: (args.campaignType as string) || 'outreach',
          description: args.description as string || undefined,
          emailSubject: args.emailSubject as string || undefined,
          emailTemplate: args.emailTemplate as string || undefined,
          status: 'draft',
        },
      })
      return {
        success: true,
        data: { id: campaign.id, name: campaign.name, status: campaign.status },
        summary: `Campaña "${campaign.name}" creada (${campaign.campaignType}, status: draft). ID: ${campaign.id}`,
      }
    }
    
    // ===== ASSIGN LEADS TO CAMPAIGN =====
    case 'growth_assign_leads_to_campaign': {
      // Find campaign
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let campaign: any = null
      if (args.campaignId && args.campaignId !== 'auto') {
        campaign = await prisma.campaign.findFirst({ where: { id: args.campaignId as string, userId } })
      } else if (args.campaignName) {
        campaign = await prisma.campaign.findFirst({
          where: { userId, name: { contains: args.campaignName as string, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
        })
      } else {
        // Auto: most recent draft
        campaign = await prisma.campaign.findFirst({
          where: { userId, status: 'draft' },
          orderBy: { createdAt: 'desc' },
        })
      }
      
      if (!campaign) {
        return { success: false, summary: 'No se encontró la campaña. Crea una primero o especifica el nombre/ID.' }
      }
      
      const count = Math.min(Number(args.count) || 25, 200)
      const leadStatus = (args.status as string) || 'new'
      
      // Find leads not yet in this campaign
      const existingLeadIds = await prisma.campaignLead.findMany({
        where: { campaignId: campaign.id },
        select: { leadId: true },
      })
      const excludeIds = new Set(existingLeadIds.map(cl => cl.leadId))
      
      const leads = await prisma.growthLead.findMany({
        where: { userId, status: leadStatus, id: { notIn: Array.from(excludeIds) } },
        take: count,
        orderBy: { qualificationScore: 'desc' },
        select: { id: true },
      })
      
      if (leads.length === 0) {
        return { success: false, summary: `No hay leads con estado "${leadStatus}" disponibles para asignar.` }
      }
      
      // Create campaign-lead associations
      await prisma.campaignLead.createMany({
        data: leads.map(l => ({ campaignId: campaign!.id, leadId: l.id })),
        skipDuplicates: true,
      })
      
      // Update campaign totalLeads
      const newTotal = await prisma.campaignLead.count({ where: { campaignId: campaign.id } })
      await prisma.campaign.update({ where: { id: campaign.id }, data: { totalLeads: newTotal } })
      
      return {
        success: true,
        data: { campaignId: campaign.id, campaignName: campaign.name, assignedCount: leads.length, totalLeads: newTotal },
        summary: `${leads.length} leads asignados a "${campaign.name}". Total en campaña: ${newTotal}.`,
      }
    }
    
    // ===== ACTIVATE CAMPAIGN =====
    case 'growth_activate_campaign': {
      // This is complex (generates AI emails) — delegate to the internal API
      // For Fase 1, return action descriptor for frontend
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let campaign: any = null
      if (args.campaignId && args.campaignId !== 'auto') {
        campaign = await prisma.campaign.findFirst({ where: { id: args.campaignId as string, userId } })
      } else if (args.campaignName) {
        campaign = await prisma.campaign.findFirst({
          where: { userId, name: { contains: args.campaignName as string, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
        })
      } else {
        campaign = await prisma.campaign.findFirst({ where: { userId, status: 'draft' }, orderBy: { createdAt: 'desc' } })
      }
      
      if (!campaign) {
        return { success: false, summary: 'No se encontró la campaña para activar.' }
      }
      
      const leadsInCampaign = await prisma.campaignLead.count({ where: { campaignId: campaign.id } })
      
      if (leadsInCampaign === 0) {
        return { success: false, summary: `La campaña "${campaign.name}" no tiene leads asignados. Asigna leads primero.` }
      }
      
      // Return as frontend action (activation generates AI emails, needs the full API)
      return {
        success: true,
        data: { campaignId: campaign.id, campaignName: campaign.name, leadsCount: leadsInCampaign },
        summary: `Campaña "${campaign.name}" lista para activar con ${leadsInCampaign} leads. Generando emails...`,
        frontendAction: {
          type: 'growth_engine',
          payload: { growthAction: 'activate_campaign', params: { campaignId: campaign.id } },
        },
      }
    }
    
    // ===== BATCH APPROVE =====
    case 'growth_batch_approve': {
      // Count pending actions
      const where: Record<string, unknown> = { userId, status: 'pending' }
      if (args.campaignId) where.leadId = { not: null } // Filter by campaign would need join
      
      const pendingCount = await prisma.growthAction.count({ where })
      
      if (pendingCount === 0) {
        return { success: true, data: { approved: 0 }, summary: 'No hay acciones pendientes para aprobar.' }
      }
      
      // Delegate actual sending to frontend (needs email infrastructure)
      return {
        success: true,
        data: { pendingCount },
        summary: `${pendingCount} acciones pendientes listas para aprobar.`,
        frontendAction: {
          type: 'growth_engine',
          payload: { growthAction: 'batch_approve', params: { limit: args.limit || 50 } },
        },
      }
    }
    
    // ===== GENERATE OUTREACH =====
    case 'growth_generate_outreach': {
      // Delegate to frontend (needs LLM call for email generation)
      return {
        success: true,
        data: args,
        summary: 'Generando email de outreach personalizado...',
        frontendAction: {
          type: 'growth_engine',
          payload: { growthAction: 'generate_outreach', params: args },
        },
      }
    }
    
    // ===== UPDATE PENDING EMAILS =====
    case 'growth_update_pending_emails': {
      const updateWhere: Record<string, unknown> = { userId, status: 'pending', actionType: 'outreach_email' }
      
      const updateData: Record<string, unknown> = {}
      if (args.subject || args.body) {
        // Update the payload JSON of pending actions
        const pendingActions = await prisma.growthAction.findMany({
          where: updateWhere,
          select: { id: true, payload: true },
        })
        
        let updated = 0
        for (const action of pendingActions) {
          try {
            const payload = action.payload ? JSON.parse(action.payload) : {}
            if (args.subject) payload.subject = args.subject
            if (args.body) payload.body = args.body
            await prisma.growthAction.update({
              where: { id: action.id },
              data: { payload: JSON.stringify(payload) },
            })
            updated++
          } catch { /* skip malformed */ }
        }
        
        return {
          success: true,
          data: { updated },
          summary: `Copy actualizado en ${updated} emails pendientes.`,
        }
      }
      
      return { success: false, summary: 'Proporciona subject y/o body para actualizar.' }
    }
    
    // ===== SYNC INBOX =====
    case 'growth_sync_inbox': {
      return {
        success: true,
        data: {},
        summary: 'Sincronizando inbox...',
        frontendAction: {
          type: 'growth_engine',
          payload: { growthAction: 'sync_inbox', params: {} },
        },
      }
    }
    
    // ===== GET REPORT =====
    case 'growth_get_report': {
      const [total, byStatus, recentLeads, campaigns] = await Promise.all([
        prisma.growthLead.count({ where: { userId } }),
        prisma.growthLead.groupBy({ by: ['status'], where: { userId }, _count: true }),
        prisma.growthLead.findMany({
          where: { userId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { businessName: true, email: true, status: true, createdAt: true },
        }),
        prisma.campaign.findMany({
          where: { userId },
          select: { name: true, status: true, sentCount: true, openCount: true, replyCount: true, convertedCount: true, totalLeads: true },
        }),
      ])
      
      // Emails abiertos: detalle real desde GrowthMessage (tracking pixel)
      const openedEmails = await prisma.growthMessage.findMany({
        where: { userId, openedAt: { not: null } },
        take: 10,
        orderBy: { openedAt: 'desc' },
        select: { subject: true, openedAt: true, openCount: true, lead: { select: { businessName: true, email: true } } },
      })
      
      const statusMap = Object.fromEntries(byStatus.map(s => [s.status, s._count]))
      const totalOpens = campaigns.reduce((acc, c) => acc + (c.openCount || 0), 0)
      const opensDetail = openedEmails.length > 0
        ? ` Aperturas detectadas: ${openedEmails.map(e => `${e.lead?.businessName || e.lead?.email || 'lead'} abrió "${e.subject}" (${e.openCount}x)`).slice(0, 5).join('; ')}.`
        : ' Ningún email abierto detectado aún (tracking pixel sin disparos).'
      
      return {
        success: true,
        data: { total, byStatus: statusMap, recentLeads, campaigns, openedEmails, totalOpens },
        summary: `Reporte: ${total} leads (new:${statusMap.new || 0}, contacted:${statusMap.contacted || 0}, qualified:${statusMap.qualified || 0}, converted:${statusMap.converted || 0}, lost:${statusMap.lost || 0}). ${campaigns.length} campañas. Aperturas totales: ${totalOpens}.${opensDetail} Últimos leads: ${recentLeads.map(l => l.businessName).join(', ')}.`,
      }
    }
    
    // ===== GET INSIGHTS =====
    case 'growth_get_insights': {
      const insights = await prisma.growthInsight.findMany({
        where: { userId },
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { title: true, description: true, insightType: true, score: true },
      })
      
      return {
        success: true,
        data: { insights },
        summary: insights.length > 0
          ? `${insights.length} insights: ${insights.map(i => i.title).join('; ')}`
          : 'No hay insights generados aún. Se generan automáticamente al tener más actividad.',
      }
    }
    
    default:
      return { success: false, summary: `Growth tool desconocido: ${toolName}` }
  }
}

// ═══════════════════════════════════════════════════════════════
// GOOGLE WORKSPACE EXECUTOR — Delegates to frontend action
// (Google APIs need OAuth tokens managed by Brazos)
// ═══════════════════════════════════════════════════════════════

async function executeGoogleTool(
  toolName: string,
  args: Record<string, unknown>,
  _userId: string
): Promise<ToolResult> {
  // Map tool name to Google Workspace action
  const serviceMap: Record<string, { service: string; action: string }> = {
    gmail_send_email: { service: 'gmail', action: 'send_email' },
    gmail_list_emails: { service: 'gmail', action: 'list_emails' },
    gmail_create_draft: { service: 'gmail', action: 'create_draft' },
    calendar_list_events: { service: 'calendar', action: 'list_events' },
    calendar_create_event: { service: 'calendar', action: 'create_event' },
  }
  
  const mapping = serviceMap[toolName]
  if (!mapping) return { success: false, summary: `Google tool desconocido: ${toolName}` }
  
  return {
    success: true,
    data: args,
    summary: `Ejecutando ${mapping.service}.${mapping.action}...`,
    frontendAction: {
      type: 'google_workspace',
      payload: {
        googleService: mapping.service,
        googleAction: mapping.action,
        googleParams: args,
      },
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// CREATIVE EXECUTOR — Returns frontend action
// ═══════════════════════════════════════════════════════════════

async function executeCreativeTool(
  toolName: string,
  args: Record<string, unknown>,
  _userId: string
): Promise<ToolResult> {
  const mediaType = toolName === 'generate_image' ? 'image' : 'video'
  
  return {
    success: true,
    data: args,
    summary: `Generando ${mediaType}...`,
    frontendAction: {
      type: 'create_media',
      payload: {
        media: {
          description: args.description,
          mediaType,
          style: args.style || 'cinematic',
          orientation: args.orientation || 'square',
          platform: args.platform || 'general',
          videoMode: args.videoMode || 'slideshow',
          title: args.title,
        },
      },
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// BROWSER AUTOMATION EXECUTOR
// ═══════════════════════════════════════════════════════════════

// Verifica el estado REAL del Bridge (heartbeat en armConnection) y la sesión activa.
// Esto evita que OCTOPUS adivine: o el Bridge está online (con URL actual) o no lo está.
async function getBridgeStatus(userId: string): Promise<{ online: boolean; currentUrl: string | null }> {
  try {
    const arm = await prisma.armConnection.findUnique({
      where: { userId_armType: { userId, armType: 'browser_automation' } },
      select: { status: true, updatedAt: true },
    })
    const online = !!arm && arm.status === 'connected' && Date.now() - new Date(arm.updatedAt).getTime() < 45000
    let currentUrl: string | null = null
    if (online) {
      const sess = await prisma.browserSession.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { currentUrl: true },
      })
      currentUrl = sess?.currentUrl || null
    }
    return { online, currentUrl }
  } catch {
    return { online: false, currentUrl: null }
  }
}

async function executeBrowserTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  // ── PRE-CHECK: estado real del Bridge antes de cualquier acción de navegador ──
  const bridge = await getBridgeStatus(userId)
  if (!bridge.online) {
    return {
      success: false,
      error: 'bridge_offline',
      data: { bridgeOnline: false },
      summary:
        '🔌 Verifiqué el estado real del Bridge: está DESCONECTADO (sin heartbeat reciente). No se envió ningún comando al navegador. Pide al usuario abrir el Octopus Bridge en su PC (menú Browser Automation) y reintentar. NO afirmes que la tarea se ejecutó.',
    }
  }
  const bridgeNote = `🔌 Bridge conectado (verificado)${bridge.currentUrl ? ` — sesión actual en ${bridge.currentUrl}` : ''}.`

  // ── AI TASK: tarea en lenguaje natural ──
  if (toolName === 'browser_ai_task') {
    const task = (args.task as string) || ''
    if (!task) {
      return { success: false, error: 'Missing task', summary: 'Se requiere la descripción de la tarea web.' }
    }
    return {
      success: true,
      data: { task, bridgeOnline: true, currentUrl: bridge.currentUrl },
      summary: `${bridgeNote} Enviando tarea al navegador...`,
      frontendAction: {
        type: 'browser_automation',
        payload: {
          browserAction: 'ai_task',
          browserCommand: task,
          browserSessionId: (args.sessionId as string) || '',
        },
      },
    }
  }

  // ── RUN TEMPLATE: resolver nombre → ID antes de delegar al frontend ──
  let templateId = (args.templateId as string) || ''
  const templateName = (args.templateName as string) || ''
  let resolvedName = templateName

  if (templateId) {
    // Verificar que el ID exista y pertenezca al usuario
    const tpl = await prisma.browserTemplate.findFirst({
      where: { id: templateId, userId },
      select: { id: true, name: true },
    })
    if (tpl) {
      resolvedName = tpl.name
    } else {
      templateId = ''
    }
  }

  if (!templateId && templateName) {
    const tpl = await prisma.browserTemplate.findFirst({
      where: { userId, name: { contains: templateName, mode: 'insensitive' } },
      select: { id: true, name: true },
      orderBy: { updatedAt: 'desc' },
    })
    if (tpl) {
      templateId = tpl.id
      resolvedName = tpl.name
    }
  }

  if (!templateId) {
    // No existe la plantilla — listar disponibles y hacer fallback a ai_task si hay descripción
    const templates = await prisma.browserTemplate.findMany({
      where: { userId },
      select: { name: true },
      take: 15,
      orderBy: { updatedAt: 'desc' },
    })
    const available = templates.map(t => t.name).join(', ') || 'ninguna'

    if (templateName) {
      // Fallback inteligente: ejecutar la intención como tarea IA en el navegador
      return {
        success: true,
        data: { fallback: 'ai_task', requested: templateName, availableTemplates: available },
        summary: `No encontré la plantilla "${templateName}" en Browser Automation (disponibles: ${available}). Ejecutando la tarea directamente con IA en el navegador.`,
        frontendAction: {
          type: 'browser_automation',
          payload: {
            browserAction: 'ai_task',
            browserCommand: `Ejecuta esta tarea web: ${templateName}`,
          },
        },
      }
    }

    return {
      success: false,
      error: 'Template not found',
      summary: `No se especificó plantilla válida. Plantillas disponibles: ${available}. Puedo ejecutar la tarea con browser_ai_task si me describes qué hacer.`,
    }
  }

  return {
    success: true,
    data: { templateId, templateName: resolvedName, bridgeOnline: true, currentUrl: bridge.currentUrl },
    summary: `${bridgeNote} Ejecutando plantilla "${resolvedName}" en el navegador...`,
    frontendAction: {
      type: 'browser_automation',
      payload: {
        browserAction: 'run_template',
        browserTemplateId: templateId,
        browserVariables: (args.variables as Record<string, unknown>) || {},
        browserSessionId: (args.sessionId as string) || '',
      },
    },
  }
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM EXECUTORS
// ═══════════════════════════════════════════════════════════════

const ROUTE_MAP: Record<string, string> = {
  dashboard: '/dashboard',
  growth: '/dashboard/growth',
  projects: '/dashboard/projects',
  brazos: '/dashboard/brazos',
  'skill-factory': '/dashboard/skill-factory',
  'agent-factory': '/dashboard/agent-factory',
  'mcp-factory': '/dashboard/mcp-factory',
  chat: '/dashboard/chat',
  'api-hub': '/dashboard/api-hub',
  settings: '/dashboard/settings',
  'browser-automation': '/dashboard/browser-automation',
  jarvis: '/dashboard/jarvis',
  onboarding: '/onboarding',
}

function executeNavigate(args: Record<string, unknown>): ToolResult {
  const page = args.page as string
  const route = ROUTE_MAP[page] || `/dashboard/${page}`
  
  return {
    success: true,
    data: { route, page },
    summary: `Navegando a ${page}...`,
    frontendAction: { type: 'navigate', payload: { route } },
  }
}

function executeThemeToggle(args: Record<string, unknown>): ToolResult {
  const theme = (args.theme as string) || 'toggle'
  return {
    success: true,
    data: { theme },
    summary: `Cambiando a modo ${theme === 'dark' ? 'oscuro' : theme === 'light' ? 'claro' : 'alterno'}...`,
    frontendAction: { type: 'theme_toggle', payload: { theme } },
  }
}

async function executeWebSearch(args: Record<string, unknown>): Promise<ToolResult> {
  const query = args.query as string
  if (!query) return { success: false, summary: 'Se requiere un query de búsqueda.', error: 'Missing query' }

  const ABACUS_API_KEY = process.env.ABACUSAI_API_KEY || ''
  if (!ABACUS_API_KEY) {
    return {
      success: true,
      data: { query },
      summary: `Buscando: "${query}"... (delegando al frontend)`,
      frontendAction: { type: 'web_search', payload: { query } },
    }
  }

  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ABACUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: `Busca en internet información concreta y específica sobre: ${query}\n\nIMPORTANTE: Devuelve DATOS REALES y CONCRETOS (nombres, emails, URLs, teléfonos, direcciones). NO devuelvas artículos educativos ni listas de herramientas genéricas. Extrae HECHOS ESPECÍFICOS. Si buscas negocios/perfiles, devuelve datos de contacto reales. Responde en el mismo idioma de la consulta. Sé breve y directo.`
        }],
        temperature: 0.2,
        max_tokens: 3000,
        extra_parameters: { grounding: true }
      }),
      signal: AbortSignal.timeout(25000)
    })

    if (!response.ok) throw new Error(`Abacus API error: ${response.status}`)
    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content || ''
    if (!answer) throw new Error('Empty response')

    // Extract URLs as sources
    const urlRegex = /https?:\/\/[^\s\)\]"'<>]+/g
    const foundUrls = answer.match(urlRegex) || []
    const sources = ([...new Set(foundUrls)] as string[]).slice(0, 6).map(u => u.replace(/[.,;:]+$/, ''))

    // Truncate to keep token budget reasonable
    const truncated = answer.length > 2500 ? answer.substring(0, 2500) + '...' : answer

    return {
      success: true,
      data: { query, answer: truncated, sources },
      summary: `Resultados de búsqueda para "${query}": ${truncated.substring(0, 300)}...`,
      frontendAction: { type: 'web_search', payload: { query } },
    }
  } catch (err) {
    console.error('[Tool Executor] Web search error:', err)
    // Fallback: delegate to frontend
    return {
      success: true,
      data: { query },
      summary: `Buscando: "${query}"... (delegando al frontend)`,
      frontendAction: { type: 'web_search', payload: { query } },
    }
  }
}

async function executeIntrospect(args: Record<string, unknown>, _userId: string): Promise<ToolResult> {
  return {
    success: true,
    data: args,
    summary: `Ejecutando introspección: ${args.type}...`,
    frontendAction: { type: 'introspect', payload: { type: args.type } },
  }
}

async function executeIoT(args: Record<string, unknown>, _userId: string): Promise<ToolResult> {
  return {
    success: true,
    data: args,
    summary: `Controlando dispositivo IoT: ${args.action} ${args.deviceName || ''}...`,
    frontendAction: {
      type: 'iot',
      payload: {
        iotAction: args.action,
        deviceName: args.deviceName || '',
        roomName: args.roomName || '',
        iotParams: args,
      },
    },
  }
}

async function executeSocial(toolName: string, args: Record<string, unknown>, _userId: string): Promise<ToolResult> {
  return {
    success: true,
    data: args,
    summary: `Publicando en LinkedIn...`,
    frontendAction: {
      type: 'social_bridge',
      payload: {
        socialAction: 'publish_linkedin',
        content: args.content || '',
        scheduledFor: args.scheduledFor || '',
      },
    },
  }
}

async function executeContentPublish(args: Record<string, unknown>, _userId: string): Promise<ToolResult> {
  return {
    success: true,
    data: args,
    summary: `Publicando contenido: "${args.title}"...`,
    frontendAction: {
      type: 'content_publish',
      payload: {
        title: args.title || '',
        content: args.content || '',
        slug: args.slug || '',
        contentType: 'blog_post',
      },
    },
  }
}

async function executeCreation(
  toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  // Delegation keeps the frontend flow (streams the agent's response live)
  if (toolName === 'delegate_to_agent') {
    return {
      success: true,
      data: args,
      summary: `Delegando a agente: ${args.agentName || ''}...`,
      frontendAction: { type: 'delegate_agent', payload: args as Record<string, unknown> },
    }
  }

  // ── Server-side authoritative creation ──
  // OCTOPUS creates the tool directly in the DB so it ALWAYS persists,
  // even if the user closes the browser mid-stream.
  try {
    if (toolName === 'create_skill') {
      const name = (args.name || args.skillName || '') as string
      if (!name) return { success: false, summary: 'Falta el nombre de la skill.', error: 'missing name' }
      const code = ((args.code || args.skillCode) as string) || ''
      // Anti-humo: validar si el código es realmente ejecutable
      const assessment = assessSkillCode(code)
      const skill = await prisma.customSkill.create({
        data: {
          userId,
          name,
          description: ((args.description || args.skillDescription) as string) || '',
          category: ((args.category || args.skillCategory) as string) || 'custom',
          code,
          isActive: assessment.executable,
          createdBy: 'octopus',
        },
      })
      const summary = assessment.executable
        ? `✅ Skill "${skill.name}" creada y guardada en Skill Factory (/dashboard/skill-factory).`
        : `⚠️ Skill "${skill.name}" guardada en Skill Factory como BORRADOR (inactiva): ${assessment.reason}. Sé HONESTO con el usuario: esta skill NO está lista para ejecutarse. Si la tarea es de navegador, la forma real de ejecutarla es browser_ai_task (en vivo) o una plantilla de Browser Automation con pasos reales (goto/click/type).`
      return {
        success: true,
        data: { id: skill.id, name: skill.name, executable: assessment.executable, draftReason: assessment.reason || null },
        summary,
        frontendAction: { type: 'tool_created', payload: { toolType: 'skill', id: skill.id, name: skill.name, location: '/dashboard/skill-factory' } },
      }
    }

    if (toolName === 'create_agent') {
      const name = (args.name || args.agentName || '') as string
      if (!name) return { success: false, summary: 'Falta el nombre del agente.', error: 'missing name' }
      // Server-side plan gate (maxAgents)
      const gate = await checkPlanGate(userId, 'agents')
      if (!gate.allowed) {
        return {
          success: false,
          summary: `⚠️ Has alcanzado el límite de ${gate.limit} agentes de tu plan ${gate.planId}. Para crear "${name}" necesitas actualizar tu plan en /pricing.`,
          error: 'plan_limit',
          data: { upgradeRequired: gate.upgradeRequired, current: gate.current, limit: gate.limit },
        }
      }
      const agent = await prisma.customAgent.create({
        data: {
          userId,
          name,
          description: ((args.description || args.agentDescription) as string) || '',
          category: ((args.category || args.agentCategory) as string) || 'custom',
          systemPrompt: ((args.systemPrompt || args.agentPrompt) as string) || `Eres ${name}, un agente especializado de OCTOPUS.`,
          model: ((args.model || args.agentModel) as string) || 'gpt-4.1',
          temperature: typeof args.temperature === 'number' ? (args.temperature as number) : 0.7,
          icon: (args.icon as string) || '🤖',
          isActive: true,
        },
      })
      return {
        success: true,
        data: { id: agent.id, name: agent.name },
        summary: `✅ Agente "${agent.name}" creado y activo en Agent Factory (${agent.model}, temp ${agent.temperature}). Ya puedes delegarle tareas o chatear con él en /dashboard/agent-factory.`,
        frontendAction: { type: 'tool_created', payload: { toolType: 'agent', id: agent.id, name: agent.name, location: '/dashboard/agent-factory' } },
      }
    }

    if (toolName === 'create_mcp') {
      const name = (args.name || args.mcpName || '') as string
      if (!name) return { success: false, summary: 'Falta el nombre del MCP.', error: 'missing name' }
      const rawCaps = (args.capabilities || args.mcpCapabilities) as unknown
      const capabilities = Array.isArray(rawCaps) ? rawCaps.map(String) : typeof rawCaps === 'string' ? rawCaps.split(',').map(s => s.trim()).filter(Boolean) : []
      const mcp = await prisma.customMcp.create({
        data: {
          userId,
          name,
          description: ((args.description || args.mcpDescription) as string) || '',
          category: ((args.category as string) || 'custom'),
          endpoint: ((args.endpoint || args.mcpEndpoint) as string) || '',
          apiKey: (args.apiKey as string) || null,
          capabilities,
          isConnected: false,
          version: '1.0.0',
        },
      })
      const epNote = mcp.endpoint ? 'Usa "Probar conexión" en MCP Factory para verificar el endpoint.' : 'Agrega el endpoint en MCP Factory para conectarlo.'
      return {
        success: true,
        data: { id: mcp.id, name: mcp.name },
        summary: `✅ MCP "${mcp.name}" creado en MCP Factory. ${epNote}`,
        frontendAction: { type: 'tool_created', payload: { toolType: 'mcp', id: mcp.id, name: mcp.name, location: '/dashboard/mcp-factory' } },
      }
    }

    return { success: false, summary: `Tipo de creación no soportado: ${toolName}`, error: 'unsupported' }
  } catch (err) {
    console.error('[executeCreation]', toolName, err)
    return { success: false, summary: `Error creando la herramienta: ${err instanceof Error ? err.message : 'desconocido'}`, error: String(err) }
  }
}

// ═══════════════════════════════════════════════════════════════
// GROWTH PROSPECT WEB — Search web for leads and create them
// ═══════════════════════════════════════════════════════════════
async function executeGrowthProspectWeb(
  _toolName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  const industry = (args.industry as string) || 'small business'
  const location = (args.location as string) || ''
  const count = Math.min((args.count as number) || 5, 10)
  const role = (args.role as string) || 'owner'

  const ABACUS_API_KEY = process.env.ABACUSAI_API_KEY || ''
  if (!ABACUS_API_KEY) {
    return { success: false, summary: 'API key no configurada para prospecting.', error: 'No API key' }
  }

  const locationClause = location ? ` in ${location}` : ''
  const searchPrompt = `Find ${count} REAL ${industry} businesses${locationClause} with their contact information.

For each business, extract:
- Business name (real name)
- Contact person name and role (${role}, manager, founder)
- Email address (look for it on their website, Google Business, LinkedIn)
- Phone number
- City/Location
- Website URL
- What they do (1 line)

IMPORTANT: Only return REAL businesses you can verify exist. Format as a numbered list with all fields clearly labeled. Do NOT return generic examples or placeholder data. Search Google Maps, LinkedIn, and business directories.`

  try {
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ABACUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: searchPrompt }],
        temperature: 0.2,
        max_tokens: 4000,
        extra_parameters: { grounding: true }
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) throw new Error(`API error: ${response.status}`)
    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content || ''
    if (!answer) throw new Error('Empty response')

    // Parse the response for email patterns and auto-create leads
    const emailRegex = /[\w.+\-]+@[\w.\-]+\.[a-z]{2,}/gi
    const emailsFound = answer.match(emailRegex) || []
    
    // Create leads from found data
    const createdLeads: string[] = []
    for (const email of ([...new Set(emailsFound)].slice(0, count) as string[])) {
      try {
        // Check if lead already exists
        const existing = await prisma.growthLead.findFirst({
          where: { userId, email: email.toLowerCase() }
        })
        if (existing) {
          createdLeads.push(`⚠️ ${email} ya existe en pipeline (${existing.businessName})`)
          continue
        }

        // Extract business name near this email in the text
        const emailIndex = answer.indexOf(email)
        const contextBefore = answer.substring(Math.max(0, emailIndex - 300), emailIndex)
        const contextAfter = answer.substring(emailIndex, Math.min(answer.length, emailIndex + 200))
        const nameMatch = contextBefore.match(/(?:Business|Negocio|Empresa|Name|Nombre)[:\s]*([^\n,]+)/i)
          || contextBefore.match(/\d+\.\s*\*?\*?([^\n*]+)/)
        let businessName = nameMatch ? nameMatch[1].replace(/\*+/g, '').trim() : `Prospect (${email.split('@')[1]})`
        
        // ═══ SANITIZE businessName ═══
        // Remove common prefixes the LLM leaves: "Name: X", "Business: X", "Empresa: X"
        businessName = businessName.replace(/^(?:Name|Business|Negocio|Empresa|Nombre)\s*:\s*/i, '').trim()
        // Remove markdown bold markers
        businessName = businessName.replace(/\*+/g, '').trim()
        // If it looks like a sentence fragment (>60 chars with spaces, or ends with period/comma), it's garbage
        const isGarbage = businessName.length > 60 && (businessName.split(' ').length > 8 || /[.,;]$/.test(businessName))
        // If it's random characters (no vowels, or >50% non-alpha), it's garbage
        const vowelCount = (businessName.match(/[aeiouáéíóú]/gi) || []).length
        const alphaCount = (businessName.match(/[a-záéíóúñ]/gi) || []).length
        const isRandom = businessName.length > 5 && (vowelCount === 0 || alphaCount / businessName.length < 0.5)
        if (isGarbage || isRandom) {
          businessName = `Prospect (${email.split('@')[1]})`
        }
        businessName = businessName.substring(0, 80)
        
        const contactMatch = contextBefore.match(/(?:Contact|Contacto|Person|Owner|Dueño)[:\s]*([^\n,]+)/i)
        let contactName = contactMatch ? contactMatch[1].replace(/\*+/g, '').trim().substring(0, 60) : ''
        contactName = contactName.replace(/^(?:Name|Contact|Contacto|Person|Nombre)\s*:\s*/i, '').trim()
        
        const phoneMatch = (contextBefore + contextAfter).match(/(?:\+?\d[\d\s\-().]{7,}\d)/)
        const phone = phoneMatch ? phoneMatch[0].trim() : ''
        
        const cityMatch = (contextBefore + contextAfter).match(/(?:City|Ciudad|Location|Ubicación)[:\s]*([^\n,]+)/i)
        const city = cityMatch ? cityMatch[1].replace(/\*+/g, '').trim().substring(0, 40) : (location || '')

        const lead = await prisma.growthLead.create({
          data: {
            userId,
            businessName,
            contactName: contactName || undefined,
            email: email.toLowerCase(),
            phone: phone || undefined,
            city: city || undefined,
            businessType: industry,
            leadSource: 'octopus-prospecting',
            status: 'new',
            notes: `Auto-prospected via web search. Industry: ${industry}.`,
          },
        })
        createdLeads.push(`✅ ${lead.businessName} — ${lead.email} (ID: ${lead.id})`)
      } catch (createErr) {
        console.error('[Prospect] Lead creation error:', createErr)
        createdLeads.push(`❌ Error creando lead para ${email}`)
      }
    }

    const truncated = answer.length > 2000 ? answer.substring(0, 2000) + '...' : answer

    return {
      success: true,
      data: {
        searchResults: truncated,
        leadsCreated: createdLeads,
        totalEmailsFound: emailsFound.length,
        totalLeadsCreated: createdLeads.filter(l => l.startsWith('✅')).length,
      },
      summary: `Prospecting completado: ${emailsFound.length} emails encontrados, ${createdLeads.filter(l => l.startsWith('✅')).length} leads nuevos creados en el pipeline.\n\nResultados:\n${createdLeads.join('\n')}\n\nDatos de búsqueda:\n${truncated.substring(0, 500)}`,
    }
  } catch (err) {
    console.error('[Tool Executor] Prospect web error:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      summary: `Error en prospecting web: ${err instanceof Error ? err.message : 'Error desconocido'}`,
    }
  }
}
