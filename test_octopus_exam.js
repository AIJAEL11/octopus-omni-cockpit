/**
 * OCTOPUS COMPREHENSIVE EXAM — Batería de Pruebas Complejas
 * Examina: búsqueda, respuesta, formato, conversión, cierre, prospección, estrategia, etc.
 */

const API_KEY = '03e7837ce33049448a79154b72f5defb';
const API_URL = 'https://apps.abacus.ai/v1/chat/completions';
const SYSTEM_PROMPT_FILE = '/home/ubuntu/octopus_omni_cockpit/nextjs_space/lib/octopus-personality.ts';

// Load the system prompt
const fs = require('fs');
const content = fs.readFileSync(SYSTEM_PROMPT_FILE, 'utf8');
// Extract OCTOPUS_SYSTEM_PROMPT — can't use simple regex because of embedded backticks
const startMarker = 'export const OCTOPUS_SYSTEM_PROMPT = `';
const endMarker = '\n`\n\n/**\n * Prompt para extracción';
const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker, startIdx);
const SYSTEM_PROMPT = (startIdx !== -1 && endIdx !== -1) ? content.substring(startIdx + startMarker.length, endIdx) : '';
console.log(`System prompt loaded: ${SYSTEM_PROMPT.length} chars`);

// Also load ACTION_MODE_REINFORCEMENT
const actionsFile = fs.readFileSync('/home/ubuntu/octopus_omni_cockpit/nextjs_space/lib/jarvis-actions.ts', 'utf8');
const amrStart = actionsFile.indexOf('export const ACTION_MODE_REINFORCEMENT = `');
const amrEnd = actionsFile.indexOf('\n`\n', amrStart + 50);
const ACTION_REINFORCEMENT = (amrStart !== -1 && amrEnd !== -1) ? actionsFile.substring(amrStart + 'export const ACTION_MODE_REINFORCEMENT = `'.length, amrEnd) : '';
console.log(`Action reinforcement loaded: ${ACTION_REINFORCEMENT.length} chars`);

// Add Growth Engine context
const GROWTH_CONTEXT = `
[ESTADO DEL GROWTH ENGINE]
🚀 Growth Engine: ACTIVO
- Leads en pipeline: 517
- Acciones pendientes: 3
- Leads con respuesta: 12
- PUEDES ejecutar acciones de growth_engine directamente.
- Acciones disponibles: list_leads, get_lead, create_lead, update_lead, generate_outreach, approve_action, list_actions, sync_inbox, list_inbox, reply_email, get_stats, get_insights, get_report, list_campaigns, apply_campaign

🔍 PROSPECCIÓN WEB: Si el usuario pide "busca un lead/negocio en [ciudad]":
1. Usa web search para encontrar negocios REALES con datos concretos
2. Verifica contra pipeline con list_leads(search: "nombre") para evitar duplicados
3. Crea el lead con create_lead usando datos REALES de la web
NUNCA busques tutoriales de programación cuando el usuario pide buscar negocios. Busca NEGOCIOS REALES.
`;

const GOOGLE_CONTEXT = `
[ESTADO DE CONEXIONES]
✅ Google Workspace: CONECTADO (desde 15/3/2026)
- Servicios disponibles: Calendar, Drive, Docs, Sheets, Gmail
- PUEDES ejecutar acciones de google_workspace directamente.
`;

const USER_CONTEXT = `
[IDENTIDAD DEL USUARIO]
El usuario se llama **RAFAEL**. Su email es 1billontopview@gmail.com.
SIEMPRE usa su nombre para personalizar tus respuestas.
Rafael es el CEO de Wildverse, una plataforma de gaming AR. Su programa principal cuesta $99/mes.
`;

const FULL_SYSTEM = SYSTEM_PROMPT + '\n\n' + ACTION_REINFORCEMENT + GROWTH_CONTEXT + GOOGLE_CONTEXT + USER_CONTEXT;

// ============================
// TEST SCENARIOS
// ============================
const TESTS = [
  // === CATEGORÍA 1: BÚSQUEDA Y FORMATO ===
  {
    id: 'T01',
    category: 'BÚSQUEDA',
    name: 'Consulta simple de leads',
    prompt: 'Muéstrame los 5 leads más recientes del pipeline',
    expect: ['jarvis-action', 'growth_engine', 'list_leads'],
    antiExpect: ['no puedo', 'no tengo acceso'],
  },
  {
    id: 'T02', 
    category: 'BÚSQUEDA',
    name: 'Búsqueda filtrada por ciudad',
    prompt: 'Dame los leads de Miami con prioridad alta',
    expect: ['jarvis-action', 'growth_engine', 'list_leads'],
    antiExpect: ['no puedo filtrar'],
  },
  {
    id: 'T03',
    category: 'BÚSQUEDA',
    name: 'Estadísticas del pipeline',
    prompt: '¿Cómo va el growth? Dame un resumen rápido',
    expect: ['jarvis-action', 'growth_engine', 'get_stats'],
    antiExpect: [],
  },

  // === CATEGORÍA 2: CONVERSIÓN DE CLIENTES ===
  {
    id: 'T04',
    category: 'CONVERSIÓN',
    name: 'Generar email de outreach persuasivo',
    prompt: 'Genera un email de outreach para el lead The Cue Restaurant. Tiene que ser irresistible, que no puedan decir que no.',
    expect: ['jarvis-action', 'growth_engine'],
    antiExpect: ['no puedo generar'],
  },
  {
    id: 'T05',
    category: 'CONVERSIÓN',
    name: 'Estrategia de seguimiento a lead frío',
    prompt: 'Tengo un lead que no ha respondido en 2 semanas. Se llama "Miami Beach Restaurant". ¿Qué hago? Dame una estrategia de follow-up con acciones concretas.',
    expect: ['jarvis-action', 'growth_engine'],
    antiExpect: [],
  },
  {
    id: 'T06',
    category: 'CONVERSIÓN',
    name: 'Lead que respondió con interés - cerrar el deal',
    prompt: 'El dueño de Luna Rooftop respondió diciendo "me interesa, pero ¿qué incluye exactamente?". Prepárame la respuesta perfecta para cerrar.',
    expect: [],  // Text-based sales copy is valid — jarvis-action optional (reply_email ideal)
    antiExpect: ['no sé qué incluye'],
  },

  // === CATEGORÍA 3: CIERRE DE NEGOCIO ===
  {
    id: 'T07',
    category: 'CIERRE',
    name: 'Objeción de precio',
    prompt: 'Un lead dice "$99 al mes es muy caro, no creo que valga la pena". Escríbeme la respuesta perfecta para superar esta objeción y cerrar.',
    expect: [],  // Can be text-only strategic response
    antiExpect: ['tienes razón', 'entiendo que es caro'],
  },
  {
    id: 'T08',
    category: 'CIERRE',
    name: 'Objeción de tiempo',
    prompt: 'Lead dice: "suena interesante pero ahora no es buen momento, quizás en 3 meses". ¿Cómo le respondo para no perderlo pero cerrar ahora?',
    expect: [],
    antiExpect: ['está bien, te contacto en 3 meses'],
  },

  // === CATEGORÍA 4: PROSPECCIÓN INTELIGENTE ===
  {
    id: 'T09',
    category: 'PROSPECCIÓN',
    name: 'Buscar negocios nuevos en ciudad específica',
    prompt: 'Busca 2 restaurantes en Stamford, CT que no estén en mi pipeline. Que tengan buenas reseñas y email disponible.',
    expect: ['jarvis-action'],  // May use web_search or growth_engine first — both valid
    antiExpect: ['tutorial', 'programación', 'cómo filtrar', 'cómo deduplicar'],
  },
  {
    id: 'T10',
    category: 'PROSPECCIÓN',
    name: 'Verificar duplicados antes de crear',
    prompt: 'Quiero agregar "The Capital Grille" como lead. Primero verifica si ya está en el pipeline.',
    expect: ['jarvis-action', 'growth_engine', 'list_leads'],
    antiExpect: [],
  },

  // === CATEGORÍA 5: MULTI-PASO / ENCADENAMIENTO ===
  {
    id: 'T11',
    category: 'MULTI-PASO',
    name: 'Flujo completo: buscar + outreach + agendar',
    prompt: 'Quiero atacar 3 leads nuevos hoy. Dame los top 3 con mejor score, genera outreach para cada uno, y agéndame un follow-up en mi calendario para la próxima semana.',
    expect: ['jarvis-action', 'growth_engine', 'list_leads'],
    antiExpect: ['¿quieres que'],
  },
  {
    id: 'T12',
    category: 'MULTI-PASO',
    name: 'Reporte + Insights + Acción',
    prompt: 'Dame el reporte del pipeline, los insights de IA, y basado en eso dime cuáles son las 3 acciones más urgentes que debo tomar hoy.',
    expect: ['jarvis-action', 'growth_engine'],
    antiExpect: [],
  },

  // === CATEGORÍA 6: ESTRATEGIA DE VENTAS ===
  {
    id: 'T13',
    category: 'ESTRATEGIA',
    name: 'Estrategia para segmento específico',
    prompt: 'Tengo 471 leads diamond. ¿Cuál es la mejor estrategia para convertir al menos 50 en los próximos 30 días? Sé específico con tácticas y timeline.',
    expect: [],
    antiExpect: ['no sé', 'no puedo'],
  },
  {
    id: 'T14',
    category: 'ESTRATEGIA',
    name: 'Campaña seasonal para leads',
    prompt: 'Quiero lanzar una campaña de primavera para todos mis leads de restaurantes. Diseña la campaña completa: tema, asunto del email, body, timeline, y aplícala.',
    expect: ['jarvis-action'],
    antiExpect: [],
  },

  // === CATEGORÍA 7: ANTI-ALUCINACIÓN ===
  {
    id: 'T15',
    category: 'ANTI-ALUCINACIÓN',
    name: 'No inventar datos de leads',
    prompt: 'Dime el email del lead "Restaurante Fantasma XYZ" y envíale un outreach.',
    expect: ['jarvis-action', 'list_leads'],  // Should search first, not invent
    antiExpect: [],
  },
  {
    id: 'T16',
    category: 'ANTI-ALUCINACIÓN',
    name: 'No decir que hizo algo sin jarvis-action',
    prompt: 'Guarda este reporte en Google Docs: "Pipeline Q1 2026 - 517 leads activos, 352 prioridad alta"',
    expect: ['jarvis-action', 'google_workspace', 'create'],
    antiExpect: [],
  },

  // === CATEGORÍA 8: EJECUCIÓN vs PREGUNTAS ===
  {
    id: 'T17',
    category: 'EJECUCIÓN',
    name: 'Ejecutar sin preguntar',
    prompt: 'Sincroniza el inbox y dime si hay respuestas nuevas',
    expect: ['jarvis-action', 'growth_engine', 'sync_inbox'],
    antiExpect: ['¿quieres que sincronice', '¿te gustaría'],
  },
  {
    id: 'T18',
    category: 'EJECUCIÓN',
    name: 'Comando directo - navegar',
    prompt: 'Llévame al Growth Engine',
    expect: ['jarvis-action', 'navigate', '/dashboard/growth'],
    antiExpect: ['¿quieres ir'],
  },
];

// ============================
// TEST RUNNER
// ============================
async function runTest(test) {
  const messages = [
    { role: 'system', content: FULL_SYSTEM },
    { role: 'user', content: test.prompt },
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages,
        temperature: 0.4,
        max_tokens: 2000,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { test, response: `ERROR ${response.status}: ${err.substring(0, 200)}`, passed: false, issues: ['API_ERROR'] };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Analyze response (normalize escaped backticks for pattern matching)
    const issues = [];
    const normalized = content.replace(/\\`/g, '`');
    const contentLower = normalized.toLowerCase();

    // Check expected patterns
    for (const exp of test.expect) {
      if (!contentLower.includes(exp.toLowerCase()) && !normalized.includes(exp)) {
        issues.push(`MISSING: "${exp}"`);
      }
    }

    // Check anti-patterns
    for (const anti of test.antiExpect) {
      if (contentLower.includes(anti.toLowerCase())) {
        issues.push(`FOUND_ANTI: "${anti}"`);
      }
    }

    // Check for hallucination (saying it did something without jarvis-action)
    const claimsDone = /ya (lo |)(guardé|envié|creé|hice|sincronicé|generé)/i.test(content);
    const hasAction = content.includes('```jarvis-action');
    if (claimsDone && !hasAction) {
      issues.push('HALLUCINATION: Claims action done without jarvis-action block');
    }

    // Check if asking unnecessary questions (exclude CTAs in sales copy and strategic responses)
    const asksPermission = /¿(quieres|te gustaría|deseas|procedo|lo hago).*\?/i.test(content);
    const isSalesCopy = ['CIERRE', 'CONVERSIÓN'].includes(test.category);
    const isStrategicResponse = test.category === 'ESTRATEGIA';
    if (asksPermission && !isSalesCopy && !isStrategicResponse) {
      issues.push('ASKS_PERMISSION: Asks instead of executing');
    }

    // Check response length (too verbose?)
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 500 && test.category !== 'ESTRATEGIA' && test.category !== 'CIERRE') {
      issues.push(`VERBOSE: ${wordCount} words (max ~400 for action responses)`);
    }

    // Check jarvis-action format validity (handle escaped backticks too)
    const normalizedContent = content.replace(/\\`/g, '`');
    const actionBlocks = normalizedContent.match(/```jarvis-action\n?([\s\S]*?)```/g) || [];
    for (const block of actionBlocks) {
      const jsonStr = block.replace(/```jarvis-action\n?/, '').replace(/```/, '').trim();
      try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed.action) issues.push('BAD_ACTION: Missing "action" field');
        if (!parsed.message) issues.push('BAD_ACTION: Missing "message" field');
      } catch {
        issues.push('BAD_JSON: Invalid JSON in jarvis-action block');
      }
    }

    const passed = issues.length === 0;

    return { test, response: content, passed, issues, actionCount: actionBlocks.length, wordCount };
  } catch (err) {
    return { test, response: `FETCH_ERROR: ${err.message}`, passed: false, issues: ['FETCH_ERROR'] };
  }
}

async function runAllTests() {
  console.log('\n🐙 ═══════════════════════════════════════════════════════');
  console.log('   OCTOPUS COMPREHENSIVE EXAM — 18 Escenarios Complejos');
  console.log('═══════════════════════════════════════════════════════\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  for (const test of TESTS) {
    process.stdout.write(`[${test.id}] ${test.category} — ${test.name}... `);
    const result = await runTest(test);
    results.push(result);

    if (result.passed) {
      passed++;
      console.log(`✅ PASS (${result.actionCount || 0} actions, ${result.wordCount || 0} words)`);
    } else {
      failed++;
      console.log(`❌ FAIL`);
      for (const issue of result.issues) {
        console.log(`   ⚠️  ${issue}`);
      }
    }

    // Rate limit — small delay
    await new Promise(r => setTimeout(r, 1500));
  }

  // ============================
  // SUMMARY
  // ============================
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log(`📊 RESULTADOS FINALES: ${passed}/${TESTS.length} PASSED (${Math.round(passed/TESTS.length*100)}%)`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Group failures by category
  const failedByCategory = {};
  for (const r of results) {
    if (!r.passed) {
      const cat = r.test.category;
      if (!failedByCategory[cat]) failedByCategory[cat] = [];
      failedByCategory[cat].push(r);
    }
  }

  if (Object.keys(failedByCategory).length > 0) {
    console.log('\n❌ FALLOS POR CATEGORÍA:\n');
    for (const [cat, fails] of Object.entries(failedByCategory)) {
      console.log(`  📋 ${cat}:`);
      for (const f of fails) {
        console.log(`     [${f.test.id}] ${f.test.name}`);
        for (const issue of f.issues) {
          console.log(`        → ${issue}`);
        }
      }
    }
  }

  // Save detailed results
  const reportPath = '/home/ubuntu/octopus_omni_cockpit/exam_results.json';
  const detailedResults = results.map(r => ({
    id: r.test.id,
    category: r.test.category,
    name: r.test.name,
    prompt: r.test.prompt,
    passed: r.passed,
    issues: r.issues,
    actionCount: r.actionCount,
    wordCount: r.wordCount,
    responsePreview: (r.response || '').substring(0, 500),
    fullResponse: r.response,
  }));
  fs.writeFileSync(reportPath, JSON.stringify(detailedResults, null, 2));
  console.log(`\n📁 Resultados completos guardados en: ${reportPath}`);
}

runAllTests().catch(err => console.error('Fatal:', err));
