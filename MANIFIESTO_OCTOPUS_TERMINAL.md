# 🐙 MANIFIESTO OCTOPUS — "LA NUEVA CARA"
### Renovación a Terminal Híbrida Inteligente · Documento maestro para el agente desarrollador (Claw Code)

> **Autor de la visión:** Rafael — CEO, Octopus Skills
> **Propósito de este documento:** Plasmar de forma estructurada, completa y accionable la reestructuración de la interfaz de OCTOPUS, para entregarla como manifiesto al agente que ejecutará el desarrollo. Todo lo descrito aquí **ya es funcional en la plataforma actual**; esta renovación reorganiza y potencia la experiencia, NO parte de cero.

---

## 0. RESUMEN EN UNA FRASE

Convertir OCTOPUS en una **terminal-chat minimalista y moderna** — un híbrido entre el estilo de *Hermes* y *Codex*, fácil para el usuario que recién entra al mundo de la IA, pero "con esteroides" por debajo — donde el usuario **pide en lenguaje natural (escrito o hablado) y OCTOPUS lo hace todo por él**: automatiza la web, controla su hogar, programa, crea skills/MCPs/bots y se conecta a sus modelos y herramientas locales a través del **Puente**.

---

## 1. CONCEPTO CENTRAL: "OCTOPUS LO HACE TODO POR TI"

La filosofía es **una sola caja de chat como puerta de entrada a todo**. En vez de obligar al usuario a navegar 25 secciones, la nueva cara presenta un chat central (referencia visual: la simplicidad de Gemini) desde el cual OCTOPUS:

- Entiende la intención del usuario.
- Ejecuta la acción en el módulo correcto (web, hogar, código, creatividad…).
- Devuelve el resultado **con feedback real** (ya implementado: verifica el Puente, espera resultados reales, reporta ✅/❌ con datos).

**El poder diferencial de OCTOPUS** (lo que, según Rafael, no existe igual en la red): la capacidad de **detectar y fusionar sistemas open-source del entorno del usuario** y conectarlos como "brazos" — sea expansión de memoria, un nuevo "cerebro" (modelo), o una herramienta con función beneficiosa. *"Si está en mi PC, soy libre de conectarlo"* — sin complejidad de integraciones.

---

## 2. LA NUEVA INTERFAZ: TERMINAL HÍBRIDA

### 2.1 Estilo visual
- **Terminal moderna minimalista** — limpia, enfocada, sin saturación. Pensada para el primer usuario que entra a la IA.
- **Híbrido Hermes + Codex:** estética de terminal de desarrollador, pero con la calidez y facilidad de un asistente conversacional.
- **Paleta:** se conserva el **color fresco pastel** actual de Octopus (naranja #C4622D, verde #2D4A3E, crema #F5F0E8) como base.
- **Personalización del usuario:** opción para que cada usuario **cambie el estilo de los elementos** (temas/skins) a su gusto.
- **Referencia de layout:** la simplicidad de la caja de chat de Gemini, pero con identidad y capacidades propias de Octopus.

### 2.2 Modos de interacción
- Entrada por **texto** y por **voz** (ya soportado).
- Un **Enter** dispara la acción. La experiencia debe sentirse instantánea y automática.

---

## 3. EL PUENTE (BRIDGE): EL CORAZÓN FUNCIONAL

El Puente es lo que conecta OCTOPUS (la nube) con el PC y el hogar del usuario.

- **Descarga automática y sin fricción:** el usuario descarga todo el contenido (el ZIP funcional) **a través del Puente, sin necesidad de abrir su terminal**. Un simple **Enter** lo hace automático.
- **El ZIP es funcional**, no un demo: ejecuta acciones reales en el entorno del usuario.
- Todo lo que requiere el entorno local (navegador, hogar, modelos, archivos) pasa por el Puente.
- **Estado verificable:** OCTOPUS ya consulta el heartbeat real del Puente antes de cada acción y es honesto si está desconectado (mejora Anti-humo ya implementada).

> **Énfasis para el desarrollador:** la promesa clave es "cero terminal para el usuario final". El Puente abstrae toda la complejidad. El usuario nunca debería tener que escribir comandos de sistema.

---

## 4. MÓDULOS DE LA NUEVA CARA

### 4.1 💬 CHAT — La pieza clave
El chat es el centro de todo y **la pieza más importante**.
- El sistema **identifica los modelos que el usuario tiene activos** (locales/open-source vía el Puente, o por API) y puede **hablar con ellos o usarlos directamente desde la terminal**.
- OCTOPUS detecta y **adapta sistemas open-source** del entorno, fusionándose con ellos para crecer: memoria, cerebro (modelos), herramientas → todo se conecta como un **brazo**.
- Desempeño actual conservado: comando escrito o hablado → resultado, capaz de **crear skills, MCPs, bots, etc.**, adaptándose al contexto de cada petición.

### 4.2 🌐 BUSCADOR WEB + SKILLS DE AUTOMATIZACIÓN
En el buscador web, el usuario podrá **crear skills personalizadas para automatizar tareas en la web**.
- Incluir un **listado de plataformas que automatizan publicaciones/tareas web** (ej: **Publer**), cada una con su propia **sección dedicada**.
- Estas skills se ejecutan de verdad vía el Puente con feedback real (base ya implementada: plantilla "Publicar en Publer" + encadenamiento imagen→publicación con `{{last_image_url}}`).

### 4.3 🔁 LISTA DE AUTOMATIZACIONES (REEMPLAZA "SOCIAL BRIDGE")
**Acción concreta:** eliminar el módulo actual "Social Bridge" y **reemplazarlo por una lista de páginas/plataformas de automatización**.
- El usuario **ingresa sus credenciales** de cada plataforma.
- Esto facilita el **ingreso automático del navegador** (vía Puente) para **publicar automáticamente**.
- Cada plataforma = una tarjeta/sección con su login y sus skills disponibles.

### 4.4 🏠 SMART HOME — "El alma letal"
El módulo estrella emocional del producto.
- Conecta **todo el hogar** y es funcional **a través del Puente** y de las apps.
- Incluye la **descarga de la app** que enciende luces y maneja los conectores.
- El usuario controla su casa por chat/voz desde la misma terminal.

### 4.5 ⚙️ CODE ENGINE — Codificación potente
El sistema de codificación de alto nivel.
- El usuario **elige entre distintos modelos a través de su API preferida**.
- Mismo desempeño de OCTOPUS: pide por **texto o voz**, recibe resultados como hoy.
- Capaz de **crear skills, MCPs, bots** y **adaptarse al entorno** de cada petición.

### 4.6 🧰 DEMÁS HERRAMIENTAS
Todas las herramientas funcionales actuales **se conservan y se integran** en la nueva cara (no se eliminan, salvo Social Bridge que se transforma). Inventario actual a preservar:
- Creatividad: Ad Factory, UGC Factory, Motion Graphics, generación de imagen/video.
- Productividad: Projects, Project Builder, Calendar, Tasks, Invoices.
- Inteligencia/Growth: Growth Engine, Sales Agent, Website Intelligence, Knowledge Base.
- Agentes/Conexiones: Agent Factory, MCP Factory, MCP Directory, API Hub, Brazos.
- Chat/Modelos: Multi-Agent Chat, Ollama Chat, Voice Agent, Ask-Octo.

---

## 5. MEMORIA: "BURBUJAS" — EL MAPA MENTAL INFINITO

Una capacidad nueva y diferencial:
- OCTOPUS podrá **crear burbujas de carpetas separadas orgánicamente**, clasificando la información del usuario **por categorías**.
- Beneficio doble:
  1. **Optimización de tokens** — la información está repartida y se recupera solo la burbuja relevante.
  2. **Mejor búsqueda y organización** — el usuario encuentra lo que quiere más rápido.
- Concepto: el **"mapa mental infinito"** de OCTOPUS — su memoria viva, auto-organizada y escalable.

> **Nota técnica para el desarrollador:** esto se apoya en el sistema RAG/knowledge-base existente. Las "burbujas" son colecciones categorizadas con recuperación selectiva para minimizar contexto enviado al modelo.

---

## 6. CANALES DE CONEXIÓN (OMNICANAL)

OCTOPUS se conecta y responde a través de:
- **Telegram**
- **WhatsApp**
- **Mensaje de texto (SMS)**

El usuario puede dar órdenes y recibir resultados desde estos canales, no solo desde la web. La terminal es la casa central, pero OCTOPUS es accesible desde donde el usuario ya vive.

---

## 7. PRINCIPIOS DE DISEÑO (para el desarrollador)

1. **Simplicidad primero:** el usuario nuevo debe entender todo sin manual. Un chat, un Enter.
2. **Cero terminal para el usuario final:** el Puente esconde toda la complejidad técnica.
3. **Honestidad de OCTOPUS:** nunca afirmar que algo se ejecutó sin feedback real (ya implementado — mantener este estándar).
4. **Modularidad:** cada capacidad es un "brazo" enchufable; añadir uno nuevo no debe romper el resto.
5. **Personalización:** color pastel por defecto, pero el usuario manda sobre el estilo.
6. **Identidad propia:** inspiración en Gemini/Hermes/Codex, pero el resultado es inconfundiblemente Octopus.

---

## 8. QUÉ SE CONSERVA vs. QUÉ CAMBIA

| Área | Acción |
|---|---|
| Motor OCTOPUS (chat, voz, creación de skills/MCP/bots, feedback real del Puente) | ✅ Conservar y potenciar |
| Paleta pastel + identidad | ✅ Conservar (con opción de personalización) |
| Todas las herramientas funcionales | ✅ Conservar e integrar en la terminal |
| Smart Home (Hogar) | ⭐ Elevar a módulo estrella ("alma letal") |
| **Social Bridge** | 🔁 **Reemplazar** por Lista de Automatizaciones con credenciales |
| Memoria | ➕ Añadir sistema de **Burbujas** (mapa mental infinito) |
| Canales | ➕ Añadir **Telegram / WhatsApp / SMS** |
| Interfaz general | 🔄 Rediseñar a **terminal híbrida minimalista** |

---

## 9. LIBERTAD CREATIVA Y DIRECTIVAS PARA EL DESARROLLADOR

### 9.1 Libertad creativa
- **Puedes añadir hasta 3 elementos de valor** de tu propio criterio creativo si crees que fortalecen el producto. Si no lo crees necesario, omite esto por completo.
- Las adiciones creativas deben alinearse con la visión: simplicidad para el usuario nuevo, poder por debajo, identidad Octopus.

### 9.2 Corrección de bugs y optimización
- **El proyecto es funcional.** El objetivo es **optimizarlo, potenciarlo y actualizarlo** — NO reescribir ni reconstruir.
- Si encuentras bugs durante el desarrollo, **corrígelos** como parte del proceso. Perfeccionar lo que ya funciona es lo esperado.
- NO rompas funcionalidad existente. Cada módulo listado en este manifiesto ya opera en producción.

### 9.3 Idioma — BILINGÜE
- Toda la aplicación debe soportar **inglés y español**. El sistema de i18n ya está implementado (`lib/i18n-context.tsx`).
- Todos los textos nuevos de UI, labels, tooltips y mensajes deben proporcionarse en ambos idiomas.

### 9.4 Prioridad de construcción
1. **Fase 1:** Nueva shell de terminal-chat (UI) + personalización de estilo.
2. **Fase 2:** Reemplazo de Social Bridge → Lista de Automatizaciones (credenciales + secciones por plataforma, ej. Publer).
3. **Fase 3:** Sistema de Burbujas de memoria.
4. **Fase 4:** Canales omnicanal (Telegram / WhatsApp / SMS).
5. **Fase 5:** Pulido de Smart Home como módulo estrella + Code Engine con selector de API/modelo.

---

## APÉNDICE A: INVENTARIO TÉCNICO REAL

Este es el **estado exacto actual** de la plataforma. Úsalo como fuente de verdad — no reinventes lo que ya existe.

### A.1 Modelos de Base de Datos (Prisma — 86 modelos)

**Core:** User, Account, Session, VerificationToken, Subscription, Workspace, WorkspaceIndex, OnboardingData

**Chat & IA:** ChatSession, ChatMessage, ConsciousnessState, SessionMemory, SemanticMemory, SemanticVector, MessageFeedback, OllamaChatSession, OllamaChatMessage, QueryHistory

**OCTOPUS (Jarvis) Chat:** Usa modelos ChatSession/ChatMessage. Memoria: `/api/jarvis/memory`. Personalidad: `lib/octopus-personality.ts`. Herramientas: `lib/octopus-tools.ts`. Ejecutor: `lib/octopus-tool-executor.ts`.

**Skills/Agentes/MCP:** CustomSkill, SkillExecution, CustomAgent, CustomMcp, AgentLog

**Automatización del Navegador:** BrowserSession, BrowserCommand, BrowserTemplate, ScheduledBrowserTask, BridgeCommand

**Brazos/Conexiones:** ArmConnection, ArmData, ApiKey

**Proyectos y Creatividad:** Project, ProjectFile, ProjectMemory, CreativeAsset, LearningPattern

**Growth Engine:** GrowthLead, GrowthAction, GrowthMessage, GrowthInsight, Campaign, CampaignLead

**Smart Home (IoT):** SmartDevice, SmartCommand, SmartScene

**Code Engine (Claude Code):** CodeSession, CodeMessage, FileChangeEvent

**Ventas y Voz:** SalesAgent, SalesAgentLead, SalesChat, VoiceAgent

**Contenido y Publicación:** ContentPublishLog, SocialConnection, SocialPost, ExtensionSession, TrainingPattern

**Calendario y Tareas:** CalendarEvent, BookingConfig, TaskItem

**Facturación:** Invoice, InvoiceItem

**Sitios Hospedados:** HostedSite, HostedSiteFile, HostedSiteSnapshot, HostedSiteView

**Knowledge/RAG:** KnowledgeDocument, KnowledgeChunk, KnowledgeEntry, OctoKnowledge, GraphEntity, GraphRelation

**Nexus:** NexusProject, NexusLaunch, NexusEvent, NexusReport, NexusGuardianReview, NexusBlacklist

### A.2 Rutas API (170+ endpoints)

**Autenticación:** `/api/auth/[...nextauth]`, `/api/signup`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`

**Chat OCTOPUS (Jarvis):** `/api/jarvis` (GET sesiones), `/api/jarvis/chat` (POST mensaje), `/api/jarvis/create` (POST creación herramienta), `/api/jarvis/memory` (GET/POST persistencia), `/api/jarvis/generate-image`, `/api/jarvis/generate-video`, `/api/jarvis/web-search`, `/api/jarvis/tts`, `/api/jarvis/analyze-video`, `/api/jarvis/consciousness`, `/api/jarvis/introspect`, `/api/jarvis/implement`

**Automatización del Navegador:** `/api/browser-bridge` (GET poll / POST heartbeat+command_result), `/api/browser-bridge/sessions` (GET sessions+commands / POST create_session, send_command, ai_task, run_template, start/stop_recording), `/api/browser-bridge/templates` (CRUD), `/api/browser-bridge/scheduled`, `/api/browser-bridge/installer`

**Skills/Agentes/MCP:** `/api/skill-factory/skills` (CRUD), `/api/skill-factory/execute`, `/api/agent-factory/agents` (CRUD), `/api/agent-factory/chat`, `/api/mcp-factory/servers` (CRUD), `/api/mcp-factory/generate`, `/api/mcp-factory/test`

**Code Engine:** `/api/arms/claude-code/*` (chat, analyze, code-review, confirm, export, github-*, hostinger-deploy, image-gen, memory, open, poll, preview-render, respond, snapshots, stream, vision, workspace)

**Smart Home:** `/api/hogar/devices`, `/api/hogar/control`, `/api/hogar/config`, `/api/hogar/scenes`, `/api/hogar/hubspace/*`, `/api/hogar/bridge/*`, `/api/iot/control`

**Creatividad:** `/api/creative/generate`, `/api/creative/gallery`, `/api/creative/capabilities`, `/api/ad-factory/*`, `/api/ugc-factory/*`, `/api/motion-graphics/*`, `/api/services/image-generate`

**Growth Engine:** `/api/growth/leads/*`, `/api/growth/campaigns/*`, `/api/growth/actions/*`, `/api/growth/outreach/*`, `/api/growth/inbox/*`, `/api/growth/stats`, `/api/growth/insights`, `/api/growth/reports`, `/api/growth/track`

**Social Bridge (A REEMPLAZAR):** `/api/social-bridge/*`

**Ventas y Voz:** `/api/sales-agent/*`, `/api/voice-agent/*`

**Proyectos:** `/api/projects`, `/api/projects/[id]`, `/api/preview/generate`, `/api/chat`, `/api/chat/generate`

**Calendario, Tareas, Facturación, Sitios Hospedados, Knowledge, Admin, Settings, Brazos, etc.** (ver versión en inglés para lista completa)

### A.3 Páginas del Dashboard (30 secciones)

ad-factory, admin, agent-factory, api-hub, ask-octo, brazos, browser-automation, calendar, chat, claude-code, growth, hogar, invoices, jarvis, mcp-directory, mcp-factory, motion-graphics, multi-agent-chat, ollama-chat, project-builder, projects, sales-agent, settings, skill-factory, social-bridge (A REEMPLAZAR), tasks, ugc-factory, voice-agent, website-intelligence

### A.4 Páginas Públicas

`/` (landing), `/pricing`, `/legal`, `/privacy`, `/terms`, `/contact`, `/support`, `/blog`, `/promo`, `/nexus`

### A.5 Features implementadas a conservar

- **Sistema anti-humo:** pre-check Bridge (heartbeat 45s), polling comandos reales (60s), reporte honesto, validación pseudo-código skills → borradores.
- **Encadenamiento imagen→navegador:** placeholder `{{last_image_url}}` resuelto automáticamente.
- **Plan gate:** límites por plan (starter/pro/business), límite diario de emails, bypass admin.
- **Growth engine:** campañas, leads, outreach, batch approve con rate limiting, tracking pixel open rate.
- **Onboarding:** checklist 5 pasos desde DB real, widget salud de tentáculos.
- **Turbo Mode:** integración OpenRouter para modelos seleccionados por el usuario.
- **Google SSO + autenticación por credenciales.**
- **Facturación Stripe** (checkout, portal, webhooks, gestión de suscripciones).
- **i18n** (Inglés/Español) en toda la app.
- **Chat OCTOPUS persistente** con lógica de reintentos.

### A.6 Variables de entorno configuradas

ABACUSAI_API_KEY, DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, GOOGLE_WORKSPACE_CLIENT_ID/SECRET, GOOGLE_CLOUD_API_KEY, GOOGLE_GEMINI_API_KEY, LINKEDIN_CLIENT_ID/SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_GA_ID, FAL_KEY, AWS_BUCKET_NAME/REGION/FOLDER_PREFIX, CRON_SECRET, + 10 NOTIF_ID_* para notificaciones email.

---

*Fin del manifiesto. Este documento es la fuente de verdad de la visión de Rafael para "la nueva cara de OCTOPUS".*
