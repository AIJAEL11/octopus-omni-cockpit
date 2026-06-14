// OCTOPUS Chat System - Asistente conversacional inteligente
// Cleaned: removed ~1200 lines of dead code (unused detectors, legacy system prompt)
// Alive exports: buildChatContext, detectIoTIntent, detectBrazosIntent, IoTIntent, BrazosIntent

// ═══════════════ IoT Intent Detection ═══════════════

export interface IoTIntent {
  detected: boolean
  action: 'on' | 'off' | 'toggle' | 'brightness' | 'colorTemp' | 'status' | 'all_off' | 'scene' | 'setup' | 'hubspace_info' | 'iot_info' | null
  target: string | null // device name, room, or "todo/all"
  sceneName: string | null
  params?: Record<string, unknown>
}

// Helper: check if message has a location/device qualifier after "luz/luces"
// e.g., "enciende la luz del playroom" → has qualifier → IoT, not theme
function hasLocationQualifier(msg: string): boolean {
  return /(?:luz|luces|bombill[ao]|foco|lámpara|lampara|led)\s+(?:del?|en|de\s+la|de\s+el)\s+\S+/i.test(msg)
}

// ═══════════════ Brazos Health Check Intent ═══════════════

export interface BrazosIntent {
  detected: boolean
  action: 'health_check' | 'troubleshoot' | null
}

export function detectBrazosIntent(message: string): BrazosIntent {
  const lower = message.toLowerCase().trim()

  // Direct health/status check
  if (/(?:estado|salud|health|status|diagnos|revisa|chequea|check)\s*(?:de\s+(?:los?\s+)?)?(?:brazos?|conexion|conexión|integracion|integración)/i.test(lower)) {
    return { detected: true, action: 'health_check' }
  }
  if (/(?:mis?\s+)?(?:brazos?|conexion|conexión|telegram|google)\s+(?:está|estan|funciona|anda|sirve|responde|no\s+(?:funciona|responde|anda|sirve))/i.test(lower)) {
    return { detected: true, action: 'troubleshoot' }
  }
  if (/(?:por\s*qu[eé]|porque|why)\s+(?:no\s+)?(?:funciona|responde|anda|sirve)\s+(?:telegram|google|el\s+bot|mi\s+bot)/i.test(lower)) {
    return { detected: true, action: 'troubleshoot' }
  }
  if (/(?:telegram|bot|google)\s+(?:no\s+)?(?:funciona|responde|está?\s+ca[ií]do|se\s+(?:desconect|cay)|down)/i.test(lower)) {
    return { detected: true, action: 'troubleshoot' }
  }
  if (/(?:se\s+)?(?:desconect[oó]|cay[oó]|perdi[oó])\s+(?:un?\s+)?(?:brazo|telegram|google|conexi[oó]n)/i.test(lower)) {
    return { detected: true, action: 'troubleshoot' }
  }
  if (/(?:problemas?|error|fallo|falla)\s+(?:con\s+)?(?:brazos?|telegram|google|conexion|conexión|webhook)/i.test(lower)) {
    return { detected: true, action: 'troubleshoot' }
  }
  if (/(?:diagnostica|analiza|revisa|inspecciona)\s+(?:los?\s+)?(?:brazos?|conexion|conexión|sistema)/i.test(lower) && /(?:brazo|conexi|telegram|google)/i.test(lower)) {
    return { detected: true, action: 'health_check' }
  }

  return { detected: false, action: null }
}

// ═══════════════ IoT / Smart Home Intent Detection ═══════════════

export function detectIoTIntent(message: string): IoTIntent {
  const lower = message.toLowerCase().trim()

  // HubSpace / IoT capability questions — "hubspace lo puedes detectar?", "puedes controlar hubspace?"
  if (/hubspace|hub\s*space/i.test(lower) && /(?:puedes|puede|detecta|controla|integra|funciona|soporta|compatible|tienes|tiene|maneja)/i.test(lower)) {
    return { detected: true, action: 'hubspace_info', target: null, sceneName: null }
  }
  // Generic IoT capability questions — "puedes controlar mis dispositivos?", "controlas luces?"
  if (/(?:puedes|puede|sabes?|tienes?)\s+(?:controlar|manejar|detectar|encender|apagar)\s+(?:mis?\s+)?(?:dispositivos?|luces?|enchufes?|casa|hogar)/i.test(lower)) {
    return { detected: true, action: 'iot_info', target: null, sceneName: null }
  }

  // Setup / configuration intent — guide user through bridge setup
  if (/(?:cómo|como)\s+(?:configuro|conecto|instalo|activo|pongo|uso|controlo|manejo)/i.test(lower) && /(?:hogar|casa|luz|luces|bombill|dispositivo|iot|smart\s*home|bridge|wiz|hubspace|hub\s*space|defiant)/i.test(lower)) {
    return { detected: true, action: 'setup', target: null, sceneName: null }
  }
  if (/(?:configurar|conectar|instalar|activar|setup)\s+(?:el\s+|mi\s+|la\s+)?(?:hogar|casa|bridge|wiz|smart\s*home|iot|dispositivo|hubspace|hub\s*space|defiant)/i.test(lower)) {
    return { detected: true, action: 'setup', target: null, sceneName: null }
  }
  if (/(?:quiero|necesito|ayuda|help)\s+(?:a\s+)?(?:controlar|configurar|conectar|instalar)\s+(?:mis?\s+)?(?:luces?|bombill|dispositivo|casa|hogar|hubspace|defiant)/i.test(lower)) {
    return { detected: true, action: 'setup', target: null, sceneName: null }
  }
  if (/(?:guía|guia|tutorial|pasos|instrucciones)\s+(?:de\s+|del\s+|para\s+)?(?:hogar|bridge|wiz|smart\s*home|configuraci[oó]n|setup|hubspace)/i.test(lower)) {
    return { detected: true, action: 'setup', target: null, sceneName: null }
  }
  if (/(?:setup|configurar)\s+(?:el\s+)?bridge/i.test(lower) || lower === 'setup bridge' || lower === 'configurar bridge') {
    return { detected: true, action: 'setup', target: null, sceneName: null }
  }

  // "estado del hogar" / "qué está encendido" / "status hogar"
  if (/(?:estado|status)\s*(?:del|de)?\s*(?:hogar|casa|dispositivos?)|qué\s*está\s*encendido|cuántos?\s*(?:están?\s*)?encendidos?/i.test(lower)) {
    return { detected: true, action: 'status', target: null, sceneName: null }
  }

  // "apaga todo" / "apaga todos" / "apagar todo"
  if (/(?:apaga|apagar|desactiva|desactivar)\s*(?:todo|todos|everything)/i.test(lower)) {
    return { detected: true, action: 'all_off', target: null, sceneName: null }
  }

  // Scenes: "modo película", "modo dormir", "ejecuta escena X"
  const sceneMatch = lower.match(/(?:modo|escena|scene|activa)\s+(película|pelicula|dormir|cine|fiesta|relax|mañana|romántic[oa]|gaming|trabajo)/)
  if (sceneMatch) {
    return { detected: true, action: 'scene', target: null, sceneName: sceneMatch[1] }
  }

  // Brightness: "pon el brillo al 50%", "brillo 80", "sube el brillo", "baja el brillo"
  const brightnessMatch = lower.match(/(?:brillo|brightness|dimming)\s*(?:al?\s*)?(\d+)\s*%?/)
  if (brightnessMatch) {
    const val = Math.max(1, Math.min(100, parseInt(brightnessMatch[1])))
    const target = lower.replace(/(?:pon|poner|ajusta|ajustar|cambia|cambiar|sube|subir|baja|bajar)?\s*(?:el|la|los|las)?\s*(?:brillo|brightness|dimming)\s*(?:al?\s*)?\d+\s*%?\s*(?:de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'brightness', target: target || null, sceneName: null, params: { brightness: val } }
  }

  // "sube/baja el brillo"
  if (/(?:sube|subir|más)\s*(?:el)?\s*(?:brillo|brightness)/i.test(lower)) {
    const target = lower.replace(/^.*?(?:sube|subir|más)\s*(?:el)?\s*(?:brillo|brightness)\s*(?:de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'brightness', target: target || null, sceneName: null, params: { brightness: 100 } }
  }
  if (/(?:baja|bajar|menos)\s*(?:el)?\s*(?:brillo|brightness)/i.test(lower)) {
    const target = lower.replace(/^.*?(?:baja|bajar|menos)\s*(?:el)?\s*(?:brillo|brightness)\s*(?:de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'brightness', target: target || null, sceneName: null, params: { brightness: 30 } }
  }

  // Color temperature: "pon temperatura 4000", "luz cálida", "luz fría"
  const colorTempMatch = lower.match(/(?:temperatura|temp|color\s*temp)\s*(?:de?\s*color)?\s*(?:al?\s*)?(\d{4,})\s*k?/)
  if (colorTempMatch) {
    const val = Math.max(2200, Math.min(6500, parseInt(colorTempMatch[1])))
    const target = lower.replace(/(?:pon|poner|ajusta|ajustar|cambia|cambiar)?\s*(?:la|el)?\s*(?:temperatura|temp|color\s*temp)\s*(?:de?\s*color)?\s*(?:al?\s*)?\d+\s*k?\s*(?:de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'colorTemp', target: target || null, sceneName: null, params: { colorTemp: val } }
  }

  // "luz cálida" / "luz fría" / "luz neutra"
  if (/(?:luz|luces|bombill[ao])\s+(?:cálida|calida|warm)/i.test(lower)) {
    const target = lower.replace(/(?:pon|poner)?\s*(?:la|las)?\s*(?:luz|luces|bombill[ao])\s+(?:cálida|calida|warm)\s*(?:en|de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'colorTemp', target: target || null, sceneName: null, params: { colorTemp: 2700 } }
  }
  if (/(?:luz|luces|bombill[ao])\s+(?:fría|fria|cool|blanca)/i.test(lower)) {
    const target = lower.replace(/(?:pon|poner)?\s*(?:la|las)?\s*(?:luz|luces|bombill[ao])\s+(?:fría|fria|cool|blanca)\s*(?:en|de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'colorTemp', target: target || null, sceneName: null, params: { colorTemp: 6500 } }
  }
  if (/(?:luz|luces|bombill[ao])\s+(?:neutra|neutral|natural)/i.test(lower)) {
    const target = lower.replace(/(?:pon|poner)?\s*(?:la|las)?\s*(?:luz|luces|bombill[ao])\s+(?:neutra|neutral|natural)\s*(?:en|de(?:l)?\s*(?:la|el)?\s*)?/i, '').trim()
    return { detected: true, action: 'colorTemp', target: target || null, sceneName: null, params: { colorTemp: 4000 } }
  }

  // GUARD: If message is very long (>120 chars), it's almost certainly NOT a simple IoT command.
  if (lower.length > 120) {
    return { detected: false, action: null, target: null, sceneName: null }
  }

  // Specific device/room commands — use word boundaries (\b) to prevent false matches
  const deviceKeywords = '\\b(?:luz|luces|lámpara|lampara|foco|bombill[ao]|bombillo|led|televisor|tele|tv|televisión|television|aire\\s*acondicionado|ventilador|abanico|bocina|radio|speaker|parlante|enchufe|plug|calentador|cafetera|microondas|lavadora|secadora|light|bulb|lamp|hubspace|defiant|octopus)\\b'
  const roomKeywords = '\\b(?:sala|salón|salon|dormitorio|cuarto|habitación|habitacion|cocina|baño|oficina|comedor|terraza|garaje|patio|recámara|recamara|estudio|playroom|bedroom|living|kitchen|bathroom|office|garage)\\b'

  const hasDeviceOrRoom = new RegExp(`${deviceKeywords}|${roomKeywords}`, 'i').test(lower)
  const hasQualifier = hasLocationQualifier(lower)
  
  // Helper to clean voice filler words and punctuation from target
  const fillerPat = /^(?:ahora|ya|por\s+favor|please|solo|solamente|ok|okey|okay|bueno|pues|entonces|mira|oye|eh|este|eso)\s+/i
  const cleanTarget = (t: string) => {
    let c = t.replace(/[.,!?;:…]+$/g, '').trim()
    for (let i = 0; i < 5; i++) {
      const next = c.replace(fillerPat, '').trim()
      if (next === c) break
      c = next
    }
    c = c.replace(/\s+(?:ahora|ya|por\s+favor|please)$/gi, '').trim()
    return c
  }

  // Spanish pronoun suffixes pattern
  const pronounSuffix = '(?:l[oa]s?|les?|me|te|nos|se)?'
  const onVerbPat = `\\b(?:enciende|encender|prende|prender|activa|activar|pon|poner|turn\\s*on)${pronounSuffix}\\b`
  const offVerbPat = `\\b(?:apaga|apagar|desactiva|desactivar|desconecta|desconectar|turn\\s*off)${pronounSuffix}\\b`

  // Specific "enciende/apaga la [device] de [room]" patterns  
  if (hasDeviceOrRoom || hasQualifier) {
    if (new RegExp(onVerbPat, 'i').test(lower)) {
      const raw = lower.replace(new RegExp(`^.*?${onVerbPat}\\s+(?:el|la|los|las)?\\s*`, 'i'), '').trim()
      const target = cleanTarget(raw)
      return { detected: true, action: 'on', target: target || null, sceneName: null }
    }
    if (new RegExp(offVerbPat, 'i').test(lower)) {
      const raw = lower.replace(new RegExp(`^.*?${offVerbPat}\\s+(?:el|la|los|las)?\\s*`, 'i'), '').trim()
      const target = cleanTarget(raw)
      return { detected: true, action: 'off', target: target || null, sceneName: null }
    }
  }

  // BARE VERB FALLBACK — "enciéndelo", "apágalo", "préndelo"
  const bareFillers = '(?:ok|bueno|dale|gracias|porfa(?:vor)?|por\\s+favor|pues|entonces|ya|ahora|oye|mira|please|otra\\s+vez|nuevamente|de\\s+nuevo|again)?'
  const barePadding = `(?:\\s+${bareFillers})*`
  
  const bareOnPat = new RegExp(`^${barePadding}\\s*${onVerbPat}${barePadding}\\s*[.!?]*$`, 'i')
  const bareOffPat = new RegExp(`^${barePadding}\\s*${offVerbPat}${barePadding}\\s*[.!?]*$`, 'i')
  
  if (bareOnPat.test(lower)) {
    return { detected: true, action: 'on', target: null, sceneName: null }
  }
  if (bareOffPat.test(lower)) {
    return { detected: true, action: 'off', target: null, sceneName: null }
  }

  // "sube/baja la temperatura" / "sube/baja el AC"
  if (/(?:sube|subir|baja|bajar)\s+(?:la|el)?\s*(?:temperatura|ac|aire|acondicionado|ventilador)/i.test(lower)) {
    const action = /(?:sube|subir)/i.test(lower) ? 'on' : 'off'
    const target = lower.replace(/^.*?(?:sube|subir|baja|bajar)\s+(?:la|el)?\s*/i, '').trim()
    return { detected: true, action, target: target || 'temperatura', sceneName: null }
  }

  return { detected: false, action: null, target: null, sceneName: null }
}

// ═══════════════ Chat Context Builder ═══════════════

export function buildChatContext(data: {
  userName?: string
  projects: { name: string; status: string; progress: number }[]
  brazos: { type: string; status: string }[]
  agents: { name: string; isActive: boolean; description?: string; model?: string; category?: string; systemPromptPreview?: string }[]
  skills: { name: string }[]
  mcps: { name: string; isConnected: boolean }[]
  recentActivities: string[]
}): string {
  return `
## ESTADO ACTUAL DEL SISTEMA
${data.userName ? `\n### Usuario\n- Nombre: **${data.userName}**\n- IMPORTANTE: Cuando el usuario pregunte su nombre, responde "${data.userName}". SIEMPRE usa su nombre para personalizar respuestas.\n` : ''}

### Proyectos (${data.projects.length})
${data.projects.length > 0 
  ? data.projects.map(p => `- ${p.name}: ${p.status} (${p.progress}%)`).join('\n')
  : '- No hay proyectos activos'}

### Brazos Conectados
${data.brazos.filter(b => b.status === 'connected').map(b => `- ${b.type}: ✅ Conectado`).join('\n') || '- Ningún brazo conectado'}
${data.brazos.some(b => b.type === 'google_workspace' && b.status === 'connected') ? '🔵 Google Workspace ACTIVO: Puedes usar acciones google_workspace para Calendar, Drive, Docs, Sheets' : '⚪ Google Workspace NO conectado'}

### Agentes Activos (${data.agents.filter(a => a.isActive).length})
${data.agents.filter(a => a.isActive).length > 0 
  ? data.agents.filter(a => a.isActive).map(a => `- **${a.name}**${a.category ? ` [${a.category}]` : ''}${a.model ? ` (${a.model})` : ''}${a.description ? ` — ${a.description}` : ''}${a.systemPromptPreview ? `\n  Especialización: ${a.systemPromptPreview}` : ''}`).join('\n')
  : '- No hay agentes activos'}
${data.agents.filter(a => a.isActive).length > 0 ? '\n💡 Puedes DELEGAR tareas a estos agentes usando: {"action": "delegate_agent", "agentName": "NombreDelAgente", "task": "la tarea a realizar", "message": "Delegando..."}' : ''}

### Skills Disponibles (${data.skills.length})
${data.skills.slice(0, 5).map(s => `- ${s.name}`).join('\n') || '- No hay skills creadas'}

### MCPs (${data.mcps.filter(m => m.isConnected).length} conectados)
${data.mcps.map(m => `- ${m.name}: ${m.isConnected ? '🟢' : '🔴'}`).join('\n') || '- No hay MCPs configurados'}

### Actividad Reciente
${data.recentActivities.slice(-5).join('\n') || '- Sin actividad reciente'}
`
}
