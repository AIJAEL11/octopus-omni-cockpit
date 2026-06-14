// ═══════════════════════════════════════════════════════════════════════════════
// MEGA SKILL: Lead-to-Asset — Orchestration Service (Sprint 2 — REAL AI)
// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline: Lead → Real AI Asset Generation → Email Delivery
// Connects to: UGC Factory (video), Ad Factory (image), ElevenLabs (audio),
//              LLM + HTML2PDF (document), Notification API (email)

import { prisma } from '@/lib/prisma';
import { leadAssetBus } from './lead-to-asset-events';
import { uploadBufferToS3Public } from '@/lib/s3';

export interface LeadToAssetBrand {
  name: string;           // e.g. "Octopus Skills"
  description?: string;   // what the business does
  tone?: string;          // e.g. "profesional", "casual", "inspiracional"
  audience?: string;      // e.g. "emprendedores hispanos"
  productDescription?: string; // specific product/service being sold
}

export interface LeadToAssetRequest {
  lead: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    city?: string;
    customFields?: Record<string, string>;
  };
  brand?: LeadToAssetBrand;
  objective?: 'welcome' | 'sales' | 'demo' | 'follow_up' | 'custom';
  objectiveCustom?: string;
  assetType?: 'video' | 'image' | 'audio' | 'document';
  videoTemplateId?: string;
  language?: string;
  sendEmail?: boolean;
  emailTemplateId?: string;
  projectName?: string;
  metadata?: Record<string, unknown>;
}

export interface LeadToAssetResponse {
  status: 'pending';
  processId: string;
  leadId: string;
}

interface AssetResult {
  url: string;
  assetId: string;
}

// ─── Helper: sleep ───────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── LLM Helper ──────────────────────────────────────────────────────────────
async function callLLM(messages: { role: string; content: string }[], opts?: { maxTokens?: number; temperature?: number; model?: string }): Promise<string> {
  const res = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}` },
    body: JSON.stringify({
      model: opts?.model || 'gpt-4.1',
      messages,
      max_tokens: opts?.maxTokens || 600,
      temperature: opts?.temperature ?? 0.7,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`LLM API error: ${res.status} — ${errBody.substring(0, 300)}`);
  }
  const rawText = await res.text();
  let data: any;
  try { data = JSON.parse(rawText); } catch {
    throw new Error(`LLM API returned invalid JSON: ${rawText.substring(0, 300)}`);
  }
  return data.choices?.[0]?.message?.content?.trim() || '';
}

// ─── Image URL Extractor (same pattern as ad-factory) ────────────────────────
function extractImageUrl(data: Record<string, unknown>): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const choices = data.choices as any[] | undefined;
  if (choices?.[0]) {
    const msg = choices[0].message;
    if (!msg) return null;
    if (typeof msg.image_url === 'string') return msg.image_url;
    if (msg.image_url?.url) return msg.image_url.url;
    if (msg.images?.length > 0) {
      const img = msg.images[0];
      if (typeof img === 'string') return img;
      if (img?.image_url) return typeof img.image_url === 'string' ? img.image_url : img.image_url?.url || null;
      if (typeof img?.url === 'string') return img.url;
      if (typeof img?.b64_json === 'string') return `data:image/png;base64,${img.b64_json}`;
    }
    if (typeof msg.content === 'string') {
      const m = msg.content.match(/https?:\/\/[^\s)"'<>]+/i);
      if (m) return m[0];
    }
    if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item?.type === 'image_url') return typeof item.image_url === 'string' ? item.image_url : item.image_url?.url || null;
        if (typeof item?.url === 'string') return item.url;
      }
    }
  }
  const full = JSON.stringify(data);
  const u = full.match(/https?:\/\/[^\s)"'\\<>]+/i);
  return u ? u[0] : null;
}

// ─── IRON RULE: Hardcode opening line + enforce brand mention ────────────────
// The opening line is NEVER left to the LLM. We build it ourselves.
function buildHardcodedOpening(brandName: string, leadName: string, language: string): string {
  return language === 'en'
    ? `Hey ${leadName}, with ${brandName}`
    : `Hola ${leadName}, con ${brandName}`;
}

function enforceBrandMention(script: string, brandName: string, leadName: string, language: string): string {
  if (!brandName || brandName === 'Tu Negocio') return script;

  const hardcodedOpening = buildHardcodedOpening(brandName, leadName, language);
  const brandLower = brandName.toLowerCase();
  const scriptLower = script.toLowerCase();

  // Check if the script already starts with our hardcoded opening
  if (scriptLower.startsWith(hardcodedOpening.toLowerCase())) {
    console.log(`[LeadToAsset] ✅ Script already starts with hardcoded opening.`);
    return script;
  }

  // Strip any LLM-generated greeting to replace with our hardcoded one
  let body = script;
  // Remove common LLM openings like "Hola X, ...", "Hey X, ...", etc.
  const greetingPatterns = [
    /^(hola|hey|hi|oye|¡hola|hello)\s+[\w\s]+?,?\s*/i,
    /^[""]?(hola|hey|hi|oye|¡hola|hello)\s+[\w\s]+?,?\s*[""]?\s*/i,
  ];
  for (const pat of greetingPatterns) {
    body = body.replace(pat, '');
  }
  // If body is empty after stripping, use original minus first line
  if (body.trim().length < 10) body = script;

  // Build final: hardcoded opening + LLM body
  const needsComma = !body.startsWith(',') && !body.startsWith('.');
  const connector = needsComma ? ', ' : ' ';
  const finalScript = `${hardcodedOpening}${connector}${body.charAt(0).toLowerCase()}${body.slice(1)}`;

  // Verify brand is in the result (it always will be since we hardcoded it)
  if (!finalScript.toLowerCase().includes(brandLower)) {
    console.warn(`[LeadToAsset] ⚠️ Brand "${brandName}" STILL missing after injection — this should never happen.`);
  } else {
    console.log(`[LeadToAsset] ✅ Brand "${brandName}" confirmed in script via hardcoded opening.`);
  }
  return finalScript;
}

// ─── IRON RULE: Phonetic pre-processing for TTS (ElevenLabs) ────────────────
// Adds pronunciation hints: spaces between syllables, commas after names, etc.
function prepareTTSText(script: string, brandName: string, leadName: string): string {
  let text = script;

  // 1. Brand pronunciation hints — split known tricky brands into syllables
  const brandPronunciations: Record<string, string> = {
    'octopus': 'Oc-to-pus',
    'Octopus': 'Oc-to-pus',
    'OCTOPUS': 'OC-TO-PUS',
  };
  // Apply known brand pronunciation if matches
  if (brandPronunciations[brandName]) {
    text = text.split(brandName).join(brandPronunciations[brandName]);
  }

  // 2. Compound names: add comma + slight pause for multi-word names
  //    "Tibo Maker" → "Tibo, Maker"  (forces pause between words for clarity)
  if (leadName.includes(' ')) {
    const parts = leadName.split(' ');
    const phonetic = parts.join(', ');
    text = text.split(leadName).join(phonetic);
  }

  // 3. Ensure greeting has clear punctuation for natural pause
  //    "Hola Tibo Maker con..." → "Hola Tibo, Maker. Con..."
  text = text.replace(/^(Hola|Hey|Hi|Oye)\s+([^,.\n]+?),?\s*(con|with)\s/i, (_, greet, name, prep) => {
    // Add period after name for a clear pause before the brand mention
    return `${greet} ${name}. ${prep.charAt(0).toUpperCase()}${prep.slice(1)} `;
  });

  return text;
}

// ─── IRON RULE: Detect SaaS / software / digital brand ──────────────────────
function isSaaSBrand(brandDesc: string, product: string): boolean {
  const combined = `${brandDesc} ${product}`.toLowerCase();
  const saasKeywords = ['software', 'saas', 'plataforma', 'platform', 'app', 'dashboard', 'cockpit', 'digital', 'ai', 'inteligencia artificial', 'automation', 'automatización', 'crm', 'erp', 'api', 'cloud', 'nube', 'tech', 'marketing digital', 'herramienta', 'tool'];
  return saasKeywords.some(kw => combined.includes(kw));
}

// ─── IRON RULE: Build SaaS-safe visual prompt ────────────────────────────────
function buildVisualPrompt(brandName: string, brandDesc: string, product: string, baseStyle: string): string {
  const isSaaS = isSaaSBrand(brandDesc, product);
  if (isSaaS) {
    return `Generate a high-end, cinematic tech background for "${brandName}". Show a futuristic AI dashboard, holographic data nodes, or a digital cockpit interface with glowing metrics. ${product ? `The interface should relate to: ${product}.` : ''} ${baseStyle}
ABSOLUTE PROHIBITIONS: Zero physical consumer products. No bottles, no backpacks, no cosmetics, no food, no clothing, no cars, no packaging. This is a SOFTWARE brand — show ONLY technology: screens, UIs, data flows, code, holographic elements, abstract digital art.`;
  }
  return `Professional product showcase for "${brandName}". ${product ? `Product: ${product}.` : ''} ${brandDesc ? `Business: ${brandDesc}.` : ''} ${baseStyle}
The visual MUST match the product category. Show the actual product or its context of use.`;
}

// ─── Brand Context Builder ──────────────────────────────────────────────────
function buildBrandContext(req: LeadToAssetRequest, language: string): string {
  const brand = req.brand;
  const obj = req.objective;
  if (!brand && !obj) return '';

  const isEn = language === 'en';
  const parts: string[] = [];
  if (brand?.name) parts.push(`${isEn ? 'Brand/Business' : 'Marca/Negocio'}: ${brand.name}`);
  if (brand?.description) parts.push(`${isEn ? 'What it does' : 'Qué hace'}: ${brand.description}`);
  if (brand?.productDescription) parts.push(`${isEn ? 'Product/Service' : 'Producto/Servicio'}: ${brand.productDescription}`);
  if (brand?.tone) parts.push(`${isEn ? 'Tone' : 'Tono'}: ${brand.tone}`);
  if (brand?.audience) parts.push(`${isEn ? 'Audience' : 'Audiencia'}: ${brand.audience}`);
  if (parts.length === 0) return '';
  return `\n--- BRAND DNA ---\n${parts.join('\n')}\n--- ${isEn ? 'END' : 'FIN'} ---`;
}

// ─── Objective-specific prompt templates ────────────────────────────────────
// Each objective has a completely different strategy, structure, and CTA

interface ObjectiveTemplate {
  /** System prompt personality / directive */
  systemRole: string;
  /** Script structure guidance (for video/audio) */
  scriptStructure: string;
  /** Image style guidance */
  imageStyle: string;
  /** Document structure guidance */
  docStructure: string;
  /** Email tone & CTA */
  emailTone: string;
  /** Seedance video motion style */
  videoMotion: string;
}

function getObjectiveTemplate(objective: string | undefined, customObjective?: string, language?: string): ObjectiveTemplate {
  const isEn = language === 'en';

  switch (objective) {
    case 'welcome':
      return isEn ? {
        systemRole: 'You are an expert in onboarding and customer experience. Your mission is to deliver the BEST possible first impression — warm, professional, and memorable. Make the lead feel special and welcomed.',
        scriptStructure: `SCRIPT STRUCTURE (Welcome):
1. PERSONAL GREETING — Mention the lead by name with genuine enthusiasm
2. INTRODUCTION — "We are [brand], and this is what we do for you..."
3. IMMEDIATE VALUE — A concrete benefit they get today
4. INVITATION — "Explore, ask questions, we're here for you"
Tone: Warm, approachable, like an expert friend welcoming you.`,
        imageStyle: 'Welcoming, warm, open doors/gateway imagery. Soft lighting, inviting colors. Show a person welcoming gesture or an open, bright space. Include the brand name prominently with a "Welcome" message.',
        docStructure: `DOCUMENT STRUCTURE (Welcome):
1. Warm personalized greeting — "We're glad to have you here, [lead]"
2. Who we are — brief story and mission (2-3 sentences)
3. What to expect — 3 immediate first-day benefits
4. Next steps — clear guide on "what to do now"
5. Contact channels — how to get in touch
Tone: Friendly, empathetic, guiding.`,
        emailTone: 'Warm and welcoming. Open with "Welcome!" Emphasize they are in good hands. Soft CTA: "Explore your space" or "See what we prepared for you".',
        videoMotion: 'Warm, inviting camera movement. Slow zoom-in revealing the brand space. Gentle transitions, welcoming atmosphere.',
      } : {
        systemRole: 'Eres un experto en onboarding y experiencia del cliente. Tu misión es dar la MEJOR primera impresión posible — cálida, profesional y memorable. Haz que el lead se sienta especial y bienvenido.',
        scriptStructure: `ESTRUCTURA DEL GUIÓN (Bienvenida):
1. SALUDO PERSONAL — Mencionar al lead por nombre con entusiasmo genuino
2. PRESENTACIÓN — "Somos [marca], y esto es lo que hacemos por ti..."
3. VALOR INMEDIATO — Un beneficio concreto que obtienen hoy
4. INVITACIÓN — "Explora, pregunta, estamos aquí para ti"
Tono: Cálido, accesible, como un amigo experto que te recibe.`,
        imageStyle: 'Welcoming, warm, open doors/gateway imagery. Soft lighting, inviting colors. Show a person welcoming gesture or an open, bright space. Include the brand name prominently with a "Welcome" or "Bienvenido" message.',
        docStructure: `ESTRUCTURA DEL DOCUMENTO (Bienvenida):
1. Saludo personalizado cálido — "Nos alegra tenerte aquí, [lead]"
2. Quiénes somos — historia breve y misión (2-3 oraciones)
3. Qué puedes esperar — 3 beneficios inmediatos del primer día
4. Próximos pasos — guía clara de "qué hacer ahora"
5. Canales de contacto — cómo comunicarse
Tono: Cercano, empático, orientador.`,
        emailTone: 'Cálido y acogedor. Usa "¡Bienvenido/a!" como apertura. Enfatiza que están en buenas manos. CTA suave: "Explora tu espacio" o "Conoce lo que preparamos".',
        videoMotion: 'Warm, inviting camera movement. Slow zoom-in revealing the brand space. Gentle transitions, welcoming atmosphere.',
      };

    case 'demo':
      return isEn ? {
        systemRole: 'You are a world-class product presenter (Steve Jobs style). Your mission is to SHOW how the product works in a simple, impactful way with "wow moments". Each step must solve a real problem.',
        scriptStructure: `SCRIPT STRUCTURE (Demo):
1. PROBLEM — "Have you ever experienced...?" (lead's pain point)
2. SOLUTION — "Watch how [product] solves it in seconds..."
3. STEP-BY-STEP DEMO — Show 2-3 key features with benefits
4. RESULT — "And just like that, [lead] already has [result]"
Tone: Confident, didactic, like an expert who simplifies the complex.`,
        imageStyle: 'Product demonstration style. Show the product/service interface or in action. Split-screen "before/after" feel. Clean, tech-forward. Include step indicators (1, 2, 3) or UI mockup elements. Infographic style.',
        docStructure: `DOCUMENT STRUCTURE (Demo):
1. The problem we solve — specific market pain
2. The solution in action — visual walkthrough of 3-4 steps
3. Use cases — "For [type of client], this means..."
4. Measurable results — data, metrics, before/after
5. "Try it yourself" — CTA for live demo or trial
Tone: Educational, visual, results-oriented.`,
        emailTone: 'Educational and direct. Opening: "We prepared something special to show you how it works". Include 1-2 bullet points of features. Strong CTA: "Watch the demo" or "Discover how it works".',
        videoMotion: 'Dynamic product showcase. Screen recording feel with zoom-ins on key features. Quick cuts between steps. Professional tutorial energy.',
      } : {
        systemRole: 'Eres un presentador de producto de clase mundial (estilo Steve Jobs). Tu misión es MOSTRAR cómo funciona el producto de manera simple, impactante y con "wow moments". Cada paso debe resolver un problema real.',
        scriptStructure: `ESTRUCTURA DEL GUIÓN (Demo):
1. PROBLEMA — "¿Te ha pasado que...?" (pain point del lead)
2. SOLUCIÓN — "Mira cómo [producto] lo resuelve en segundos..."
3. DEMO PASO A PASO — Mostrar 2-3 features clave con beneficios
4. RESULTADO — "Y así de fácil, [lead] ya tiene [resultado]"
Tono: Confiado, didáctico, como un experto que simplifica lo complejo.`,
        imageStyle: 'Product demonstration style. Show the product/service interface or in action. Split-screen "before/after" feel. Clean, tech-forward. Include step indicators (1, 2, 3) or UI mockup elements. Infographic style.',
        docStructure: `ESTRUCTURA DEL DOCUMENTO (Demo):
1. El problema que resolvemos — dolor específico del mercado
2. La solución en acción — walkthrough visual de 3-4 pasos
3. Casos de uso — "Para [tipo de cliente], esto significa..."
4. Resultados medibles — datos, métricas, antes/después
5. "Pruébalo tú mismo" — CTA para demo en vivo o trial
Tono: Educativo, visual, orientado a resultados.`,
        emailTone: 'Educativo y directo. Apertura: "Preparamos algo especial para mostrarte cómo funciona". Incluir 1-2 bullet points de features. CTA fuerte: "Mira la demo" o "Descubre cómo funciona".',
        videoMotion: 'Dynamic product showcase. Screen recording feel with zoom-ins on key features. Quick cuts between steps. Professional tutorial energy.',
      };

    case 'follow_up':
      return isEn ? {
        systemRole: 'You are a retention and follow-up strategist. Your mission is to RECONNECT with a lead who already knows the brand. Remind them of the value, present something new, and create urgency without being aggressive.',
        scriptStructure: `SCRIPT STRUCTURE (Follow-up):
1. RECONNECTION — "Hey [lead], remember when we talked about...?"
2. NEWS — "Since then, we've improved/added..."
3. RENEWED VALUE — A benefit that applies to their current situation
4. SOFT URGENCY — "Only this week / Limited spots / Don't miss out"
Tone: Familiar but professional, like picking up a pending conversation.`,
        imageStyle: 'Re-engagement style. "We missed you" or "Something new for you" feel. Show evolution or upgrade. Before/after of the brand. Include a clock or calendar element suggesting timeliness. Personalized badge or tag.',
        docStructure: `DOCUMENT STRUCTURE (Follow-up):
1. "Hey again, [lead]" — personal reconnection
2. What has changed — news, improvements, recent achievements
3. Why now — urgent reason to get back in touch
4. Exclusive offer — discount, bonus, or special access
5. Clear next step — "Book your call" / "Claim your offer"
Tone: Friendly, updated, with a sense of opportunity.`,
        emailTone: 'Familiar and direct. Opening: "We talked a while back and wanted to share something new". Include 1 piece of news. CTA with soft urgency: "Only this week" or "Limited spots".',
        videoMotion: 'Nostalgic opening transitioning to exciting new reveal. Slow start building to energetic showcase of what\'s new.',
      } : {
        systemRole: 'Eres un estratega de retención y seguimiento. Tu misión es RECONECTAR con un lead que ya conoce la marca. Recuérdale el valor, presenta algo nuevo, y genera urgencia sin ser agresivo.',
        scriptStructure: `ESTRUCTURA DEL GUIÓN (Seguimiento):
1. RECONEXIÓN — "Hola [lead], ¿recuerdas cuando hablamos de...?"
2. NOVEDAD — "Desde entonces, hemos mejorado/agregado..."
3. VALOR RENOVADO — Un beneficio que aplica a su situación actual
4. URGENCIA SUAVE — "Solo esta semana / Hay cupos limitados / No te lo pierdas"
Tono: Familiar pero profesional, como retomar una conversación pendiente.`,
        imageStyle: 'Re-engagement style. "We missed you" or "Something new for you" feel. Show evolution or upgrade. Before/after of the brand. Include a clock or calendar element suggesting timeliness. Personalized badge or tag.',
        docStructure: `ESTRUCTURA DEL DOCUMENTO (Seguimiento):
1. "Hola de nuevo, [lead]" — reconexión personal
2. Lo que ha cambiado — novedades, mejoras, logros recientes
3. Por qué ahora — razón urgente de retomar contacto
4. Oferta exclusiva — descuento, bonus, o acceso especial
5. Próximo paso claro — "Agenda tu llamada" / "Reclama tu oferta"
Tono: Cercano, actualizado, con sentido de oportunidad.`,
        emailTone: 'Familiar y directo. Apertura: "Hace un tiempo hablamos y queríamos compartirte algo nuevo". Incluir 1 novedad. CTA con urgencia suave: "Solo esta semana" o "Plazas limitadas".',
        videoMotion: 'Nostalgic opening transitioning to exciting new reveal. Slow start building to energetic showcase of what\'s new.',
      };

    case 'sales':
    default:
      return isEn ? {
        systemRole: 'You are a direct-response copywriter and expert in high-ticket sales. Your mission is to PERSUADE and CLOSE. Every word must bring the lead closer to buying. Use principles of urgency, scarcity, social proof, and concrete benefits.',
        scriptStructure: `SCRIPT STRUCTURE (Sales):
1. HOOK — Impactful phrase that captures attention in 2 seconds
2. PAIN — Identify the problem the lead faces TODAY
3. SOLUTION — Present the product as THE answer (not "an" answer)
4. PROOF — Data, result, or testimonial that builds trust
5. CTA — Clear call to action with urgency: "Book today / Buy now / Don't wait"
Tone: Persuasive, direct, with energy. Every sentence must sell.`,
        imageStyle: 'High-converting sales ad. Bold headline, strong contrast. Show the product with a "limited offer" or "exclusive" badge. Include a price or discount element. Urgency indicators (timer, "last units"). Premium but actionable.',
        docStructure: `DOCUMENT STRUCTURE (Sales):
1. Magnetic headline — "The solution [lead] was looking for"
2. Amplified problem — pain + cost of inaction
3. Detailed solution — features turned into benefits
4. Social proof — testimonials, client logos, metrics
5. Irresistible offer — price, bonuses, guarantee
6. CTA with urgency — "Reserve today at the special price"
Tone: Persuasive, professional, conversion-oriented.`,
        emailTone: 'Persuasive with urgency. Opening: "We have something that can transform [area] of your business". Include 1 impact data point. Urgent CTA: "Reserve your spot" or "Offer valid today only".',
        videoMotion: 'High-energy commercial feel. Dynamic camera movement, bold transitions. Product hero shots with dramatic lighting. Fast-paced with impact moments.',
      } : {
        systemRole: 'Eres un copywriter de respuesta directa y experto en ventas de alto ticket. Tu misión es PERSUADIR y CERRAR. Cada palabra debe acercar al lead a la compra. Usa principios de urgencia, escasez, prueba social y beneficio concreto.',
        scriptStructure: `ESTRUCTURA DEL GUIÓN (Ventas):
1. HOOK — Frase impactante que captura atención en 2 segundos
2. DOLOR — Identificar el problema que el lead enfrenta HOY
3. SOLUCIÓN — Presentar el producto como LA respuesta (no "una" respuesta)
4. PRUEBA — Dato, resultado, o testimonio que genera confianza
5. CTA — Llamada a la acción clara con urgencia: "Agenda hoy / Compra ahora / No esperes"
Tono: Persuasivo, directo, con energía. Cada frase debe vender.`,
        imageStyle: 'High-converting sales ad. Bold headline, strong contrast. Show the product with a "limited offer" or "exclusive" badge. Include a price or discount element. Urgency indicators (timer, "últimas unidades"). Premium but actionable.',
        docStructure: `ESTRUCTURA DEL DOCUMENTO (Ventas):
1. Headline magnético — "La solución que [lead] estaba buscando"
2. El problema amplificado — dolor + costo de no actuar
3. La solución detallada — features convertidos en beneficios
4. Prueba social — testimonios, logos de clientes, métricas
5. Oferta irresistible — precio, bonus, garantía
6. CTA con urgencia — "Reserva hoy al precio especial"
Tono: Persuasivo, profesional, orientado a conversión.`,
        emailTone: 'Persuasivo con urgencia. Apertura: "Tenemos algo que puede transformar [área] de tu negocio". Incluir 1 dato de impacto. CTA urgente: "Reserva tu lugar" o "Oferta válida solo hoy".',
        videoMotion: 'High-energy commercial feel. Dynamic camera movement, bold transitions. Product hero shots with dramatic lighting. Fast-paced with impact moments.',
      };
  }
}

// ─── Main orchestration function ─────────────────────────────────────────────
export async function executeLeadToAsset(
  userId: string,
  req: LeadToAssetRequest
): Promise<LeadToAssetResponse> {
  const assetType = req.assetType || 'video';
  const language = req.language || 'es';
  const sendEmail = req.sendEmail ?? false;

  const process = await prisma.leadAssetProcess.create({
    data: {
      userId,
      leadName: req.lead.name,
      leadEmail: req.lead.email || null,
      leadCompany: req.lead.company || null,
      leadMetadata: req.lead.customFields ? JSON.stringify(req.lead.customFields) : null,
      assetType,
      language,
      sendEmail,
      emailTemplateId: req.emailTemplateId || null,
      projectName: req.projectName || null,
      metadata: req.metadata ? JSON.stringify(req.metadata) : null,
      status: 'pending',
      stage: 'queued',
      progress: 0,
    },
  });

  const processId = process.id;

  runPipeline(userId, processId, req, assetType, language, sendEmail).catch(err => {
    console.error(`[LeadToAsset] Pipeline fatal error for process=${processId}:`, err);
  });

  return {
    status: 'pending',
    processId,
    leadId: process.leadId || processId,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASYNC PIPELINE — Real AI Execution
// ═══════════════════════════════════════════════════════════════════════════════
async function runPipeline(
  userId: string,
  processId: string,
  req: LeadToAssetRequest,
  assetType: string,
  language: string,
  sendEmail: boolean
): Promise<void> {
  let leadId: string | undefined;

  try {
    // ── STEP 0: START ──────────────────────────────────────────────────────
    leadAssetBus.emitStart(userId, processId, undefined, req.lead.name, assetType);
    await updateProcess(processId, { status: 'creating_lead', stage: 'creating_lead', progress: 10, startedAt: new Date() });

    // ── STEP 1: Upsert Lead ────────────────────────────────────────────────
    leadAssetBus.emitProgress(userId, processId, 'creating_lead', 15, `Registrando lead: ${req.lead.name}...`);
    const leadRecord = await upsertLead(userId, req);
    leadId = leadRecord.id;

    await updateProcess(processId, { leadId, status: 'creating_lead', stage: 'lead_registered', progress: 25 });
    leadAssetBus.emitProgress(userId, processId, 'lead_registered', 25, `Lead registrado: ${req.lead.name}`, leadId);

    // ── STEP 2: Generate Asset with REAL AI ────────────────────────────────
    await updateProcess(processId, { status: 'generating_asset', stage: 'generating_asset', progress: 30 });
    leadAssetBus.emitProgress(userId, processId, 'generating_asset', 30, `Iniciando generación real de ${assetType} con IA...`, leadId);

    let assetResult: AssetResult;

    switch (assetType) {
      case 'video':
        assetResult = await generateVideoAsset(processId, userId, req, language);
        break;
      case 'image':
        assetResult = await generateImageAsset(processId, userId, req, language);
        break;
      case 'audio':
        assetResult = await generateAudioAsset(processId, userId, req, language);
        break;
      case 'document':
        assetResult = await generateDocumentAsset(processId, userId, req, language);
        break;
      default:
        assetResult = await generateImageAsset(processId, userId, req, language);
    }

    await updateProcess(processId, {
      status: 'generating_asset',
      stage: 'asset_generated',
      progress: 75,
      assetUrl: assetResult.url,
      assetId: assetResult.assetId,
    });
    leadAssetBus.emitProgress(userId, processId, 'asset_generated', 75, `Asset ${assetType} generado exitosamente ✅`, leadId);

    // ── STEP 3: Send Email ─────────────────────────────────────────────────
    let emailSent = false;
    if (sendEmail && req.lead.email) {
      await updateProcess(processId, { status: 'sending_email', stage: 'sending_email', progress: 85 });
      leadAssetBus.emitProgress(userId, processId, 'sending_email', 85, `Enviando email a ${req.lead.email}...`, leadId);

      emailSent = await sendAssetEmail(userId, req, assetType, assetResult.url, language);

      if (emailSent) {
        leadAssetBus.emitProgress(userId, processId, 'email_sent', 92, `Email enviado a ${req.lead.email} ✅`, leadId);
      } else {
        leadAssetBus.emitProgress(userId, processId, 'email_warning', 92, `Email no pudo enviarse — asset entregado sin email`, leadId);
      }
    }

    // ── STEP 4: DONE ───────────────────────────────────────────────────────
    await updateProcess(processId, {
      status: 'completed',
      stage: 'done',
      progress: 100,
      emailSent,
      completedAt: new Date(),
    });

    leadAssetBus.emitDone(userId, processId, {
      leadId,
      assetId: assetResult.assetId,
      assetUrl: assetResult.url,
      emailSent,
    });

    console.log(`[LeadToAsset] ✅ Process ${processId} completed. Lead=${leadId}, Asset=${assetResult.assetId}, Email=${emailSent}`);

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Error desconocido en pipeline';
    console.error(`[LeadToAsset] ❌ Process ${processId} failed:`, errMsg);

    await updateProcess(processId, {
      status: 'error',
      stage: 'error',
      errorMessage: errMsg,
    }).catch(() => {});

    leadAssetBus.emitError(userId, processId, errMsg, leadId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REAL GENERATORS — Sprint 2
// ═══════════════════════════════════════════════════════════════════════════════

// ─── VIDEO: UGC Script → AI Image → fal.ai Video ────────────────────────────
async function generateVideoAsset(
  processId: string,
  userId: string,
  req: LeadToAssetRequest,
  language: string
): Promise<AssetResult> {
  const leadName = req.lead.name;
  const company = req.lead.company || '';

  // ── STRICT BRAND SEPARATION: leadName is ONLY for greetings, NEVER for visuals ──
  const brandCtx = buildBrandContext(req, language);
  const brandName = req.brand?.name || req.lead.company || (language === 'en' ? 'Your Business' : 'Tu Negocio');
  const product = req.brand?.productDescription || '';
  const brandDesc = req.brand?.description || '';
  const tpl = getObjectiveTemplate(req.objective, req.objectiveCustom, language);
  
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 35, `Generando guión creativo para ${brandName}...`);

  // Step 2a: Generate the BODY of the script (LLM writes continuation, NOT the opening)
  const isEn = language === 'en';
  const scriptBody = await callLLM([
    { role: 'system', content: `${tpl.systemRole}\n\n${isEn ? 'You are also an expert scriptwriter for viral UGC content.' : 'Eres también un guionista experto en contenido viral UGC.'}${brandCtx}` },
    { role: 'user', content: isEn
      ? `Generate the CONTINUATION of a 10-second UGC script for the brand "${brandName}". Language: English.

CONTEXT: The first line of the script is already written: "Hey ${leadName}, with ${brandName}..."
You ONLY write what comes AFTER that line.

${product ? `PRODUCT/SERVICE: "${product}" — MUST be mentioned with its benefit.` : ''}
${tpl.scriptStructure}

IRON RULES:
- Do NOT repeat the greeting. Do NOT write "Hey" or "${leadName}" — already covered.
- The brand "${brandName}" MUST appear at least 1 more time in your continuation.
- ${product ? `Mention "${product}" and its direct benefit.` : `Describe the value of "${brandName}".`}
- Maximum 3 short, punchy sentences. Output ONLY text, nothing else.
- WRITE EVERYTHING IN ENGLISH.`
      : `Genera la CONTINUACIÓN de un guión UGC de 10 segundos para la marca "${brandName}". Idioma: Español.

CONTEXTO: La primera frase del guión ya está escrita y es: "Hola ${leadName}, con ${brandName}..."
Tú SOLO debes escribir lo que viene DESPUÉS de esa frase.

${product ? `PRODUCTO/SERVICIO: "${product}" — DEBE mencionarse con su beneficio.` : ''}
${tpl.scriptStructure}

REGLAS DE HIERRO:
- NO repitas el saludo. NO escribas "Hola" ni "${leadName}" — ya está cubierto.
- La marca "${brandName}" DEBE aparecer al menos 1 vez más en tu continuación.
- ${product ? `Menciona "${product}" y su beneficio directo.` : `Describe el valor de "${brandName}".`}
- Máximo 3 oraciones cortas y punchy. Solo texto, nada más.` },
  ], { maxTokens: 200, temperature: 0.85 });

  // ── IRON RULE: Assemble final script with HARDCODED opening ──
  const hardcodedOpen = buildHardcodedOpening(brandName, leadName, language);
  let script = `${hardcodedOpen}, ${scriptBody.replace(/^[,.\s]+/, '').charAt(0).toLowerCase()}${scriptBody.replace(/^[,.\s]+/, '').slice(1)}`;
  script = enforceBrandMention(script, brandName, leadName, language);
  console.log(`[LeadToAsset:Video] ✅ FINAL SCRIPT: "${script}"`);

  // ── Emit script to Live Feed for real-time audit ──
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 38, `📝 GUIÓN FINAL: "${script}"`);

  // Step 2b: Generate first frame image via RouteLLM — objective-driven
  // ⚠️ NO lead name here — only brand/product context. Uses SaaS-safe visual builder.
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 42, `Generando frame base con IA...`);
  const framePrompt = buildVisualPrompt(brandName, brandDesc, product, `${tpl.imageStyle} Cinematic first frame for a UGC video ad. Clean, modern, high-quality 4K look.`);

  const imgRes = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}` },
    body: JSON.stringify({
      model: 'route-llm',
      messages: [{ role: 'user', content: framePrompt }],
      modalities: ['image'],
    }),
  });

  if (!imgRes.ok) {
    const imgErr = await imgRes.text().catch(() => '');
    throw new Error(`Image generation failed: ${imgRes.status} — ${imgErr.substring(0, 300)}`);
  }
  const imgRawText = await imgRes.text();
  let imgData: any;
  try { imgData = JSON.parse(imgRawText); } catch {
    throw new Error(`Image API returned invalid JSON: ${imgRawText.substring(0, 300)}`);
  }
  const frameUrl = extractImageUrl(imgData);
  if (!frameUrl) throw new Error('No se pudo generar la imagen base para el video');

  // Step 2c: Generate motion video via Seedance (fal.ai) — 2.0 with 1.5 Pro fallback
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 50, `Enviando a Seedance 2.0 con audio nativo...`);

  const falKey = process.env.FAL_KEY;
  if (!falKey) throw new Error('FAL_KEY no configurado — no se puede generar video');

  // Seedance 2.0 endpoint (no fal-ai/ prefix) with 1.5 Pro fallback
  const SEEDANCE_V2 = 'bytedance/seedance-2.0/image-to-video';
  const SEEDANCE_V15 = 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video';
  const langName = language === 'en' ? 'English' : language === 'pt' ? 'Portuguese' : 'Spanish';
  const isSaaS = isSaaSBrand(brandDesc, product);
  const seedanceVisual = isSaaS
    ? `Futuristic AI dashboard interface for "${brandName}" with holographic data nodes and glowing metrics. No physical consumer products whatsoever.`
    : `Cinematic brand showcase for "${brandName}"${product ? ` — featuring ${product}` : ''}.${brandDesc ? ` Business: ${brandDesc}.` : ''}`;
  const seedancePrompt = `${seedanceVisual} ${tpl.videoMotion} The person speaks naturally with synchronized lip movements in ${langName}. Dialogue: "${script.substring(0, 120)}". Premium commercial quality, cinematic look.`;

  // Try Seedance 2.0 first, fallback to 1.5 Pro if submit fails
  let SEEDANCE_MODEL = SEEDANCE_V2;
  let falSubmitRes = await fetch(`https://queue.fal.run/${SEEDANCE_V2}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
    body: JSON.stringify({
      prompt: seedancePrompt,
      image_url: frameUrl,
      duration: '10',           // String enum for Seedance 2.0
      resolution: '720p',       // Seedance 2.0 max
      aspect_ratio: '16:9',
      generate_audio: true,     // Seedance 2.0 native audio + lip sync
    }),
  });

  if (!falSubmitRes.ok) {
    const v2Err = await falSubmitRes.text().catch(() => '');
    console.warn(`[LeadToAsset:Video] Seedance 2.0 submit failed (${falSubmitRes.status}): ${v2Err.substring(0, 200)} — falling back to 1.5 Pro`);
    leadAssetBus.emitProgress(userId, processId, 'generating_asset', 52, `Seedance 2.0 no disponible, usando 1.5 Pro...`);
    SEEDANCE_MODEL = SEEDANCE_V15;
    falSubmitRes = await fetch(`https://queue.fal.run/${SEEDANCE_V15}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Key ${falKey}` },
      body: JSON.stringify({
        prompt: seedancePrompt,
        image_url: frameUrl,
        duration: '10',
        resolution: '1080p',     // 1.5 Pro supports 1080p
        aspect_ratio: '16:9',
        generate_audio: true,
        camera_fixed: false,
      }),
    });
  } else {
    console.log(`[LeadToAsset:Video] ✅ Seedance 2.0 submit accepted`);
  }

  if (!falSubmitRes.ok) {
    const errText = await falSubmitRes.text().catch(() => '(no body)');
    throw new Error(`Seedance submit failed: ${falSubmitRes.status} — ${errText.substring(0, 300)}`);
  }
  const falSubmitText = await falSubmitRes.text();
  let falSubmit: any;
  try { falSubmit = JSON.parse(falSubmitText); } catch {
    throw new Error(`Seedance submit returned invalid JSON: ${falSubmitText.substring(0, 300)}`);
  }
  const requestId = falSubmit.request_id;
  // Capture URLs from submit response (fal.ai provides these)
  const falStatusUrl = falSubmit.status_url || `https://queue.fal.run/${SEEDANCE_MODEL}/requests/${requestId}/status`;
  const falResponseUrl = falSubmit.response_url || `https://queue.fal.run/${SEEDANCE_MODEL}/requests/${requestId}`;

  if (!requestId) throw new Error(`Seedance no devolvió request_id — response: ${falSubmitText.substring(0, 300)}`);

  const modelLabel = SEEDANCE_MODEL === SEEDANCE_V2 ? 'Seedance 2.0' : 'Seedance 1.5 Pro';
  console.log(`[LeadToAsset:Video] ${modelLabel} requestId=${requestId} — duration=10s, native_audio=true`);
  console.log(`[LeadToAsset:Video] status_url=${falStatusUrl}`);
  console.log(`[LeadToAsset:Video] response_url=${falResponseUrl}`);

  // Poll for completion — Seedance typically 2-5 min, max 10 min safety
  const MAX_POLLS = 200; // 200 × 3s = 10 minutes max
  let videoUrl = '';
  let consecutiveErrors = 0;
  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    await sleep(3000);
    const progress = Math.min(50 + Math.floor(attempt * 0.1), 68);
    if (attempt % 5 === 0) {
      const elapsed = attempt * 3;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      leadAssetBus.emitProgress(userId, processId, 'generating_asset', progress, `Renderizando video ${modelLabel}... (${timeStr})`);
    }

    let statusData: any;
    try {
      const statusRes = await fetch(falStatusUrl, {
        headers: { Authorization: `Key ${falKey}` },
      });
      const statusText = await statusRes.text();
      // Log raw response for first few polls and every 20th poll for diagnostics
      if (attempt < 3 || attempt % 20 === 0) {
        console.log(`[LeadToAsset:Video] Poll #${attempt} HTTP=${statusRes.status} body="${statusText.substring(0, 300)}"`);
      }
      if (!statusRes.ok) {
        console.warn(`[LeadToAsset:Video] Poll #${attempt} non-OK HTTP=${statusRes.status} body="${statusText.substring(0, 300)}"`);
        consecutiveErrors++;
        if (consecutiveErrors >= 20) {
          throw new Error(`Seedance status polling failed 20 consecutive times — last HTTP=${statusRes.status} body="${statusText.substring(0, 200)}"`);
        }
        continue;
      }
      if (!statusText || statusText.trim().length === 0) {
        console.warn(`[LeadToAsset:Video] Poll #${attempt} HTTP=${statusRes.status} returned EMPTY body`);
        consecutiveErrors++;
        if (consecutiveErrors >= 20) {
          throw new Error(`Seedance status returned empty body 20 consecutive times — HTTP status was ${statusRes.status}`);
        }
        continue;
      }
      statusData = JSON.parse(statusText);
      consecutiveErrors = 0; // Reset on success
    } catch (parseErr: any) {
      if (parseErr.message.includes('Seedance status')) throw parseErr; // Re-throw our own errors
      console.warn(`[LeadToAsset:Video] Poll #${attempt} parse error: ${parseErr.message}`);
      consecutiveErrors++;
      if (consecutiveErrors >= 20) {
        throw new Error(`Seedance status parsing failed 20 consecutive times: ${parseErr.message}`);
      }
      continue;
    }

    if (attempt % 10 === 0) {
      console.log(`[LeadToAsset:Video] Poll #${attempt} (${attempt * 3}s) status=${statusData.status} queue=${statusData.queue_position ?? '-'}`);
    }

    if (statusData.status === 'COMPLETED') {
      try {
        const resultRes = await fetch(falResponseUrl, {
          headers: { Authorization: `Key ${falKey}` },
        });
        const resultText = await resultRes.text();
        console.log(`[LeadToAsset:Video] Result fetch HTTP=${resultRes.status} body="${resultText.substring(0, 300)}"`);
        const result = JSON.parse(resultText);
        videoUrl = result?.video?.url || result?.output?.video?.url || '';
        console.log(`[LeadToAsset:Video] ✅ Seedance video ready after ${attempt * 3}s — URL: ${videoUrl.substring(0, 80)}...`);
      } catch (resErr: any) {
        console.warn(`[LeadToAsset:Video] Result fetch error: ${resErr.message}`);
        continue;
      }
      break;
    }
    if (statusData.status === 'FAILED') {
      throw new Error(`Seedance video generation failed: ${JSON.stringify(statusData).substring(0, 200)}`);
    }
  }

  if (!videoUrl) throw new Error('Seedance video timed out after 10 minutes — fal.ai may be under heavy load');

  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 70, `Video Seedance renderizado — guardando asset...`);

  // Save asset
  const asset = await prisma.creativeAsset.create({
    data: {
      userId,
      type: 'video',
      title: `Lead-to-Asset: ${leadName} (video)`,
      prompt: script,
      content: videoUrl,
      status: 'ready',
      format: 'lead-to-asset',
      metadata: JSON.stringify({
        processId, leadName, language, company, frameUrl,
        generatedAt: new Date().toISOString(), engine: 'seedance-1.5-pro',
        duration: '10s', resolution: '1080p', audioGenerated: true,
      }),
    },
  });

  return { url: videoUrl, assetId: asset.id };
}

// ─── IMAGE: LLM-generated personalized ad image ─────────────────────────────
async function generateImageAsset(
  processId: string,
  userId: string,
  req: LeadToAssetRequest,
  language: string
): Promise<AssetResult> {
  const leadName = req.lead.name;
  const company = req.lead.company || '';

  // ── STRICT BRAND SEPARATION: leadName is ONLY for greetings, NEVER for visuals ──
  const brandCtx = buildBrandContext(req, language);
  const brandName = req.brand?.name || req.lead.company || (language === 'en' ? 'Your Business' : 'Tu Negocio');
  const product = req.brand?.productDescription || '';
  const brandDesc = req.brand?.description || '';
  const tpl = getObjectiveTemplate(req.objective, req.objectiveCustom, language);

  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 40, `Diseñando ad personalizado para ${brandName}...`);

  const saasVisual = buildVisualPrompt(brandName, brandDesc, product, tpl.imageStyle);
  const imagePrompt = `Create a stunning, professional social media ad image (1080x1080).

${saasVisual}

MANDATORY TEXT OVERLAY: The brand name "${brandName}" MUST appear prominently in the image.${product ? ` Include a tagline about ${product}.` : ''}
${language === 'en' ? 'English-speaking market. All text overlays MUST be in English.' : 'Estilo para mercado hispano. Todo texto DEBE estar en español.'}
${req.brand?.tone ? `Tone: ${req.brand.tone}.` : ''}
Color scheme: Dark premium with gold accents. High contrast, magazine quality.
NO stock photo feel. This should look like a $10,000 agency ad.
IMPORTANT: Do NOT include any person's name in the visual design. The image is about the BRAND "${brandName}", not any individual.`;

  const imgRes = await fetch('https://routellm.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ABACUSAI_API_KEY}` },
    body: JSON.stringify({
      model: 'route-llm',
      messages: [{ role: 'user', content: imagePrompt }],
      modalities: ['image'],
      image_config: { aspect_ratio: '1:1' },
    }),
  });

  if (!imgRes.ok) {
    const imgErr = await imgRes.text().catch(() => '');
    throw new Error(`Image generation failed: ${imgRes.status} — ${imgErr.substring(0, 300)}`);
  }
  const imgRaw2 = await imgRes.text();
  let imgData: any;
  try { imgData = JSON.parse(imgRaw2); } catch {
    throw new Error(`Image API returned invalid JSON: ${imgRaw2.substring(0, 300)}`);
  }
  const imageUrl = extractImageUrl(imgData);
  if (!imageUrl) throw new Error('No se pudo generar la imagen');

  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 65, `Imagen generada — guardando asset...`);

  const asset = await prisma.creativeAsset.create({
    data: {
      userId,
      type: 'image',
      title: `Lead-to-Asset: ${leadName} (imagen)`,
      prompt: imagePrompt,
      content: imageUrl,
      status: 'ready',
      format: 'lead-to-asset',
      metadata: JSON.stringify({
        processId, leadName, language, company,
        generatedAt: new Date().toISOString(), engine: 'routellm',
      }),
    },
  });

  // For images: use a public-accessible URL instead of raw base64 data URLs
  // The /api/assets/[id] endpoint will serve the image binary from the stored base64
  const baseUrl = process.env.NEXTAUTH_URL || 'https://octopuskills.com';
  const publicUrl = imageUrl.startsWith('data:')
    ? `${baseUrl}/api/assets/${asset.id}`
    : imageUrl;

  return { url: publicUrl, assetId: asset.id };
}

// ─── AUDIO: LLM Script → ElevenLabs TTS ─────────────────────────────────────
async function generateAudioAsset(
  processId: string,
  userId: string,
  req: LeadToAssetRequest,
  language: string
): Promise<AssetResult> {
  const leadName = req.lead.name;
  const company = req.lead.company || '';

  // ── STRICT BRAND SEPARATION: leadName is ONLY for greetings, NEVER for visuals ──
  const brandCtx = buildBrandContext(req, language);
  const brandName = req.brand?.name || req.lead.company || (language === 'en' ? 'Your Business' : 'Tu Negocio');
  const product = req.brand?.productDescription || '';
  const tpl = getObjectiveTemplate(req.objective, req.objectiveCustom, language);

  // Step 1: Generate voiceover script BODY — objective-driven (opening is hardcoded)
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 35, `Generando guión de audio para ${brandName}...`);
  const audioBody = await callLLM([
    { role: 'system', content: `${tpl.systemRole}\n\n${language === 'en' ? 'You are also a world-class voice-over scriptwriter.' : 'Eres también un guionista de voice-over de clase mundial.'}${brandCtx}` },
    { role: 'user', content: `Write the CONTINUATION of a 15-second voice-over script for the brand "${brandName}".${product ? ` Product/service: ${product}.` : ''} Language: ${language === 'en' ? 'English' : 'Spanish'}.

CONTEXT: The opening line is already written: "${language === 'en' ? `Hey ${leadName}, with ${brandName}` : `Hola ${leadName}, con ${brandName}`}..."
You ONLY write what comes AFTER that opening.

${tpl.scriptStructure}

IRON RULES:
- Do NOT repeat the greeting. Do NOT write "${leadName}" — it's already covered.
- The brand "${brandName}" MUST appear at least 1 more time in your continuation.
- ${product ? `Mention "${product}" with its main benefit.` : `Describe the value of "${brandName}".`}
- Maximum 3 short, punchy sentences. Output ONLY the script text, nothing else.
- ${language === 'en' ? 'WRITE EVERYTHING IN ENGLISH.' : 'ESCRIBE TODO EN ESPAÑOL.'}` },
  ], { maxTokens: 150, temperature: 0.8 });

  // ── IRON RULE: Assemble final script with HARDCODED opening ──
  const hardcodedOpen = buildHardcodedOpening(brandName, leadName, language);
  let script = `${hardcodedOpen}, ${audioBody.replace(/^[,.\s]+/, '').charAt(0).toLowerCase()}${audioBody.replace(/^[,.\s]+/, '').slice(1)}`;
  script = enforceBrandMention(script, brandName, leadName, language);
  console.log(`[LeadToAsset:Audio] ✅ FINAL SCRIPT: "${script}"`);

  // ── Emit script to Live Feed for real-time audit ──
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 38, `📝 GUIÓN AUDIO: "${script}"`);

  // Step 2: Get ElevenLabs key
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 45, `Generando voz con ElevenLabs...`);

  let elevenLabsKey = '';
  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { userId, serviceType: 'ugc_elevenlabs', status: 'active' },
  });
  if (apiKeyRecord) {
    elevenLabsKey = apiKeyRecord.apiKey;
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { elevenLabsKey: true } });
    elevenLabsKey = user?.elevenLabsKey || '';
  }

  if (!elevenLabsKey) throw new Error('ElevenLabs API key no configurada. Ve a Configuración → UGC Factory para agregarla.');

  // Brian voice (cinematic male) for Spanish, Alice for English
  const voiceId = language === 'en' ? 'Xb7hH8MSUJpSbSDYk0k2' : 'nPczCjzI2devNBz1zQrb';

  const ttsText = prepareTTSText(script, brandName, leadName);
  console.log(`[LeadToAsset:Audio] ✅ TTS TEXT (post-phonetic): "${ttsText}"`);
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 48, `🔊 TEXTO TTS: "${ttsText}"`);

  const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
    body: JSON.stringify({
      text: ttsText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4 },
      apply_text_normalization: 'on',
      remove_silence: true,
    }),
  });

  if (!ttsRes.ok) throw new Error(`ElevenLabs TTS failed: ${ttsRes.status}`);

  const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

  // Upload to S3
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 60, `Subiendo audio a la nube...`);
  const { publicUrl } = await uploadBufferToS3Public(
    audioBuffer,
    `lead-asset-audio-${processId}.mp3`,
    'audio/mpeg'
  );

  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 70, `Audio generado — guardando asset...`);

  const asset = await prisma.creativeAsset.create({
    data: {
      userId,
      type: 'audio',
      title: `Lead-to-Asset: ${leadName} (audio)`,
      prompt: script,
      content: publicUrl,
      status: 'ready',
      format: 'lead-to-asset',
      metadata: JSON.stringify({
        processId, leadName, language, company, voiceId,
        generatedAt: new Date().toISOString(), engine: 'elevenlabs',
      }),
    },
  });

  return { url: publicUrl, assetId: asset.id };
}

// ─── DOCUMENT: LLM content → HTML2PDF → S3 ──────────────────────────────────
async function generateDocumentAsset(
  processId: string,
  userId: string,
  req: LeadToAssetRequest,
  language: string
): Promise<AssetResult> {
  const leadName = req.lead.name;
  const company = req.lead.company || '';
  const email = req.lead.email || '';

  // ── STRICT BRAND SEPARATION: leadName is ONLY for greetings, NEVER for brand identity ──
  const brandCtx = buildBrandContext(req, language);
  const brandName = req.brand?.name || req.lead.company || (language === 'en' ? 'Your Business' : 'Tu Negocio');
  const product = req.brand?.productDescription || '';
  const tpl = getObjectiveTemplate(req.objective, req.objectiveCustom, language);

  // Step 1: Generate personalized document content via LLM — objective-driven
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 35, `Generando contenido del documento para ${brandName}...`);

  const lang = language === 'en' ? 'English' : 'Español';
  const docContent = await callLLM([
    { role: 'system', content: `${tpl.systemRole}\n\n${language === 'en' ? `You are also an expert business proposal writer. Generate elegant, professional HTML content in English. Output ONLY valid HTML (no markdown).` : `Eres también un experto escritor de propuestas de negocio. Genera contenido HTML elegante y profesional en Español. Output ONLY valid HTML (no markdown).`}${brandCtx}` },
    { role: 'user', content: `Create a one-page personalized document for:
- Lead (recipient name for greeting only): ${leadName}
${company ? `- Lead Company: ${company}` : ''}
- Email: ${email}
- Language: ${lang}
- Brand: ${brandName}
${product ? `- Product/Service: ${product}` : ''}
${req.brand?.description ? `- Business category: ${req.brand.description}` : ''}
${req.brand?.audience ? `- Target audience: ${req.brand.audience}` : ''}

IRON RULES:
- The lead name "${leadName}" is ONLY for greeting/salutation. All branding, product references, and identity MUST use "${brandName}" exclusively.
- The brand name "${brandName}" MUST appear at least 5 times throughout the document (headings, body, CTA).
- ${product ? `The product "${product}" MUST be referenced with specific benefits.` : ''}
- ${req.brand?.description ? `Business category: "${req.brand.description}" — if this is software/SaaS, do NOT reference physical products.` : ''}

${tpl.docStructure}

${language === 'en' ? 'STYLE RULES' : 'REGLAS DE ESTILO'}:
- ${language === 'en' ? `The document MUST be about ${brandName} and ${product || 'its service'} — NOT generic.` : `El documento DEBE ser sobre ${brandName} y ${product || 'su servicio'} — NO genérico.`}
- ${language === 'en' ? `Every section reinforces why ${product || 'this solution'} is valuable for ${leadName}.` : `Cada sección refuerza por qué ${product || 'esta solución'} es valiosa para ${leadName}.`}
- ${language === 'en' ? 'Follow EXACTLY the structure indicated above. ALL content MUST be in English.' : 'Sigue EXACTAMENTE la estructura indicada arriba.'}
- Use elegant HTML with inline styles (dark theme: #0A0A0A bg, #FFD700 accents, #F5F0E8 text).
- Include "${brandName}" brand prominently in headings and CTAs.
- Output ONLY the HTML body content (no <html>, <head>, <body> tags).` },
  ], { maxTokens: 1500, temperature: 0.6 });

  // Step 2: Wrap in full HTML
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 50, `Generando PDF profesional...`);

  const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #0A0A0A; color: #F5F0E8; margin: 0; padding: 40px; }
  h1, h2, h3 { color: #FFD700; }
  a { color: #FFD700; }
  .accent { color: #C4622D; }
  .container { max-width: 700px; margin: 0 auto; }
  .header { text-align: center; border-bottom: 2px solid #FFD70030; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; margin: 0; }
  .header p { color: #F5F0E880; font-size: 12px; letter-spacing: 2px; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #F5F0E815; text-align: center; font-size: 11px; color: #F5F0E840; }
</style></head><body>
<div class="container">
  <div class="header">
    <h1>🐙 ${brandName}</h1>
    <p>PROPUESTA PERSONALIZADA PARA ${(req.lead.company || leadName).toUpperCase()}</p>
  </div>
  ${docContent}
  <div class="footer">
    <p>Generado por OCTOPUS Omni Cockpit · Wildverse LLC · ${new Date().toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES')}</p>
  </div>
</div></body></html>`;

  // Step 3: Convert to PDF via HTML2PDF API
  const createRes = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deployment_token: process.env.ABACUSAI_API_KEY,
      html_content: fullHtml,
      pdf_options: { format: 'A4', print_background: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } },
    }),
  });

  if (!createRes.ok) {
    const pdfErr = await createRes.text().catch(() => '');
    throw new Error(`HTML2PDF create request failed: ${createRes.status} — ${pdfErr.substring(0, 300)}`);
  }
  const pdfCreateRaw = await createRes.text();
  let pdfCreateData: any;
  try { pdfCreateData = JSON.parse(pdfCreateRaw); } catch {
    throw new Error(`HTML2PDF returned invalid JSON: ${pdfCreateRaw.substring(0, 300)}`);
  }
  const request_id = pdfCreateData.request_id;
  if (!request_id) throw new Error('HTML2PDF no devolvió request_id');

  // Poll for PDF
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 55, `Renderizando PDF...`);
  let pdfBase64 = '';
  for (let i = 0; i < 120; i++) {
    await sleep(1500);
    let statusData: any;
    try {
      const statusRes = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id, deployment_token: process.env.ABACUSAI_API_KEY }),
      });
      const statusRaw = await statusRes.text();
      statusData = JSON.parse(statusRaw);
    } catch (e: any) {
      console.warn(`[LeadToAsset:PDF] Poll #${i} parse error — retrying: ${e.message}`);
      continue;
    }

    if (statusData.status === 'SUCCESS' && statusData.result?.result) {
      pdfBase64 = statusData.result.result;
      break;
    }
    if (statusData.status === 'FAILED') {
      throw new Error(`PDF generation failed: ${JSON.stringify(statusData).substring(0, 200)}`);
    }
    if (i % 6 === 0) {
      leadAssetBus.emitProgress(userId, processId, 'generating_asset', 55 + Math.min(i, 12), `Renderizando PDF... (${i * 1.5}s)`);
    }
  }

  if (!pdfBase64) throw new Error('PDF generation timed out');

  // Upload to S3
  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 68, `Subiendo documento a la nube...`);
  const pdfBuffer = Buffer.from(pdfBase64, 'base64');
  const { publicUrl } = await uploadBufferToS3Public(
    pdfBuffer,
    `lead-asset-doc-${processId}.pdf`,
    'application/pdf'
  );

  leadAssetBus.emitProgress(userId, processId, 'generating_asset', 70, `Documento generado — guardando asset...`);

  const asset = await prisma.creativeAsset.create({
    data: {
      userId,
      type: 'document',
      title: `Lead-to-Asset: ${leadName} (documento)`,
      prompt: `Propuesta personalizada para ${company}`,
      content: publicUrl,
      status: 'ready',
      format: 'lead-to-asset',
      metadata: JSON.stringify({
        processId, leadName, language, company,
        generatedAt: new Date().toISOString(), engine: 'llm+html2pdf',
      }),
    },
  });

  return { url: publicUrl, assetId: asset.id };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL DELIVERY — Real Notification API
// ═══════════════════════════════════════════════════════════════════════════════
async function sendAssetEmail(
  userId: string,
  req: LeadToAssetRequest,
  assetType: string,
  assetUrl: string,
  language: string
): Promise<boolean> {
  try {
    const lead = req.lead;
    if (!lead.email) return false;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true, businessEmail: true } });
    const senderName = user?.name || 'OCTOPUS Omni Cockpit';
    // Prefer businessEmail (set in Settings) over registration email for outgoing communications
    const senderEmail = user?.businessEmail || user?.email || '';
    const brandName = req.brand?.name || senderName;
    const product = req.brand?.productDescription || '';
    const tpl = getObjectiveTemplate(req.objective, req.objectiveCustom, language);

    const assetLabels: Record<string, { es: string; en: string }> = {
      video: { es: 'Video Personalizado', en: 'Custom Video' },
      image: { es: 'Imagen Publicitaria', en: 'Ad Image' },
      audio: { es: 'Audio Personalizado', en: 'Custom Audio' },
      document: { es: 'Propuesta Personalizada', en: 'Custom Proposal' },
    };
    const label = assetLabels[assetType] || assetLabels.image;
    const isEs = language !== 'en';

    // Objective-specific subject lines
    const objSubjects: Record<string, { es: string; en: string }> = {
      welcome: {
        es: `¡Bienvenido/a! Tu ${label.es.toLowerCase()} de ${brandName}`,
        en: `Welcome! Your ${label.en.toLowerCase()} from ${brandName}`,
      },
      demo: {
        es: `Descubre cómo funciona — ${label.es} de ${brandName}`,
        en: `See how it works — ${label.en} from ${brandName}`,
      },
      follow_up: {
        es: `Algo nuevo para ti — ${label.es} de ${brandName}`,
        en: `Something new for you — ${label.en} from ${brandName}`,
      },
      sales: {
        es: `${label.es} exclusivo para ${lead.company || lead.name} — ${brandName}`,
        en: `Exclusive ${label.en} for ${lead.company || lead.name} — ${brandName}`,
      },
    };
    const objKey = req.objective || 'sales';
    const subject = isEs ? (objSubjects[objKey]?.es || objSubjects.sales.es) : (objSubjects[objKey]?.en || objSubjects.sales.en);

    // Objective-specific greetings and CTAs
    const greetings: Record<string, { es: string; en: string }> = {
      welcome: { es: `¡Bienvenido/a ${lead.name}! 🎉`, en: `Welcome ${lead.name}! 🎉` },
      demo: { es: `Hola ${lead.name} — mira esto 🚀`, en: `Hey ${lead.name} — check this out 🚀` },
      follow_up: { es: `${lead.name}, tenemos algo nuevo para ti 🔥`, en: `${lead.name}, we have something new for you 🔥` },
      sales: { es: `Hola ${lead.name} 👋`, en: `Hi ${lead.name} 👋` },
    };
    const greeting = isEs ? (greetings[objKey]?.es || greetings.sales.es) : (greetings[objKey]?.en || greetings.sales.en);

    const ctaTexts: Record<string, { es: string; en: string }> = {
      welcome: { es: `🎉 Explorar mi contenido`, en: `🎉 Explore my content` },
      demo: { es: `🎮 Ver la demo ahora`, en: `🎮 Watch the demo now` },
      follow_up: { es: `🔥 Ver lo nuevo`, en: `🔥 See what's new` },
      sales: { es: `🎯 Ver mi ${label.es}`, en: `🎯 View my ${label.en}` },
    };
    const ctaText = isEs ? (ctaTexts[objKey]?.es || ctaTexts.sales.es) : (ctaTexts[objKey]?.en || ctaTexts.sales.en);

    // Objective-specific body messages
    const bodyMessages: Record<string, { es: string; en: string }> = {
      welcome: {
        es: `Nos alegra que estés aquí. En ${brandName} preparamos este ${label.es.toLowerCase()} especialmente para darte la bienvenida${product ? ` y mostrarte lo que ${product} puede hacer por ti` : ''}. ¡Esperamos que lo disfrutes!`,
        en: `We're glad you're here. At ${brandName}, we've prepared this ${label.en.toLowerCase()} especially to welcome you${product ? ` and show you what ${product} can do for you` : ''}. Enjoy!`,
      },
      demo: {
        es: `Preparamos esta demostración personalizada para ${lead.company || 'ti'}${product ? ` sobre ${product}` : ''}. Descubre paso a paso cómo funciona y por qué va a transformar tu negocio.`,
        en: `We prepared this personalized demo for ${lead.company || 'you'}${product ? ` about ${product}` : ''}. Discover step by step how it works and why it will transform your business.`,
      },
      follow_up: {
        es: `Desde la última vez que hablamos, hemos avanzado mucho en ${brandName}${product ? ` y queremos mostrarte las novedades de ${product}` : ''}. No te pierdas este contenido exclusivo.`,
        en: `Since we last spoke, we've made big strides at ${brandName}${product ? ` and want to show you what's new with ${product}` : ''}. Don't miss this exclusive content.`,
      },
      sales: {
        es: `${brandName} ha preparado contenido exclusivo para ${lead.company || 'ti'}${product ? ` sobre ${product}` : ''}. Descubre cómo puede transformar tu negocio hoy.`,
        en: `${brandName} has prepared exclusive content for ${lead.company || 'you'}${product ? ` about ${product}` : ''}. Discover how it can transform your business today.`,
      },
    };
    const bodyMsg = isEs ? (bodyMessages[objKey]?.es || bodyMessages.sales.es) : (bodyMessages[objKey]?.en || bodyMessages.sales.en);

    const productLine = product
      ? `<p style="color:#FFD700;font-size:14px;margin:16px 0 0;font-weight:600;">📦 ${product}</p>`
      : '';
    const brandDesc = req.brand?.description
      ? `<p style="color:#F5F0E899;font-size:13px;line-height:1.6;margin:8px 0 0;">${req.brand.description}</p>`
      : '';

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#1A1A1A;border-radius:16px;overflow:hidden;border:1px solid #FFD70020;">
  <div style="background:linear-gradient(135deg,#2D4A3E,#1A1A1A);padding:32px 24px;text-align:center;border-bottom:1px solid #FFD70015;">
    <div style="font-size:48px;margin-bottom:12px;">🐙</div>
    <h1 style="color:#FFD700;font-size:22px;margin:0;">${brandName}</h1>
  </div>
  <div style="padding:32px 24px;">
    <h2 style="color:#F5F0E8;font-size:20px;margin:0 0 16px;">${greeting}</h2>
    <p style="color:#F5F0E8CC;font-size:15px;line-height:1.7;">${bodyMsg}</p>
    ${productLine}
    ${brandDesc}
    <div style="text-align:center;margin:32px 0;">
      <a href="${assetUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#C4622D);color:#1A1A1A;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;">
        ${ctaText}
      </a>
    </div>
  </div>
  <div style="padding:20px 24px;background:#0A0A0A;border-top:1px solid #F5F0E810;text-align:center;">
    <p style="color:#F5F0E8;font-size:12px;margin:0 0 8px;">
      ${isEs ? '¿Preguntas? Responde a este email o escríbenos a' : 'Questions? Reply to this email or write to'} 
      <a href="mailto:${senderEmail}" style="color:#3B82F6;text-decoration:underline;font-weight:600;">${senderEmail}</a>
    </p>
    <p style="color:#F5F0E830;font-size:11px;margin:0;">${brandName} · Powered by OCTOPUS Omni Cockpit</p>
  </div>
</div></body></html>`;

    const notifId = process.env.NOTIF_ID_LEADTOASSET_DELIVERY;
    if (!notifId) {
      console.warn('[LeadToAsset] NOTIF_ID_LEADTOASSET_DELIVERY not set — skipping email');
      return false;
    }

    // Use domain-based sender email when deployed on custom domain
    const hostname = process.env.NEXTAUTH_URL ? new URL(process.env.NEXTAUTH_URL).hostname : '';
    const domainSender = hostname && !hostname.includes('abacusai.app') ? `noreply@${hostname}` : senderEmail;

    const res = await fetch('https://apps.abacus.ai/api/sendNotificationEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployment_token: process.env.ABACUSAI_API_KEY,
        app_id: process.env.WEB_APP_ID,
        notification_id: notifId,
        subject,
        body: htmlBody,
        is_html: true,
        recipient_email: lead.email,
        sender_email: domainSender,
        sender_alias: senderName,
        reply_to: senderEmail || domainSender,
      }),
    });

    const data = await res.json();
    if (data.success || data.notification_disabled) {
      console.log(`[LeadToAsset] ✅ Email sent to ${lead.email}`);
      return true;
    }

    console.error('[LeadToAsset] Email send failed:', data);
    return false;
  } catch (err) {
    console.error('[LeadToAsset] Email error:', err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lead Upsert ─────────────────────────────────────────────────────────────
async function upsertLead(userId: string, req: LeadToAssetRequest) {
  if (req.lead.email) {
    const existing = await prisma.growthLead.findFirst({
      where: { userId, email: req.lead.email },
    });
    if (existing) {
      return prisma.growthLead.update({
        where: { id: existing.id },
        data: {
          contactName: req.lead.name || existing.contactName,
          phone: req.lead.phone || existing.phone,
          city: req.lead.city || existing.city,
          notes: existing.notes
            ? `${existing.notes}\n[Lead-to-Asset] Proceso iniciado ${new Date().toISOString()}`
            : `[Lead-to-Asset] Proceso iniciado ${new Date().toISOString()}`,
        },
      });
    }
  }

  return prisma.growthLead.create({
    data: {
      userId,
      businessName: req.lead.company || req.lead.name,
      contactName: req.lead.name,
      email: req.lead.email || null,
      phone: req.lead.phone || null,
      city: req.lead.city || null,
      status: 'new',
      priority: 'high',
      leadSource: 'lead-to-asset',
      notes: `[Lead-to-Asset] Proceso automatizado ${new Date().toISOString()}`,
    },
  });
}

// ─── DB Process Update Helper ────────────────────────────────────────────────
async function updateProcess(processId: string, data: Record<string, unknown>) {
  await prisma.leadAssetProcess.update({
    where: { id: processId },
    data: data as any,
  });
}

// ─── Get Process Status ──────────────────────────────────────────────────────
export async function getProcessStatus(processId: string, userId: string) {
  return prisma.leadAssetProcess.findFirst({
    where: { id: processId, userId },
  });
}

// ─── List User Processes ─────────────────────────────────────────────────────
export async function listUserProcesses(userId: string, limit = 20) {
  return prisma.leadAssetProcess.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
