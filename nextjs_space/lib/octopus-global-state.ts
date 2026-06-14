/**
 * 🐙 OCTOPUS GLOBAL STATE — Centralized consciousness system
 * 
 * Single function that queries ALL user state in parallel and returns
 * a compact system prompt. ALWAYS injected regardless of active modules.
 * 
 * This replaces the old scattered conditional prompts (brazosStatusPrompt,
 * salesStatusPrompt, voiceAgentStatusPrompt, etc.) that depended on the
 * context router activating the right module.
 */

import { prisma, withDbRetry } from '@/lib/prisma'
import { getPlanLimits } from '@/lib/plan-limits'

export interface GlobalState {
  /** Compact system prompt with full user state */
  prompt: string
  /** Structured data for programmatic access */
  data: GlobalStateData
}

export interface GlobalStateData {
  // --- IDENTIDAD ---
  identity: {
    name: string | null
    email: string
    businessEmail: string | null
    planPeriod: string
    turboModel: string | null
    turboProvider: string | null
    hasElevenLabs: boolean
    hasShellyIoT: boolean
    showWatermark: boolean
    hasPromoTrial: boolean
    promoTrialDaysLeft: number
    hasBrazosUnlimited: boolean
    isOnboarded: boolean
  }
  
  // --- PLATAFORMA Y CONFIGURACIÓN ---
  plan: { id: string; label: string }
  onboarding: { projectName: string; projectType: string; objective: string } | null
  hasBookingConfig: boolean
  consciousness: { level: number; operativa: number; datos: number; predictiva: number; relacional: number } | null
  hostedSites: { name: string; slug: string; published: boolean }[]
  pendingTasks: number
  scheduledBrowserTasks: number
  nexusProjects: number

  // --- BRAZOS Y FACTORIES ---
  brazos: { type: string; status: string; detail?: string }[]
  customAgents: { name: string; category: string; active: boolean; model: string; icon: string | null }[]
  customSkills: { name: string; category: string; active: boolean; usageCount: number }[]
  customMcps: { name: string; connected: boolean; capabilities: string[]; icon?: string | null }[]

  // --- MÓDULOS DE NEGOCIO ---
  voiceAgents: { name: string; tier: string; language: string; model: string; active: boolean }[]
  salesAgents: { name: string; leads: number; active: boolean }[]
  iotDevices: { count: number; online: number }
  growth: { leads: number; campaigns: number; pendingActions: number; campaignList: { id: string; name: string; status: string }[] }
  creative: { assets: number; projects: number }
  social: { posts: number; connections: string[] }
  invoices: { total: number; drafts: number }
  calendar: { upcoming: number }
  knowledgeBase: { docs: number }
  subscription: { status: string; daysLeft: number; canceling: boolean } | null
  apiHub: { total: number; active: number; services: string[] }
  skills: { activeIds: string[]; totalExecutions: number }
}

/**
 * Builds the complete global state for a user.
 * Queries are split into 4 sequential batches to avoid exhausting
 * the DB connection pool (max ~10 connections). Each batch runs
 * its queries in parallel, but batches are sequential.
 */
export async function buildGlobalState(userId: string, activeModules?: string[]): Promise<GlobalState> {
  const mods = new Set(activeModules || [])
  
  // ══════════════════════════════════════════════════════════
  // BATCH 1 — Core Identity & Configuration (7 queries)
  // ══════════════════════════════════════════════════════════
  const [
    userRecord,
    armConnections,
    voiceAgents,
    subscription,
    consciousnessState,
    onboardingData,
    bookingConfig
  ] = await withDbRetry(() => Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        planId: true,
        planPeriod: true,
        turboEnabled: true,
        turboModel: true,
        turboProvider: true,
        businessEmail: true,
        elevenLabsEnabled: true,
        elevenLabsKey: true,
        shellyCloudServer: true,
        showWatermark: true,
        activeWorkspaceId: true,
        promoTrialEndsAt: true,
        brazosUnlimitedUntil: true,
        onboardedAt: true,
        tourCompleted: true,
      },
    }),
    prisma.armConnection.findMany({
      where: { userId },
      select: { armType: true, status: true, credentials: true },
    }),
    prisma.voiceAgent.findMany({
      where: { userId },
      select: { agentName: true, ttsTier: true, language: true, model: true, isActive: true },
    }),
    prisma.subscription.findUnique({ where: { userId } }).catch(() => null),
    prisma.consciousnessState.findUnique({
      where: { userId },
      select: { overallLevel: true, operativa: true, datos: true, predictiva: true, relacional: true },
    }).catch(() => null),
    prisma.onboardingData.findUnique({
      where: { userId },
      select: { projectName: true, projectType: true, objective: true },
    }).catch(() => null),
    prisma.bookingConfig.findFirst({
      where: { userId },
      select: { id: true },
    }).catch(() => null),
  ]), { label: 'GlobalState-B1' })

  // ══════════════════════════════════════════════════════════
  // BATCH 2 — Factories & Platform Features (9 queries)
  // ══════════════════════════════════════════════════════════
  const [
    customAgents,
    customSkills,
    customMcps,
    hostedSites,
    pendingTasks,
    scheduledTasks,
    nexusProjects,
    deviceCount,
    onlineDeviceCount
  ] = await withDbRetry(() => Promise.all([
    prisma.customAgent.findMany({
      where: { userId },
      select: { name: true, category: true, isActive: true, model: true, icon: true },
    }).catch(() => []),
    prisma.customSkill.findMany({
      where: { userId },
      select: { name: true, category: true, isActive: true, usageCount: true },
    }).catch(() => []),
    prisma.customMcp.findMany({
      where: { userId },
      select: { name: true, isConnected: true, capabilities: true, icon: true },
    }).catch(() => []),
    prisma.hostedSite.findMany({
      where: { userId },
      select: { name: true, slug: true, customDomain: true, status: true },
      take: 5,
    }).catch(() => []),
    prisma.taskItem.count({
      where: { userId, status: 'pending' },
    }).catch(() => 0),
    prisma.scheduledBrowserTask.count({
      where: { userId, status: 'active' },
    }).catch(() => 0),
    prisma.nexusProject.count({
      where: { userId },
    }).catch(() => 0),
    prisma.smartDevice.count({ where: { userId } }),
    prisma.smartDevice.count({ where: { userId, isOnline: true } }),
  ]), { label: 'GlobalState-B2' })

  // ══════════════════════════════════════════════════════════
  // BATCH 3 — Growth & Social Activity (7 queries)
  // ══════════════════════════════════════════════════════════
  const [
    leadCount,
    recentLeads,
    campaignsRaw,
    pendingActionCount,
    socialPostCount,
    socialConnections,
    salesAgentsRaw,
  ] = await withDbRetry(() => Promise.all([
    prisma.growthLead.count({ where: { userId } }),
    prisma.growthLead.findMany({
      where: { userId },
      select: { contactName: true, email: true, status: true, leadTier: true, businessName: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => [] as { contactName: string | null; email: string; status: string; leadTier: string | null; businessName: string | null }[]),
    prisma.campaign.findMany({
      where: { userId },
      select: { id: true, name: true, status: true, totalLeads: true, sentCount: true, replyCount: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => [] as { id: string; name: string; status: string; totalLeads: number; sentCount: number; replyCount: number }[]),
    prisma.growthAction.count({ where: { userId, status: 'pending' } }),
    prisma.socialPost.count({ where: { userId } }),
    prisma.socialConnection.findMany({
      where: { userId, isConnected: true },
      select: { platform: true },
    }),
    prisma.salesAgent.findMany({
      where: { userId },
      select: { id: true, name: true, isActive: true },
    }),
  ]), { label: 'GlobalState-B3' })

  // ══════════════════════════════════════════════════════════
  // BATCH 4 — Creative, Billing, KB & Misc (9 queries)
  // ══════════════════════════════════════════════════════════
  const [
    assetCount,
    projectCount,
    invoiceTotal,
    invoiceDrafts,
    upcomingEvents,
    kbDocs,
    salesLeadCounts,
    apiKeysRaw,
    skillExecGroups,
  ] = await withDbRetry(() => Promise.all([
    prisma.creativeAsset.count({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId, status: 'draft' } }),
    prisma.calendarEvent.count({
      where: { userId, startTime: { gte: new Date() } },
    }).catch(() => 0),
    prisma.knowledgeDocument.count({ where: { userId } }).catch(() => 0),
    prisma.salesAgentLead.groupBy({
      by: ['agentId'],
      where: { userId },
      _count: true,
    }).catch(() => []),
    prisma.apiKey.findMany({
      where: { userId },
      select: { serviceType: true, name: true, status: true },
    }).catch(() => []),
    prisma.skillExecution.groupBy({
      by: ['skillId'],
      where: { userId },
      _count: true,
    }).catch(() => []),
  ]), { label: 'GlobalState-B4' })


  // ══════════════════════════════════════════════════════════
  // PROCESS DATA
  // ══════════════════════════════════════════════════════════
  const planId = userRecord?.planId || 'starter'
  const limits = getPlanLimits(planId)
  const planLabel = planId === 'business' ? '🏢 Business' : planId === 'pro' ? '⚡ Pro' : '🌱 Starter'

  // Brazos detail
  const brazosData = armConnections.map(c => {
    const label = c.armType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    let detail = ''
    if (c.armType === 'google_workspace' && c.status === 'connected') {
      detail = 'Calendar, Drive, Docs, Sheets, Gmail'
    }
    if (c.armType === 'ollama' && c.status === 'connected') {
      try {
        const creds = JSON.parse(c.credentials || '{}')
        if (creds.models?.length) detail = `${creds.models.length} modelos locales`
      } catch { /* skip */ }
    }
    return { type: label, status: c.status, detail }
  })

  const connectedBrazos = brazosData.filter(b => b.status === 'connected')

  // Campaign data
  const activeCampaigns = Array.isArray(campaignsRaw) ? campaignsRaw.filter(c => c.status === 'active') : []

  // Sales Agent lead map
  const leadMap = new Map<string, number>()
  if (Array.isArray(salesLeadCounts)) {
    for (const g of salesLeadCounts) {
      leadMap.set(g.agentId, g._count)
    }
  }
  const salesAgentsData = salesAgentsRaw.map(a => ({
    name: a.name,
    leads: leadMap.get(a.id) || 0,
    active: a.isActive,
  }))

  // Subscription
  let subData: GlobalStateData['subscription'] = null
  if (subscription && subscription.status) {
    const endDate = (subscription as Record<string, unknown>).stripeCurrentPeriodEnd as Date | null
    const daysLeft = endDate ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000)) : 0
    subData = {
      status: subscription.status,
      daysLeft,
      canceling: !!(subscription as Record<string, unknown>).cancelAtPeriodEnd,
    }
  }

  // Voice agents data
  const voiceAgentsData = voiceAgents.map(a => ({
    name: a.agentName,
    tier: a.ttsTier,
    language: a.language,
    model: a.model,
    active: a.isActive,
  }))

  // Social connections
  const socialConns = socialConnections.map(c => c.platform)

  // API Hub
  const activeApis = Array.isArray(apiKeysRaw) ? apiKeysRaw.filter(k => k.status === 'active') : []
  const apiServices = activeApis.map(k => k.name)

  // System executed skills (merging executed custom + built-in fallback logic)
  const executedSkillIds = Array.isArray(skillExecGroups) ? skillExecGroups.map(g => g.skillId) : []
  const totalSkillExecs = Array.isArray(skillExecGroups) ? skillExecGroups.reduce((sum, g) => sum + g._count, 0) : 0

  const hasTrial = !!(userRecord?.promoTrialEndsAt && new Date(userRecord.promoTrialEndsAt).getTime() > Date.now())
  const trialDays = hasTrial ? Math.ceil((new Date(userRecord.promoTrialEndsAt!).getTime() - Date.now()) / 86400000) : 0

  // ══════════════════════════════════════════════════════════
  // BUILD STRUCTURED DATA
  // ══════════════════════════════════════════════════════════
  const data: GlobalStateData = {
    identity: {
      name: userRecord?.name || null,
      email: userRecord?.email || 'N/A',
      businessEmail: userRecord?.businessEmail || null,
      planPeriod: userRecord?.planPeriod || 'monthly',
      turboModel: userRecord?.turboModel || null,
      turboProvider: userRecord?.turboProvider || null,
      hasElevenLabs: !!userRecord?.elevenLabsKey,
      hasShellyIoT: !!userRecord?.shellyCloudServer,
      showWatermark: userRecord?.showWatermark ?? true,
      hasPromoTrial: hasTrial,
      promoTrialDaysLeft: trialDays,
      hasBrazosUnlimited: !!(userRecord?.brazosUnlimitedUntil && new Date(userRecord.brazosUnlimitedUntil).getTime() > Date.now()),
      isOnboarded: !!userRecord?.onboardedAt,
    },
    plan: { id: planId, label: planLabel },
    onboarding: onboardingData ? { projectName: onboardingData.projectName, projectType: onboardingData.projectType, objective: onboardingData.objective } : null,
    hasBookingConfig: !!bookingConfig,
    consciousness: consciousnessState ? {
      level: consciousnessState.overallLevel,
      operativa: consciousnessState.operativa,
      datos: consciousnessState.datos,
      predictiva: consciousnessState.predictiva,
      relacional: consciousnessState.relacional
    } : null,
    hostedSites: hostedSites.map(s => ({ name: s.name, slug: s.slug, published: s.status === 'active' })),
    pendingTasks,
    scheduledBrowserTasks: scheduledTasks,
    nexusProjects,
    brazos: brazosData,
    customAgents: customAgents.map(a => ({ name: a.name, category: a.category, active: a.isActive, model: a.model, icon: a.icon })),
    customSkills: customSkills.map(s => ({ name: s.name, category: s.category, active: s.isActive, usageCount: s.usageCount })),
    customMcps: customMcps.map(m => ({ name: m.name, connected: m.isConnected, capabilities: m.capabilities, icon: m.icon })),
    voiceAgents: voiceAgentsData,
    salesAgents: salesAgentsData,
    iotDevices: { count: deviceCount, online: onlineDeviceCount },
    growth: {
      leads: leadCount,
      campaigns: activeCampaigns.length,
      pendingActions: pendingActionCount,
      campaignList: campaignsRaw.map(c => ({ id: c.id, name: c.name, status: c.status })),
    },
    creative: { assets: assetCount, projects: projectCount },
    social: { posts: socialPostCount, connections: socialConns },
    invoices: { total: invoiceTotal, drafts: invoiceDrafts },
    calendar: { upcoming: upcomingEvents },
    knowledgeBase: { docs: kbDocs },
    subscription: subData,
    apiHub: { total: Array.isArray(apiKeysRaw) ? apiKeysRaw.length : 0, active: activeApis.length, services: apiServices },
    skills: { activeIds: executedSkillIds, totalExecutions: totalSkillExecs },
  }

  // ══════════════════════════════════════════════════════════
  // BUILD PROMPT (Modular & Compact)
  // ══════════════════════════════════════════════════════════
  const sections: string[] = []
  const hasActiveModules = mods.size > 0
  const isActive = (mod: string) => !hasActiveModules || mods.has(mod) || mods.has('diagnostic')

  // --- IDENTITY (ALWAYS) ---
  const identityParts: string[] = []
  if (data.identity.businessEmail) identityParts.push(`Email negocio: ${data.identity.businessEmail}`)
  identityParts.push(`Email login: ${data.identity.email}`)
  identityParts.push(`Plan: ${planLabel} (${data.identity.planPeriod})`)
  
  if (userRecord?.turboEnabled) {
    identityParts.push(`Turbo: ✅ ${data.identity.turboModel || 'default'} via ${data.identity.turboProvider || 'openai'}`)
  } else {
    identityParts.push('Turbo: ❌')
  }
  
  if (data.identity.hasPromoTrial) {
    identityParts.push(`Trial: ${data.identity.promoTrialDaysLeft}d restantes`)
  }
  sections.push(`[IDENTIDAD] ${identityParts.join(' · ')}`)

  // --- BRAZOS (ALWAYS) ---
  const hasGoogle = connectedBrazos.some(b => b.type.includes('Google Workspace'))
  const hasGmail = connectedBrazos.some(b => b.type.includes('Gmail'))
  const hasTelegram = connectedBrazos.some(b => b.type.includes('Telegram'))
  const hasOllama = connectedBrazos.some(b => b.type.includes('Ollama'))
  if (connectedBrazos.length > 0) {
    sections.push(`[BRAZOS] ${connectedBrazos.map(b => `✅ ${b.type}`).join(' · ')}`)
  }

  // --- FACTORIES (ALWAYS) ---
  const factoryParts: string[] = []
  const activeCustomAgents = data.customAgents.filter(a => a.active)
  const activeCustomSkills = data.customSkills.filter(s => s.active)
  const connectedMcps = data.customMcps.filter(m => m.connected)

  factoryParts.push(`Agents: ${activeCustomAgents.length}/${data.customAgents.length}`)
  if (activeCustomAgents.length > 0) {
    factoryParts.push(`[${activeCustomAgents.map(a => `${a.icon || '🤖'} ${a.name}`).join(', ')}]`)
  }

  // Skills del sistema (built-in, siempre activas en Skill Factory)
  const SYSTEM_SKILLS = ['Image Skill', 'Game Agent', 'Code Refiner', 'Wildverse SEO', 'Content Publisher']
  factoryParts.push(`Skills sistema: ${SYSTEM_SKILLS.length} activas [${SYSTEM_SKILLS.join(', ')}]`)

  factoryParts.push(`Skills propias: ${activeCustomSkills.length}/${data.customSkills.length}`)
  if (activeCustomSkills.length > 0) {
    factoryParts.push(`[${activeCustomSkills.map(s => s.name).join(', ')}]`)
  }

  factoryParts.push(`MCPs: ${connectedMcps.length}/${data.customMcps.length}`)
  if (connectedMcps.length > 0) {
    factoryParts.push(`[${connectedMcps.map(m => m.name).join(', ')}]`)
  }
  sections.push(`[FACTORIES] ${factoryParts.join(' · ')}`)


  // --- PLATAFORMA Y FEATURES (ALWAYS) ---
  const featureParts: string[] = []
  if (data.hostedSites.length > 0) {
    featureParts.push(`Sites: ${data.hostedSites.filter(s => s.published).length} publicados`)
  }
  if (data.pendingTasks > 0) featureParts.push(`Tasks: ${data.pendingTasks} pendientes`)
  if (data.scheduledBrowserTasks > 0) featureParts.push(`Browser auto: ${data.scheduledBrowserTasks} activas`)
  if (data.nexusProjects > 0) featureParts.push(`Nexus: ${data.nexusProjects} proyectos`)
  if (data.identity.hasElevenLabs) featureParts.push('ElevenLabs: ✅')
  if (data.identity.hasShellyIoT) featureParts.push('Shelly IoT: ✅')
  if (featureParts.length > 0) {
    sections.push(`[PLATAFORMA] ${featureParts.join(' · ')}`)
  }

  // --- Capabilities summary (ALWAYS) ---
  const caps: string[] = []
  if (hasGoogle) caps.push('Email/Calendar/Drive')
  else if (hasGmail) caps.push('Gmail')
  if (hasTelegram) caps.push('Telegram')
  if (hasOllama) caps.push('Ollama')
  if (leadCount > 0) caps.push(`Growth(${leadCount} leads)`)
  if (salesAgentsRaw.length > 0) caps.push(`Sales(${salesAgentsRaw.length})`)
  if (voiceAgents.length > 0) caps.push(`Voice(${voiceAgents.length})`)
  if (caps.length > 0) sections.push(`[CAPS] ${caps.join(' · ')}`)


  // --- CONSCIENCIA (DIAGNOSTIC ONLY) ---
  if (isActive('diagnostic') && data.consciousness) {
    sections.push(`[🧠 CONSCIENCIA] Nivel: ${data.consciousness.level.toFixed(1)}% | Op:${data.consciousness.operativa} Dat:${data.consciousness.datos} Pred:${data.consciousness.predictiva} Rel:${data.consciousness.relacional}`)
  }

  // --- DETAILED SECTIONS: only when module is active ---

  if (isActive('voice_agents') && voiceAgents.length > 0) {
    const vaList = data.voiceAgents.map(a => `• ${a.name} (${a.tier}, ${a.language.toUpperCase()}, ${a.active ? '✅' : '⏸'})`).join(', ')
    sections.push(`[VOICE AGENTS] ${vaList}`)
  }

  if (isActive('sales_agents') && salesAgentsRaw.length > 0) {
    const saList = data.salesAgents.map(a => `• ${a.name} (${a.active ? '✅' : '⏸'}, ${a.leads} leads)`).join(', ')
    sections.push(`[SALES AGENTS] ${saList}`)
  }

  if (isActive('iot') && deviceCount > 0) {
    sections.push(`[IoT] ${deviceCount} dispositivos (${onlineDeviceCount} online)`)
  }

  const draftCampaigns = Array.isArray(campaignsRaw) ? campaignsRaw.filter(c => c.status === 'draft') : []
  if (isActive('growth_engine') && (leadCount > 0 || activeCampaigns.length > 0)) {
    const campaignList = Array.isArray(campaignsRaw) && campaignsRaw.length > 0
      ? campaignsRaw.map(c => `  • "${c.name}" [${c.status}] leads:${c.totalLeads} sent:${c.sentCount} replies:${c.replyCount} id:"${c.id}"`).join('\n')
      : 'Sin campañas'
    const leadSummary = Array.isArray(recentLeads) && recentLeads.length > 0
      ? '\nLeads recientes: ' + recentLeads.slice(0, 10).map((l) => `${l.contactName || l.businessName} <${l.email || 'sin email'}> [${l.status}]`).join(' · ')
      : ''
    sections.push(`[GROWTH ENGINE] ${leadCount} leads · ${activeCampaigns.length} activas, ${draftCampaigns.length} draft · ${pendingActionCount} pendientes${leadSummary}\n${campaignList}`)
  }

  if (isActive('creative') && (assetCount > 0 || projectCount > 0)) {
    sections.push(`[CREATIVO] ${assetCount} assets · ${projectCount} proyectos`)
  }

  if (isActive('social_bridge') && (socialConns.length > 0 || socialPostCount > 0)) {
    sections.push(`[SOCIAL BRIDGE] ${socialPostCount} posts · Conectado: ${socialConns.join(', ') || 'ninguno'}`)
  }

  if (isActive('invoicing') && invoiceTotal > 0) {
    sections.push(`[FACTURAS] ${invoiceTotal} total${invoiceDrafts > 0 ? ` · ${invoiceDrafts} borradores` : ''}`)
  }

  if (isActive('calendar') && upcomingEvents > 0) {
    sections.push(`[CALENDARIO] ${upcomingEvents} eventos próximos`)
  }

  if (isActive('knowledge_base') && kbDocs > 0) {
    sections.push(`[KB] ${kbDocs} docs · RAG 2.0 activo`)
  }

  if (isActive('subscription') && subData) {
    sections.push(`[SUSCRIPCIÓN] ${subData.status.toUpperCase()}${subData.daysLeft > 0 ? ` · Renueva en ${subData.daysLeft}d` : ''}${subData.canceling ? ' ⚠️ CANCELA' : ''}`)
  }

  if (isActive('diagnostic')) {
    const recs: string[] = []
    if (connectedBrazos.length === 0) recs.push('🔗 Conecta Google Workspace → /dashboard/brazos')
    if (leadCount > 0 && activeCampaigns.length === 0) recs.push('📬 Leads sin campañas → crea una en Growth Engine')
    if (pendingActionCount > 10) recs.push(`📬 ${pendingActionCount} acciones pendientes`)
    if (invoiceDrafts > 0) recs.push(`🧾 ${invoiceDrafts} facturas en borrador`)
    if (recs.length > 0) sections.push(`[💡] ${recs.join(' | ')}`)
  }

  const prompt = '\n' + sections.join('\n') + '\n'

  return { prompt, data }
}
