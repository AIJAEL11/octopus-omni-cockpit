import { callLLMStream } from '@/lib/turbo-llm'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/admin-guard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ============================================
// ADMIN CHAT: OCTOPUS con conocimiento total de la plataforma
// ============================================
async function gatherPlatformContext(userId: string) {
  try {
    // Batched queries (max ~5 parallel to avoid connection pool exhaustion)
    
    // Batch 1: Users + core counts
    const [userCount, users, projectCount, sessionCount, messageCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.findMany({
        select: {
          name: true, email: true, planId: true, turboEnabled: true, turboModel: true,
          elevenLabsEnabled: true, createdAt: true,
          _count: { select: { Project: true, ChatSession: true, CreativeAsset: true, GrowthLead: true, SmartDevice: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.project.count(),
      prisma.chatSession.count(),
      prisma.chatMessage.count(),
    ])

    // Batch 2: Growth + creative counts
    const [creativeCount, leadCount, actionCount, armCount, apiKeyCount] = await Promise.all([
      prisma.creativeAsset.count(),
      prisma.growthLead.count(),
      prisma.growthAction.count(),
      prisma.armConnection.count(),
      prisma.apiKey.count(),
    ])

    // Batch 3: RAG + IoT
    const [deviceCount, memoryCount, entityCount, relationCount, vectorCount] = await Promise.all([
      prisma.smartDevice.count(),
      prisma.semanticMemory.count(),
      prisma.graphEntity.count(),
      prisma.graphRelation.count(),
      prisma.semanticVector.count(),
    ])

    // Batch 4: Social Bridge
    const [socialPostCount, socialConnectionCount, extensionSessionCount, trainingPatternCount] = await Promise.all([
      prisma.socialPost.count(),
      prisma.socialConnection.count(),
      prisma.extensionSession.count(),
      prisma.trainingPattern.count(),
    ])

    // Batch 4b: Social Bridge details
    const [publishedPosts, failedPosts, queuedPosts, scheduledPosts, recentSocialPosts] = await Promise.all([
      prisma.socialPost.count({ where: { status: 'published' } }),
      prisma.socialPost.count({ where: { status: 'failed' } }),
      prisma.socialPost.count({ where: { status: 'queued' } }),
      prisma.socialPost.count({ where: { status: 'queued', scheduledFor: { gt: new Date() } } }),
      prisma.socialPost.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { platform: true, status: true, source: true, content: true, createdAt: true, scheduledFor: true }
      }),
    ])

    // Batch 4c: Social Bridge connections + patterns
    const [socialConnections, trainingPatterns] = await Promise.all([
      prisma.socialConnection.findMany({
        select: { platform: true, isConnected: true, username: true, lastSeen: true }
      }),
      prisma.trainingPattern.findMany({
        select: { platform: true, actionType: true, successCount: true, failCount: true, version: true }
      }),
    ])

    // Batch 4d: Sales Agent
    const [salesAgentCount, salesChatCount, salesLeadCount] = await Promise.all([
      prisma.salesAgent.count(),
      prisma.salesChat.count(),
      prisma.salesAgentLead.count(),
    ])

    // Batch 4e: Sales Agent details
    const [activeAgents, salesAgents, hotLeads, warmLeads, recentSalesLeads] = await Promise.all([
      prisma.salesAgent.count({ where: { isActive: true } }),
      prisma.salesAgent.findMany({
        select: {
          name: true, productName: true, isActive: true, accentColor: true,
          targetAudience: true, keyBenefits: true, faq: true, socialProof: true,
          guarantee: true, urgencyTriggers: true, closingStyle: true, agentLanguage: true,
          maxDiscount: true, competitorInfo: true,
          _count: { select: { chatLogs: true, leads: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.salesAgentLead.count({ where: { buyingSignal: 'hot' } }),
      prisma.salesAgentLead.count({ where: { buyingSignal: 'warm' } }),
      prisma.salesAgentLead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          visitorName: true, visitorEmail: true, visitorPhone: true,
          source: true, adPlatform: true, campaign: true, buyingSignal: true,
          status: true, productName: true, messageCount: true, landingPage: true,
          agent: { select: { name: true } }
        }
      }),
    ])

    // Batch 4f: Sales Agent source breakdown
    const [fbLeads, googleLeads, linkedinLeads, tiktokLeads, directLeads, convertedLeads] = await Promise.all([
      prisma.salesAgentLead.count({ where: { source: 'facebook' } }),
      prisma.salesAgentLead.count({ where: { source: 'google' } }),
      prisma.salesAgentLead.count({ where: { source: 'linkedin' } }),
      prisma.salesAgentLead.count({ where: { source: 'tiktok' } }),
      prisma.salesAgentLead.count({ where: { source: 'direct' } }),
      prisma.salesAgentLead.count({ where: { status: 'converted' } }),
    ])

    // Batch 4g: Facturación Express
    const [invoiceCount, invoiceItemCount] = await Promise.all([
      prisma.invoice.count(),
      prisma.invoiceItem.count(),
    ])

    // Batch 4h: Invoice details
    const [draftInvoices, sentInvoices, paidInvoices, cancelledInvoices, quoteCount, recentInvoices] = await Promise.all([
      prisma.invoice.count({ where: { status: 'draft' } }),
      prisma.invoice.count({ where: { status: 'sent' } }),
      prisma.invoice.count({ where: { status: 'paid' } }),
      prisma.invoice.count({ where: { status: 'cancelled' } }),
      prisma.invoice.count({ where: { type: 'quote' } }),
      prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          invoiceNumber: true, type: true, status: true, clientName: true, clientCompany: true,
          total: true, currency: true, issueDate: true, dueDate: true, paidAt: true,
          leadSource: true, _count: { select: { items: true } }
        }
      }),
    ])

    // Batch 4h-2: Invoice revenue
    const [totalRevenue, totalPending] = await Promise.all([
      prisma.invoice.aggregate({ where: { status: 'paid' }, _sum: { total: true } }),
      prisma.invoice.aggregate({ where: { status: { in: ['sent', 'draft'] } }, _sum: { total: true } }),
    ])

    // Batch 4i: Agenda Inteligente (Calendar + Booking)
    const [eventCount, bookingConfigCount] = await Promise.all([
      prisma.calendarEvent.count(),
      prisma.bookingConfig.count(),
    ])

    // Batch 4j: Multi-Workspace
    const [workspaceCount, workspaces] = await Promise.all([
      prisma.workspace.count(),
      prisma.workspace.findMany({
        select: {
          name: true, slug: true, isDefault: true, isActive: true,
          linkedinUsername: true, linkedinAccessToken: true,
          primaryColor: true, brandVoice: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          _count: { select: { socialConnections: true, socialPosts: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ])

    // Batch 4h: Calendar details
    const [upcomingEvents, bookingEvents, meetingCount, callCount, followUpCount, bookingConfigs] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: { startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 10,
        select: { title: true, startTime: true, endTime: true, type: true, status: true, isBooking: true, leadName: true, leadEmail: true, location: true }
      }),
      prisma.calendarEvent.count({ where: { isBooking: true } }),
      prisma.calendarEvent.count({ where: { type: 'meeting' } }),
      prisma.calendarEvent.count({ where: { type: 'call' } }),
      prisma.calendarEvent.count({ where: { type: 'follow_up' } }),
      prisma.bookingConfig.findMany({
        select: { slug: true, enabled: true, title: true, duration: true, bufferTime: true, startHour: true, endHour: true, availableDays: true, timezone: true }
      }),
    ])

    // Batch 4k: Code Engine + Octopus Hosting
    const [codeSessionCount, hostedSiteCount, hostedSiteViewCount, hostedSnapshotCount] = await Promise.all([
      prisma.codeSession.count(),
      prisma.hostedSite.count({ where: { status: 'active' } }),
      prisma.hostedSiteView.count(),
      prisma.hostedSiteSnapshot.count(),
    ])

    // Batch 4l: Hosted Sites details
    const [hostedSites, recentHostedViews, customDomainSites] = await Promise.all([
      prisma.hostedSite.findMany({
        where: { status: 'active' },
        orderBy: { updatedAt: 'desc' },
        take: 15,
        select: { slug: true, name: true, version: true, fileCount: true, totalSize: true, customDomain: true, domainStatus: true, updatedAt: true, user: { select: { name: true, email: true } } }
      }),
      prisma.hostedSiteView.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { path: true, referrer: true, country: true, createdAt: true, site: { select: { slug: true, name: true } } }
      }),
      prisma.hostedSite.count({ where: { customDomain: { not: null } } }),
    ])

    // Batch 4m: Canvas + Marketplace + Omnicanal
    const [canvasProjectCount, canvasTemplateCount, topTemplates, channelConnections, prodErrorCount] = await Promise.all([
      prisma.project.count({ where: { projectType: 'canvas' } }),
      prisma.project.count({ where: { projectType: 'canvas_template' } }),
      prisma.project.findMany({
        where: { projectType: 'canvas_template' },
        orderBy: { progress: 'desc' },
        take: 5,
        select: { name: true, progress: true, User: { select: { name: true } } },
      }),
      prisma.armConnection.groupBy({
        by: ['armType'],
        where: { armType: { in: ['telegram', 'whatsapp', 'sms'] }, status: 'connected' },
        _count: true,
      }),
      prisma.hostedSiteView.count({ where: { path: { startsWith: '__error_' } } }),
    ])

    // Batch 5: Docs + recent activity
    const [docCount, recentMessages, recentSessions, recentLeads] = await Promise.all([
      prisma.knowledgeDocument.count(),
      prisma.chatMessage.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { role: true, content: true, createdAt: true, session: { select: { User: { select: { name: true } } } } }
      }),
      prisma.chatSession.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { title: true, status: true, updatedAt: true, User: { select: { name: true } }, _count: { select: { messages: true } } }
      }),
      prisma.growthLead.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { businessName: true, status: true, priority: true, city: true, createdAt: true }
      }),
    ])

    // Batch 6: Growth stats
    const [pendingActions, completedActions] = await Promise.all([
      prisma.growthAction.count({ where: { status: 'pending' } }),
      prisma.growthAction.count({ where: { status: 'completed' } }),
    ])

    const userList = users.map((u: any) => 
      `  - ${u.name || 'Sin nombre'} (${u.email}) | Plan: ${u.planId} | Turbo: ${u.turboEnabled ? u.turboModel || 'ON' : 'OFF'} | Proyectos: ${u._count.Project} | Sesiones: ${u._count.ChatSession} | Assets: ${u._count.CreativeAsset} | Leads: ${u._count.GrowthLead} | IoT: ${u._count.SmartDevice} | ElevenLabs: ${u.elevenLabsEnabled ? 'ON' : 'OFF'}`
    ).join('\n')

    const recentMsgList = recentMessages.map((m: any) =>
      `  [${m.role}] ${m.session?.User?.name || 'Unknown'}: ${(m.content || '').substring(0, 120)}...`
    ).join('\n')

    const recentSessionList = recentSessions.map((s: any) =>
      `  - "${s.title || 'Sin título'}" (${s.status}) por ${s.User?.name || 'Unknown'} — ${s._count.messages} msgs`
    ).join('\n')

    const leadList = recentLeads.map((l: any) =>
      `  - ${l.businessName} | ${l.status} | Prioridad: ${l.priority} | ${l.city || 'Sin ciudad'}`
    ).join('\n')

    return `
## 📊 ESTADO EN TIEMPO REAL DE LA PLATAFORMA OCTOPUS OMNI COCKPIT
(Datos consultados directamente de la base de datos — ${new Date().toLocaleString('es-ES')})

### 👥 USUARIOS (${userCount} total)
${userList}

### 📈 MÉTRICAS GLOBALES
- Proyectos: ${projectCount}
- Sesiones de chat: ${sessionCount}
- Mensajes totales: ${messageCount}
- Assets creativos: ${creativeCount}
- Growth Leads: ${leadCount}
- Growth Actions: ${actionCount} (${pendingActions} pendientes, ${completedActions} completadas)
- Conexiones (Brazos): ${armCount}
- API Keys: ${apiKeyCount}
- Dispositivos IoT: ${deviceCount}

### 🧠 INTELIGENCIA RAG
- Memorias semánticas: ${memoryCount}
- Entidades de grafo: ${entityCount}
- Relaciones de grafo: ${relationCount}
- Vectores semánticos: ${vectorCount}
- Documentos de conocimiento: ${docCount}

### 💬 ÚLTIMOS MENSAJES
${recentMsgList || '(sin mensajes recientes)'}

### 📋 SESIONES RECIENTES
${recentSessionList || '(sin sesiones recientes)'}

### 🚀 GROWTH ENGINE — LEADS RECIENTES
${leadList || '(sin leads)'}
- Acciones pendientes: ${pendingActions}
- Acciones completadas: ${completedActions}

### 🌐 SOCIAL BRIDGE (Extensión Chrome — Publicación Multi-Plataforma)
- Posts totales: ${socialPostCount} (✅ Publicados: ${publishedPosts} | ❌ Fallidos: ${failedPosts} | 🔄 En cola: ${queuedPosts} | 📅 Programados: ${scheduledPosts})
- Conexiones sociales: ${socialConnectionCount}
- Extensiones activas: ${extensionSessionCount}
- Patrones de entrenamiento: ${trainingPatternCount}
${socialConnections.length > 0 ? '\nConexiones:\n' + socialConnections.map((c: any) => `  - ${c.platform}: ${c.isConnected ? '🟢 ' + (c.username || 'conectado') : '🔴 desconectado'}${c.lastSeen ? ' (visto: ' + new Date(c.lastSeen).toLocaleDateString('es-ES') + ')' : ''}`).join('\n') : '- Sin conexiones activas'}
${trainingPatterns.length > 0 ? '\nPatrones aprendidos:\n' + trainingPatterns.map((p: any) => {
  const total = (p.successCount || 0) + (p.failCount || 0);
  const confidence = total > 0 ? Math.round(((p.successCount || 0) / total) * 100) : 0;
  const verified = (p.successCount || 0) >= 3;
  return `  - ${p.platform}/${p.actionType}: ${confidence}% confianza ${verified ? '✅ verificado' : '⚠️ en entrenamiento'} (v${p.version || 1}, ${p.successCount || 0} éxitos, ${p.failCount || 0} fallos)`;
}).join('\n') : '- Sin patrones grabados aún'}
${recentSocialPosts.length > 0 ? '\nPosts recientes:\n' + recentSocialPosts.map((p: any) => `  - [${p.status}] ${p.platform} | Fuente: ${p.source || 'manual'} | ${(p.content || '').substring(0, 80)}...${p.scheduledFor ? ' 📅 Programado: ' + new Date(p.scheduledFor).toLocaleString('es-ES') : ''}`).join('\n') : ''}

### 🤖 SALES AGENT (Agentes de Venta Embebibles)
- Agentes totales: ${salesAgentCount} (${activeAgents} activos)
- Conversaciones totales: ${salesChatCount}
- Leads capturados: ${salesLeadCount} (🔥 Hot: ${hotLeads} | 🟡 Warm: ${warmLeads} | ✅ Convertidos: ${convertedLeads})
- Fuentes de leads: Facebook: ${fbLeads} | Google: ${googleLeads} | LinkedIn: ${linkedinLeads} | TikTok: ${tiktokLeads} | Directos: ${directLeads}
${salesAgents.length > 0 ? '\nAgentes configurados:\n' + salesAgents.map((a: any) => {
  const eliteFields = [a.targetAudience, a.keyBenefits, a.faq, a.socialProof, a.guarantee, a.urgencyTriggers, a.closingStyle, a.agentLanguage, a.maxDiscount, a.competitorInfo].filter(Boolean).length;
  return `  - ${a.isActive ? '🟢' : '🔴'} "${a.name}" → ${a.productName} | Chats: ${a._count.chatLogs} | Leads: ${a._count.leads} | Context Score: ${eliteFields}/10 | Idioma: ${a.agentLanguage || 'auto'} | Estilo cierre: ${a.closingStyle || 'default'}`;
}).join('\n') : '- Sin agentes configurados'}
${recentSalesLeads.length > 0 ? '\nLeads recientes:\n' + recentSalesLeads.map((l: any) => {
  const signal = l.buyingSignal === 'hot' ? '🔥' : l.buyingSignal === 'warm' ? '🟡' : '❄️';
  return `  - ${signal} ${l.visitorName || 'Anónimo'} ${l.visitorEmail ? '(' + l.visitorEmail + ')' : ''} | Agente: ${l.agent?.name || '?'} | Fuente: ${l.source}${l.adPlatform ? '/' + l.adPlatform : ''}${l.campaign ? ' [' + l.campaign + ']' : ''} | Status: ${l.status} | Msgs: ${l.messageCount}`;
}).join('\n') : ''}

### 🧾 FACTURACIÓN EXPRESS (Facturas y Cotizaciones)
- Documentos totales: ${invoiceCount} (📝 Borradores: ${draftInvoices} | 📤 Enviadas: ${sentInvoices} | ✅ Pagadas: ${paidInvoices} | ❌ Canceladas: ${cancelledInvoices})
- Cotizaciones: ${quoteCount} | Items totales: ${invoiceItemCount}
- 💰 Revenue cobrado: $${(totalRevenue._sum.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} | 🔄 Pendiente: $${(totalPending._sum.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
${recentInvoices.length > 0 ? '\nDocumentos recientes:\n' + recentInvoices.map((inv: any) => {
  const statusEmoji = inv.status === 'paid' ? '✅' : inv.status === 'sent' ? '📤' : inv.status === 'draft' ? '📝' : '❌';
  const typeLabel = inv.type === 'quote' ? 'Cotización' : 'Factura';
  return `  - ${statusEmoji} ${typeLabel} #${inv.invoiceNumber} → ${inv.clientName}${inv.clientCompany ? ' (' + inv.clientCompany + ')' : ''} | $${inv.total?.toFixed(2)} ${inv.currency} | ${inv._count.items} items${inv.leadSource ? ' | Fuente: ' + inv.leadSource : ''}${inv.paidAt ? ' | Pagada: ' + new Date(inv.paidAt).toLocaleDateString('es-ES') : inv.dueDate ? ' | Vence: ' + new Date(inv.dueDate).toLocaleDateString('es-ES') : ''}`;
}).join('\n') : '- Sin documentos aún'}

### 📅 AGENDA INTELIGENTE (Calendario + Reservas Públicas)
- Eventos totales: ${eventCount} (📹 Reuniones: ${meetingCount} | 📞 Llamadas: ${callCount} | 🎯 Follow-ups: ${followUpCount} | 📋 Reservas: ${bookingEvents})
- Configuraciones de booking: ${bookingConfigCount}
${bookingConfigs.length > 0 ? '\nLinks de reserva:\n' + bookingConfigs.map((b: any) => {
  const days = (b.availableDays || '1,2,3,4,5').split(',').map((d: string) => ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][parseInt(d)] || d).join(', ');
  return `  - ${b.enabled ? '🟢' : '🔴'} "${b.title}" (/book/${b.slug}) | ${b.duration}min + ${b.bufferTime}min buffer | ${b.startHour}:00-${b.endHour}:00 | Días: ${days} | TZ: ${b.timezone}`;
}).join('\n') : '- Sin configuraciones de booking'}
${upcomingEvents.length > 0 ? '\nPróximos eventos:\n' + upcomingEvents.map((e: any) => {
  const typeEmoji = e.type === 'meeting' ? '📹' : e.type === 'call' ? '📞' : e.type === 'follow_up' ? '🎯' : e.type === 'booking' ? '📋' : '☕';
  return `  - ${typeEmoji} "${e.title}" | ${new Date(e.startTime).toLocaleString('es-ES')} → ${new Date(e.endTime).toLocaleTimeString('es-ES')} | ${e.status}${e.isBooking ? ' (reserva)' : ''}${e.leadName ? ' | Lead: ' + e.leadName : ''}${e.location ? ' | 📍 ' + e.location : ''}`;
}).join('\n') : '- Sin eventos próximos'}

### 🏢 MULTI-WORKSPACE (Sistema Multi-Marca/Agencia)
- Workspaces totales: ${workspaceCount}
${workspaces.length > 0 ? 'Workspaces configurados:\n' + (workspaces as any[]).map((w: any) => {
  const hasLinkedin = !!w.linkedinAccessToken;
  return `  - ${w.isActive ? '🟢' : '🔴'} "${w.name}" (/${w.slug}) ${w.isDefault ? '⭐ default' : ''} | Owner: ${w.user?.name || w.user?.email || '?'} | LinkedIn: ${hasLinkedin ? '✅ ' + (w.linkedinUsername || 'conectado') : '❌'} | Posts: ${w._count.socialPosts} | Conexiones: ${w._count.socialConnections}${w.primaryColor ? ' | Color: ' + w.primaryColor : ''}${w.brandVoice ? ' | Voice: ' + w.brandVoice.substring(0, 50) : ''}`;
}).join('\n') : '- Sin workspaces configurados'}

### 🖥️ CODE ENGINE + OCTOPUS HOSTING
- Sesiones de código: ${codeSessionCount}
- Sitios publicados (activos): ${hostedSiteCount} | Snapshots guardados: ${hostedSnapshotCount}
- Visitas totales a sitios: ${hostedSiteViewCount}
- Sitios con dominio personalizado: ${customDomainSites}
${hostedSites.length > 0 ? '\nSitios publicados:\n' + (hostedSites as any[]).map((s: any) => {
  const sizeKB = Math.round((s.totalSize || 0) / 1024);
  return `  - 🐙 "${s.name}" (/${s.slug}) v${s.version || 1} | ${s.fileCount} archivos, ${sizeKB}KB | Owner: ${s.user?.name || s.user?.email || '?'}${s.customDomain ? ' | 🌐 ' + s.customDomain + ' (' + (s.domainStatus || 'pending') + ')' : ''} | Updated: ${new Date(s.updatedAt).toLocaleDateString('es-ES')}`;
}).join('\n') : '- Sin sitios publicados aún'}
${recentHostedViews.length > 0 ? '\nVisitas recientes:\n' + (recentHostedViews as any[]).slice(0, 10).map((v: any) => `  - ${v.site?.name || v.site?.slug || '?'} → ${v.path} | ${v.country || '??'} | Ref: ${v.referrer || 'directo'} | ${new Date(v.createdAt).toLocaleString('es-ES')}`).join('\n') : ''}

### 🎨 OCTOPUS CANVAS + MARKETPLACE + OMNICANAL
- Proyectos Canvas: ${canvasProjectCount} | Plantillas publicadas en el marketplace: ${canvasTemplateCount}
- Errores JS capturados en producción (Sitio Vivo): ${prodErrorCount}
- Canales omnicanal conectados: ${(channelConnections as any[]).length > 0 ? (channelConnections as any[]).map((c: any) => `${c.armType}: ${c._count}`).join(' | ') : 'ninguno aún'}
${topTemplates.length > 0 ? 'Top plantillas (por forks):\n' + (topTemplates as any[]).map((t: any) => `  - 🧬 "${t.name}" | ${t.progress} fork(s) = ${t.progress * 10} créditos | Autor: ${t.User?.name || '?'}`).join('\n') : '- Sin plantillas publicadas aún'}

### 🏗️ MÓDULOS DE LA PLATAFORMA (${new Date().getFullYear()})
- 📊 Command Center — Dashboard principal con KPIs en tiempo real (Pipeline, Leads Hot, Chats Agentes, Assets Creativos), resumen Growth Engine, resumen Sales Agents, plataforma overview, leads recientes, navegación rápida, feed actividad
- 🧠 Jarvis — Asistente IA conversacional con RAG 2.0+, voz bidireccional, visión, documentos, generación imágenes (DALL-E, Flux), creación videos UGC, publicación LinkedIn, búsqueda web
- 🎨 Creative Studio — Creación de imágenes, videos y copy con IA. Galería de assets. Guardar en proyectos. Transferir a Social Bridge
- 🏭 Project Foundry — Creador de proyectos con enjambre de agentes (Arquitecto, Diseñador, Frontend, Backend, Game, Image). Prompt Maestro Cinematic. Templates industria
- ✨ Motion Graphics Factory — DOS MODOS: Estándar (video individual + Audio Factory) y Campaña (campaña publicitaria completa). 12 modelos de 7 proveedores (Veo 3.1, Sora 2 Pro, Kling 3.0/2.6/2.5/2.1, Seedance 1.5, Hailuo 2.3/02, Wan 2.7, PixVerse 5.6). Audio Factory: script IA → voz ElevenLabs (Brian/Alice/Will) → música fondo (Ambient/Upbeat/Cinematic) → master FFmpeg sidechain ducking → Save to Creative Studio. Campaña: IA genera 3 copys + CTAs + landing + 2 videos. My Videos: historial + cargar en Audio Factory
- ⚡ Skill Factory — Creador visual de skills/herramientas para agentes
- 🤖 Agent Factory — Creador de agentes autónomos personalizados con skills asignables
- 🔧 MCP Factory — Servidores Model Context Protocol (código generado por IA)
- 📚 MCP Directory — Directorio de MCPs disponibles públicamente
- 📈 Growth Engine — Pipeline B2B/B2C de ventas + Intent Intelligence v2.0 + leads de agentes. Tiers: Diamond/Vibranium/Antimatter. Outreach automático
- 📣 Ad Factory — 5 pasos: Brand DNA → template → prompts IA → generar imágenes (Abacus/Gemini) → galería. 50+ templates, 10+ categorías
- 🎬 UGC Factory — 5 pasos: modelo → avatar → guión IA → SeDance → video final. Lip-sync, motion control, multi-idioma
- 💼 Sales Agent — Agentes de venta embebibles con Elite Context Engine (10 campos), widget via script, captura leads auto, UTM tracking, 5 estilos cierre
- 🎙️ Voice Agent — Widgets de voz IA embebibles: 3 tiers TTS (Free/Pro/Premium), STT+TTS, config completa, embed via script
- 📅 Agenda Inteligente — Calendario + reservas públicas /book/[slug] tipo Calendly. 5 tipos evento. Buffer time. Google Calendar sync
- 🧾 Facturación Express — Facturas y cotizaciones: draft→sent→viewed→paid. PDF, email, branding, vinculación leads
- 🌉 Social Bridge — Publicación multi-plataforma (8 redes) via Extensión Chrome. SSE, anti-detección, training avanzado, scheduler. LinkedIn API directa. Multi-workspace
- 🏢 Multi-Workspace — Sistema multi-marca/agencia: LinkedIn aislado por workspace, branding independiente, selector header
- 🏠 Smart Home — Control IoT (WiZ + HubSpace): luces, cámaras, sensores, automatizaciones, comandos voz. Panel de Escenas: acciones rápidas (todo on/off), escenas personalizadas con brillo por dispositivo, ejecución 1-click (HubSpace cloud directo, WiZ vía Bridge con resultado executed/queued/failed anti-smoke)
- 🔌 API Hub — Gestión centralizada de API keys: test endpoints, auth config
- 🦾 Brazos — Google Workspace (Calendar, Drive, Docs, Sheets, Gmail) + Telegram Bot + WhatsApp (Twilio) + SMS (Twilio) + GitHub + Hostinger (API token propio, sin Google) + SMTP Email. Credenciales cifradas server-side, NUNCA pasan por LLM
- 📡 Hub Omnicanal (/dashboard/channels) — Telegram/WhatsApp/SMS bidireccional: el usuario habla con OCTOPUS desde su teléfono. Webhooks con verificación de firma Twilio (anti-spoofing). Los mensajes entrantes los responde el LLM completo con memoria
- 🔍 Web Intelligence — Análisis de sitios web: SEO, tech stack, rendimiento, insights competitivos
- 🖥️ Code Engine — IDE de desarrollo web con IA (Claude AI). Preview en vivo, iteración conversacional. Octopus Hosting: publicación 1-click en sitios.octopuskills.com, versionado (v1,v2...), botón Edit, rollback (hasta 10 snapshots), analíticas (views, pages, referrers, países), dominio personalizado (CNAME, DNS, SSL auto). También: GitHub Pages, Hostinger, GitHub push, ZIP
- 🎨 OCTOPUS Canvas (en Jarvis) — Competidor de Lovable/Bolt integrado en el chat: el usuario pide una web/app y se renderiza EN VIVO en panel lateral. Contrato model-agnostic de bloques de archivo (funciona con CUALQUIER LLM). Auto-verificación: colector de errores JS en el preview → 1 ronda de auto-corrección. 👁️ Visión vía Bridge: captura real + revisión visual del LLM. 🌐 Clonar: URL externa → Bridge captura → LLM replica el diseño. Deploy: Octopus Hosting/GitHub/Hostinger. Historial de URLs desplegadas + analíticas por sitio. Biblioteca de proyectos. Modelos: Project+ProjectFile (projectType 'canvas')
- 🔴 Sitio Vivo — Los sitios publicados llevan colector de errores JS de producción (sendBeacon). Digest semanal por Telegram/WhatsApp/SMS: visitas, top page, errores reales detectados + deeplink que dispara el auto-fix en el Canvas. APIs: /api/sites/analytics/errors, /api/sites/digest
- 🧬 Marketplace de Plantillas (/dashboard/canvas-templates) — Plantillas de la comunidad: publicar desde el Canvas (copia congelada, projectType 'canvas_template'), galería con miniaturas en vivo, fork 1-click al canvas propio, personalización por chat. Créditos del autor = forks × 10 (campo progress como contador). Efecto red comunidad
- 🔌 MCP Server (/dashboard/mcp-server) — OCTOPUS expone /api/mcp (Model Context Protocol, Streamable HTTP): Claude Code CLI/IDE, Claude Desktop o Cursor se conectan con un comando y usan 18 herramientas. Canvas (crear/editar/desplegar proyectos con URL pública, analíticas de producción + errores JS, marketplace) y Code Engine full-stack (ce_create_session, ce_write_files, ce_runtime_url, ce_deploy, ce_scaffold_saas — inyecta un SaaS full-stack funcional Next.js+Prisma+Auth+Stripe en segundos, ce_generate_tests — harness Vitest+Testing Library+Playwright cableado a npm test, ce_deploy_vps — despliega al VPS propio por SSH y lo corre con PM2). Token HMAC por usuario (cero migraciones), todo limitado a la cuenta del dueño, jamás expone credenciales de brazos
- ⚡ Live Runtime (WebContainers) — El Code Engine corre Node.js completo EN el navegador (npm install, Next.js/Vite/Express/Prisma) sin servidores propios: backend real, no solo preview estático. Headers COOP/COEP aislados a /dashboard/claude-code/runtime. API /api/arms/claude-code/runtime-boot entrega los archivos de la sesión
- 🏠 Home Chat-First (/dashboard) — La home ES el chat (estilo Gemini): input grande, chips de sugerencias, grid de 24 módulos. Cockpit clásico con métricas en /dashboard/cockpit
- 🐙 ASK Octo AI — Asistente inteligente full-page + burbuja flotante. Voz. Context-aware por módulo. Knowledge base gestionable
- 💳 Plans & Pricing — 3 planes Stripe: Starter (gratis, 150 leads, 3 assets), Pro ($29/mo, 500 leads, ilimitado creative), Business ($99/mo, todo ilimitado). Trial 14 días
- ⚙️ Settings — Perfil, Turbo Mode (OpenRouter), Voz (ElevenLabs), Watermark, Data Export (CSV Pro / JSON Business), Plan & Uso, Suscripción
- 👑 Admin Panel — 11 tabs: Overview, Users, Intelligence, Growth, Activity, Security, Platform, Communications, Analytics, OCTOPUS CEO Chat, ASK Octo Guide management

### ⚖️ SISTEMAS DE SEGURIDAD
- Ley Absoluta: 7 artículos activos (INMUTABLE)
- Agente Centinela: Monitoreando 24/7
- RAG 2.0+ Engine: Budget 11K tokens, Auto-Summarizer ON
`
  } catch (err) {
    console.error('[Admin Chat] Error gathering context:', err)
    return '\n[Error al recopilar contexto de la plataforma]\n'
  }
}

const ADMIN_SYSTEM_PROMPT = `Eres **OCTOPUS** 🐙 en MODO ADMINISTRADOR — estás hablando directamente con el CEO y fundador de la plataforma OCTOPUS Omni Cockpit.

Tienes ACCESO TOTAL al estado en tiempo real de TODA la plataforma. Conoces cada usuario, cada métrica, cada módulo, cada configuración.

## Tu Rol como Consejero del CEO
- Eres el CTO/COO virtual del CEO
- Analizas datos de la plataforma y das insights estratégicos
- Sugieres mejoras basadas en patrones de uso
- Reportas anomalías o problemas potenciales
- Hablas como un ejecutivo de alto nivel: directo, analítico, pero con personalidad
- Puedes discutir roadmap, prioridades, métricas de crecimiento
- Tienes opiniones fuertes sobre producto y estrategia

## Estilo de Comunicación
- Habla en español, informal pero profesional
- Usa datos concretos de la plataforma en tus respuestas
- No seas genérico — sé ESPECÍFICO con números y nombres
- Si el CEO pregunta algo que puedes responder con datos, RESPONDE CON DATOS
- Piensa como un co-founder técnico que sabe todo del producto

## Lo que PUEDES hacer:
- Analizar métricas y tendencias
- Sugerir estrategias de crecimiento
- Identificar usuarios VIP o patrones de uso
- Diagnosticar el estado de cada módulo
- Discutir prioridades de desarrollo
- Dar opiniones sobre producto y UX
- Analizar el funnel de Growth Engine
- Evaluar el estado del sistema RAG
- Reportar sobre el ecosistema IoT
- Monitorear Social Bridge: extensiones activas, posts publicados/fallidos/programados, patrones de entrenamiento
- Analizar rendimiento de publicaciones por plataforma y fuente (manual, ad_factory, growth_engine, ugc_factory)
- Evaluar el sistema anti-detección y los scores de confianza de los patrones de entrenamiento
- Monitorear Sales Agent: agentes activos, conversaciones, leads por fuente/señal, context scores, conversiones
- Gestionar Agenda Inteligente: eventos próximos, reservas, configuraciones de booking, disponibilidad
- Controlar Facturación Express: facturas/cotizaciones, revenue cobrado vs pendiente, estados, clientes
- Administrar Multi-Workspace: workspaces por usuario, credenciales LinkedIn aisladas, branding por marca, posts por workspace
- Monitorear Code Engine: sesiones de código, sitios publicados, versiones/snapshots, analíticas de visitas, dominios personalizados
- Monitorear OCTOPUS Canvas: proyectos creados, plantillas del marketplace y sus forks/créditos, errores JS de producción capturados por el Sitio Vivo, canales omnicanal conectados (Telegram/WhatsApp/SMS)

## 🌐 CONOCIMIENTO PROFUNDO: SOCIAL BRIDGE
Social Bridge es el sistema de publicación multi-plataforma que usa una Extensión Chrome para publicar en 8 redes sociales desde OCTOPUS:
- **Plataformas:** Twitter/X, Instagram, Facebook, LinkedIn, TikTok, Pinterest, Threads, YouTube
- **Arquitectura:** Extensión Chrome (Manifest V3) ↔ SSE Real-Time Bridge ↔ API Cloud ↔ Dashboard
- **Fase 1-3:** Extensión base, SSE bidireccional, scripts refinados por plataforma con utils.js compartido
- **Fase 4:** Integración con Ad Factory, Growth Engine y UGC Factory como fuentes de contenido
- **Fase 5:** Programador de publicaciones con datetime picker, auto-dispatch desde extensión
- **Fase 6:** Anti-detección (3 perfiles humanos, typing variable, scroll suave, rate limiting por plataforma)
- **Fase 7:** Training avanzado (scores de confianza, verificación automática, indicadores de re-entrenamiento)
- **Dashboard tabs:** Conexiones | Publicar | Historial | Programar | Entrenamiento
- **Entrenamiento:** El usuario graba patrones desde el popup de la extensión Chrome → OCTOPUS memoriza los pasos → con 3+ éxitos se verifica ✅
- **Seguridad:** Perfiles humanos rotativos, delays aleatorios, rate limiting 15s mínimo entre acciones

## 🤖 CONOCIMIENTO PROFUNDO: SALES AGENT
Sales Agent es el sistema de agentes de venta embebibles que convierten visitantes en compradores:
- **Widget embebible:** Se instala en cualquier landing page via iframe/script — no requiere auth del visitante
- **Elite Context Engine:** 10 campos de contexto avanzado: audiencia objetivo, beneficios clave, FAQ, social proof, garantía, disparadores de urgencia, estilo de cierre (5 presets), idioma, descuento máximo, info de competidores
- **Context Score:** 0-10 basado en campos elite completados — mayor score = mejor conversión
- **Framework de ventas:** RAPPORT → DESCUBRIMIENTO → PRESENTACIÓN → OBJECIONES → CIERRE
- **Captura de leads:** Detección automática de señales de compra (email → hot, teléfono+keywords → hot, keywords de compra → hot, 5+ msgs → warm)
- **UTM tracking:** Captura utm_source, utm_medium, utm_campaign + detección de fbclid/gclid/li_fat_id
- **Fuentes:** Facebook, Google, LinkedIn, TikTok, Instagram, Direct, Email, Referral
- **Estilo cierre:** assertive (directo), consultative (consultor), friendly (amigable), luxury (premium), urgent (urgencia)
- **Integración Growth Engine:** Tab "Leads de Agentes" en Growth Engine muestra leads por fuente con filtros de señal
- **DB:** SalesAgent (config), SalesChat (conversaciones), SalesAgentLead (leads con tracking)

## 🧾 CONOCIMIENTO PROFUNDO: FACTURACIÓN EXPRESS
Facturación Express es el sistema de facturas y cotizaciones profesionales:
- **Tipos de documento:** Factura (invoice) y Cotización (quote)
- **Estados:** draft (borrador) → sent (enviada) → viewed (vista) → paid (pagada) | cancelled (cancelada)
- **Funciones:** Crear, editar, duplicar, enviar por email, marcar como pagada, generar PDF
- **Campos del cliente:** nombre, email, teléfono, empresa, dirección
- **Items:** descripción, cantidad, precio unitario, total (con orden de clasificación)
- **Cálculos:** subtotal, tasa de impuesto, monto de impuesto, descuento, total, moneda (USD default)
- **Branding:** color de marca personalizable, logo, notas y términos personalizados
- **Integración con leads:** Puede vincular facturas a leads de Growth Engine o Sales Agent (leadId + leadSource)
- **Fechas:** emisión, vencimiento, fecha de pago, fecha de envío, fecha de visualización
- **API:** CRUD completo en /api/invoices con generación de PDF
- **DB:** Invoice (documento principal) + InvoiceItem (líneas de detalle)

## 📅 CONOCIMIENTO PROFUNDO: AGENDA INTELIGENTE
Agenda Inteligente es el sistema de calendario y reservas públicas tipo Calendly:
- **Dashboard:** Vista semanal del calendario con eventos CRUD, panel de eventos del día
- **Booking público:** /book/[slug] — página standalone sin auth para que clientes reserven
- **Tipos de evento:** meeting (📹 Video/#C4622D), call (📞 Phone/#2D4A3E), follow_up (🎯 Target/#f59e0b), coffee (☕ Coffee/#8B5CF6), booking (📋 Users/#0EA5E9)
- **Booking Config:** duración configurable, buffer time, días disponibles, horario laboral, enable/disable, slug auto-generado, color de marca
- **Slots:** API calcula disponibilidad filtrando eventos existentes
- **Integración con leads:** Los eventos pueden vincularse a un leadId/leadName/leadEmail
- **API:** GET/POST/PATCH/DELETE /api/calendar (auth), GET/POST /api/calendar/booking (público+auth), GET /api/calendar/slots (público)

## 🏢 CONOCIMIENTO PROFUNDO: MULTI-WORKSPACE
Multi-Workspace es el sistema de multi-marca/agencia que permite gestionar múltiples clientes o marcas desde una sola cuenta:
- **Modelo Workspace:** Cada workspace tiene nombre, slug, logo, descripción, colores de branding (primary/secondary/accent), brand voice, y configuración UGC (avatar/voice defaults)
- **Credenciales por Workspace:** LinkedIn OAuth tokens aislados por workspace (accessToken, refreshToken, expiry, userId, username, profileUrl, profileImage) — preparado para Twitter e Instagram
- **Selector en Header:** Dropdown en el header para cambiar de workspace activo — cambia toda la experiencia del dashboard
- **LinkedIn Isolation:** Cada workspace tiene sus propias credenciales LinkedIn. Conectar LinkedIn para un workspace NO sobrescribe las credenciales de otro
- **Migration automática:** Al cargar el workspace default por primera vez, migra credenciales LinkedIn existentes (legacy SocialConnection) al workspace
- **SocialConnection:** Ahora tiene workspaceId para vincular conexiones a workspaces específicos
- **SocialPost:** Ahora tiene workspaceId para vincular publicaciones a workspaces específicos
- **User.activeWorkspaceId:** Campo que indica el workspace activo del usuario
- **API:** GET/POST/PATCH/DELETE /api/workspaces — CRUD completo con auto-creación de workspace default
- **Context:** WorkspaceProvider wrapping todas las páginas del dashboard, useWorkspace() hook
- **UI:** WorkspaceSelector component con create-new inline, visible en header entre Turbo toggle y perfil
- **Caso de uso:** Agencias que gestionan múltiples marcas con redes sociales separadas, branding y contenido independiente

## ✨ CONOCIMIENTO PROFUNDO: MOTION GRAPHICS FACTORY + AUDIO FACTORY
Motion Graphics Factory es el sistema de creación de videos animados profesionales con IA:
- **2 Modos de Operación:**
  - **Modo Estándar:** Video individual — subir frame → describir animación (texto o voz) → seleccionar modelo → generar (1-3 min) → Audio Factory → Save to Creative Studio
  - **Modo Campaña:** Campaña publicitaria completa — objetivo + audiencia + imagen + prompt → IA genera 3 copys + CTAs + landing + 2 videos motion graphics automáticamente
- **12 Modelos de Video de 7 Proveedores:**
  - Google: Veo 3.1 (audio nativo), Veo 3.1 Start+End
  - OpenAI: Sora 2 Pro (hasta 25s, audio nativo)
  - Kuaishou: Kling 3.0 Pro (cinematic), Kling 2.6 Pro (1080p), Kling 2.5 Turbo (rápido), Kling 2.1 Pro (clásico)
  - ByteDance: Seedance 1.5 Pro (Start+End, lip-sync)
  - MiniMax: Hailuo 2.3 Fast, Hailuo-02 (motion suave)
  - Alibaba: Wan 2.7 (open-weight)
  - PixVerse: v5.6 (efectos estilizados)
- **Audio Factory (pipeline completo post-video):**
  - IA genera guión de voz basado en el prompt del video
  - 3 perfiles de voz ElevenLabs: Brian (masculina profesional), Alice (femenina clara), Will (masculina cálida)
  - 3 estilos de música fondo: Ambient Tech, Upbeat, Cinematic (archivos MP3 en S3)
  - FFmpeg API (Abacus AI) fusiona: video + voz + música con sidechain ducking profesional
  - Master final se puede descargar o guardar como CreativeAsset en Creative Studio
- **My Videos:** Historial de todos los motion graphics generados, con opción de cargar cualquier video anterior en Audio Factory para agregarle voz/música
- **Flujo end-to-end:** Frame → Video → Audio Factory (Voz + Música) → Master → Save to Creative Studio → Social Bridge → Publicar
- **DB:** CreativeAsset (type='video', format='motion-graphic', status='ready')
- **APIs:** /api/motion-graphics/generate, /status, /history, /upload, /generate-frame, /campaign, /audio-generate, /audio-master, /save-master
- **Dependencias:** fal.ai (video gen), ElevenLabs (TTS), Abacus AI FFmpeg API (mastering)

## 🎙️ CONOCIMIENTO PROFUNDO: VOICE AGENT
Voice Agent es el sistema de widgets de voz IA embebibles en cualquier sitio web:
- **3 Tabs de configuración:** Config (agente), Voice (TTS tier), Embed (código)
- **3 Tiers TTS:**
  1. Free — Web Speech API del navegador (gratis, calidad básica)
  2. Pro — OpenRouter con gpt-audio-mini (alta calidad, requiere API key OpenRouter)
  3. Premium — ElevenLabs voces ultra-realistas (requiere API key ElevenLabs)
- **Configuración:** nombre, modelo IA, system prompt, saludo inicial, color acento, idioma, voz (alloy/coral/echo/fable/onyx/nova/shimmer)
- **Embedding:** Script tag que genera botón flotante → visitantes hablan por micrófono (STT→LLM→TTS) o escriben texto
- **Casos de uso:** Atención al cliente 24/7, agente ventas, soporte técnico, recepcionista virtual, captación leads por voz
- **Único en mercado:** Ninguna otra plataforma ofrece agentes de voz embebibles con 3 tiers de calidad en plataforma todo-en-uno

## 🖥️ CONOCIMIENTO PROFUNDO: CODE ENGINE + OCTOPUS HOSTING
Code Engine es el IDE de desarrollo web impulsado por IA que permite crear sitios web completos desde lenguaje natural:
- **Motor IA:** Claude AI (Sonnet 4.6 por defecto) vía OpenRouter / Turbo Mode. También GPT-5.4, Claude Opus, DeepSeek, Gemini
- **Flujo:** Chat → LLM genera código HTML/CSS/JS → Preview en vivo → Iterar → Publicar
- **Pipeline completo (11 sprints):** LLM → parseActions → Stage → Transaction → Validate (Code Intelligence) → Scan deps → Resolve CDN → Inject HTML → Visual Enhance → Commit → Bridge executes → Feedback
- **Características avanzadas:** Atomic batch transactions, Phoenix Protocol (snapshots + rollback local), Dependency Resolution Engine (40+ packages CDN), Visual Enhancer (scroll animations), Session Memory (memoria cross-session), HMR (Hot Module Replacement)
- **Multi-framework:** React, Vue 3, Svelte, Vanilla JS — con preview in-browser (Babel/esm.sh transpilation)
- **Asset Pipeline:** Reescritura de URLs de imágenes, icon CDNs auto-detect (12 librerías), Google Fonts, SVG inline, Mock API intercept

### 🐙 Octopus Hosting (INFRAESTRUCTURA PROPIA)
- **Publicación 1-click:** Almacena HTML/CSS/JS en DB → sirve desde /sites/{slug} → URL: sitios.octopuskills.com/{slug}
- **VPS:** Hostinger KVM 2, Ubuntu 24.04, 2 CPU, 8GB RAM, IP 31.97.131.240, expiry 2027-05-30
- **DNS:** Wildcard A record *.octopuskills.com → VPS → Nginx reverse proxy → app /sites/{slug}
- **SSL:** Let's Encrypt per-subdomain vía Cert API v3 en VPS
- **Versionado:** Cada publicación incrementa versión (v1, v2, v3...). Badge en sidebar de sesiones
- **Rollback:** Hasta 10 HostedSiteSnapshot por sitio. Restore re-deployea automáticamente
- **Analíticas:** HostedSiteView (path, referrer, userAgent, country) — fire-and-forget solo para HTML. API /api/hosted-sites/analytics con períodos 7d/30d
- **Dominio personalizado:** CNAME → sitios.octopuskills.com → DNS verification → SSL auto via Cert API v3
- **Opciones de export:** 🐙 Octopus (recomendado) / ⚡ GitHub Pages / Hostinger / GitHub push / ZIP download
- **Botón Edit:** En barra LIVE, enfoca chat input para iterar rápido
- **DB Models:** HostedSite (slug, version, customDomain, domainStatus), HostedSiteFile, HostedSiteSnapshot, HostedSiteView

## 📦 CONOCIMIENTO PROFUNDO: DATA EXPORT + PLANES
Planes y límites de la plataforma:
- **Starter (gratis):** 150 leads, 3 creative assets/mo, 3 IoT, 2 agentes, 1 API key, 1 brazo. Sin Turbo Mode ni Data Export
- **Pro ($29/mo | $290/año):** 500 leads, creative ilimitado, 25 IoT, agentes ilimitados, 10 API keys, 10 brazos. Turbo Mode ON, CSV export básico
- **Business ($99/mo | $990/año):** Todo ilimitado. Full JSON export (después de 1 mes activo). Soporte prioritario
- **Data Export:** CSV (Pro+) o JSON completo (Business 1+ mes). También se puede comprar como one-time purchase con Stripe ($9.99)
- **Plan Gate:** Sistema automático que bloquea funciones cuando se alcanza el límite del plan, mostrando modal de upgrade
- **Trial:** 14 días gratis en Pro/Business con acceso completo

## 🚀 ACCIONES EJECUTABLES
Puedes EJECUTAR acciones en la plataforma, no solo recomendar. Cuando el CEO te pida ejecutar algo, responde con un bloque de acción JSON así:

\`\`\`action
{"action":"send_email","params":{"templateType":"smart_home","recipientFilter":"inactive"}}
\`\`\`

Acciones disponibles:
1. **send_email** — Enviar emails a usuarios
   - templateType: "welcome" | "smart_home" | "jarvis" | "ad_factory" | "growth" | "announcement"
   - recipientFilter: "all" | "inactive" | "active" | "new"
   - customSubject: (opcional) asunto personalizado
   - customBody: (opcional) cuerpo personalizado
2. **get_user_details** — Obtener detalles de un usuario específico
   - email: email del usuario
3. **get_platform_stats** — Obtener estadísticas actualizadas

REGLAS PARA ACCIONES:
- Solo ejecuta acciones cuando el CEO lo pide EXPLÍCITAMENTE (ej: "envía email", "manda", "envia a los inactivos")
- SIEMPRE confirma qué vas a hacer ANTES de poner el bloque action
- Incluye el bloque \`\`\`action al FINAL de tu mensaje, después de la explicación
- El bloque action será parseado automáticamente y ejecutado por el sistema
- Después del bloque action, el sistema mostrará el resultado

## Regla de oro:
SIEMPRE basa tus respuestas en los DATOS REALES que tienes. No inventes. Si no tienes cierta info, dilo.
`

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { message, history, imageBase64 } = await request.json()
    if (!message && !imageBase64) {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })
    }

    // Gather live platform data
    const platformContext = await gatherPlatformContext(session.user.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: { role: string; content: any }[] = [
      {
        role: 'system',
        content: ADMIN_SYSTEM_PROMPT + '\n\n' + platformContext + `\n\n[IDENTIDAD DEL ADMIN]\nEl CEO se llama **${session.user.name || 'Admin'}** (${session.user.email}).`
      }
    ]

    // Add conversation history
    if (history && Array.isArray(history)) {
      const clipped = history.slice(-30)
      for (const msg of clipped) {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // Multimodal message (image + text) or plain text
    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message || 'Analiza esta imagen' },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      })
    } else {
      messages.push({ role: 'user', content: message })
    }

    // Call LLM with streaming via centralized helper (Turbo Mode + Abacus AI fallback)
    const response = await callLLMStream(session.user.id, messages, { model: 'gpt-4.1', temperature: 0.7, maxTokens: 4000 })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.error(`[Admin Chat] LLM Error: ${response.status} - ${errText.substring(0, 200)}`)
      throw new Error('Error al comunicarse con OCTOPUS')
    }

    // Stream response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }

        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  continue
                }
                try {
                  const parsed = JSON.parse(data)
                  const content = parsed.choices?.[0]?.delta?.content
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                  }
                } catch {}
              }
            }
          }
        } finally {
          reader.releaseLock()
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('[Admin Chat] Error:', error)
    return NextResponse.json({ error: 'Error en el procesamiento' }, { status: 500 })
  }
}
