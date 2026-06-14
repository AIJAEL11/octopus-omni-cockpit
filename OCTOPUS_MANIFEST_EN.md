# 🐙 OCTOPUS MANIFEST — "THE NEW FACE"
### Renovation to Intelligent Hybrid Terminal · Master Document for the Developer Agent (Claude Code)

> **Vision Author:** Rafael — CEO, Octopus Skills
> **Purpose of this document:** To provide a complete, structured, and actionable blueprint for the UI/UX restructuring of OCTOPUS, to be delivered as a manifest to the developer agent executing the build. Everything described here **is already functional in the current platform**; this renovation reorganizes and supercharges the experience, NOT builds from scratch.

---

## 0. ONE-LINE SUMMARY

Transform OCTOPUS into a **minimalist modern terminal-chat** — a hybrid between the style of *Hermes* and *Codex*, easy for users who are brand-new to AI, but "on steroids" under the hood — where the user **asks in natural language (typed or spoken) and OCTOPUS does everything for them**: automates the web, controls their home, codes, creates skills/MCPs/bots, and connects to their local models and tools through the **Bridge**.

---

## 1. CORE CONCEPT: "OCTOPUS DOES EVERYTHING FOR YOU"

The philosophy is **a single chat box as the gateway to everything**. Instead of forcing the user to navigate 25+ sections, the new face presents a central chat (visual reference: the simplicity of Gemini) from which OCTOPUS:

- Understands the user’s intent.
- Executes the action in the correct module (web, home, code, creativity…).
- Returns the result **with real feedback** (already implemented: verifies the Bridge, waits for real results, reports ✅/❌ with data).

**OCTOPUS’s differential power** (what, according to Rafael, doesn’t exist like this anywhere on the internet): the ability to **detect and fuse open-source systems from the user’s environment** and connect them as "arms" — whether it’s memory expansion, a new "brain" (model), or any tool with a beneficial function. *"If it’s on my PC, I’m free to connect it"* — zero complex integrations needed.

---

## 2. THE NEW INTERFACE: HYBRID TERMINAL

### 2.1 Visual Style
- **Modern minimalist terminal** — clean, focused, no clutter. Designed for the first-time AI user.
- **Hermes + Codex hybrid:** developer-terminal aesthetics, but with the warmth and ease of a conversational assistant.
- **Palette:** the current **fresh pastel colors** are preserved (orange #C4622D, green #2D4A3E, cream #F5F0E8) as the base.
- **User customization:** option for each user to **change the element style** (themes/skins) to their preference.
- **Layout reference:** the simplicity of Gemini’s chat box, but with Octopus’s own identity and capabilities.

### 2.2 Interaction Modes
- Input via **text** and **voice** (already supported).
- One **Enter** fires the action. The experience must feel instantaneous and automatic.

---

## 3. THE BRIDGE: THE FUNCTIONAL HEART

The Bridge is what connects OCTOPUS (cloud) with the user’s PC and home.

- **Automatic, frictionless download:** the user downloads all content (the functional ZIP) **through the Bridge, without needing to open their terminal**. A simple **Enter** makes it automatic.
- **The ZIP is functional**, not a demo: it executes real actions in the user’s environment.
- Everything requiring the local environment (browser, home, models, files) goes through the Bridge.
- **Verifiable status:** OCTOPUS already checks the Bridge’s real heartbeat before every action and is honest if it’s disconnected (Anti-smoke improvement already implemented).

> **Emphasis for the developer:** the key promise is "zero terminal for the end user". The Bridge abstracts all complexity. The user should never have to type system commands.

---

## 4. MODULES OF THE NEW FACE

### 4.1 💬 CHAT — The Keystone
The chat is the center of everything and **the most important piece**.
- The system **identifies which models the user has active** (local/open-source via Bridge, or via API) and can **talk to them or use them directly from the terminal**.
- OCTOPUS detects and **adapts open-source systems** from the environment, fusing with them to grow: memory, brain (models), tools → everything connects as an **arm**.
- Current performance preserved: written or spoken command → result, capable of **creating skills, MCPs, bots, etc.**, adapting to each request’s context.

### 4.2 🌐 WEB BROWSER + AUTOMATION SKILLS
In the web browser, the user will be able to **create custom skills to automate web tasks**.
- Include a **list of platforms that automate publishing/web tasks** (e.g.: **Publer**), each with its own **dedicated section**.
- These skills execute for real via the Bridge with real feedback (base already implemented: "Publish on Publer" template + image→publish chaining with `{{last_image_url}}`).

### 4.3 🔁 AUTOMATION LIST (REPLACES "SOCIAL BRIDGE")
**Concrete action:** remove the current "Social Bridge" module and **replace it with a list of automation pages/platforms**.
- The user **enters their credentials** for each platform.
- This facilitates **automatic browser login** (via Bridge) to **publish automatically**.
- Each platform = a card/section with its login and available skills.

### 4.4 🏠 SMART HOME — "The Lethal Soul"
The emotional flagship module of the product.
- Connects **everything in the home** and is functional **through the Bridge** and apps.
- Includes **app download** that turns on lights and manages connectors.
- The user controls their house via chat/voice from the same terminal.

### 4.5 ⚙️ CODE ENGINE — Powerful Coding
The high-level coding system.
- The user **chooses between different models through their preferred API**.
- Same OCTOPUS performance: asks via **text or voice**, receives results as today.
- Capable of **creating skills, MCPs, bots** and **adapting to the environment** of each request.

### 4.6 🧰 ALL OTHER TOOLS
All current functional tools **are preserved and integrated** into the new face (none removed, except Social Bridge which transforms). Current inventory to preserve:
- Creativity: Ad Factory, UGC Factory, Motion Graphics, image/video generation.
- Productivity: Projects, Project Builder, Calendar, Tasks, Invoices.
- Intelligence/Growth: Growth Engine, Sales Agent, Website Intelligence, Knowledge Base.
- Agents/Connections: Agent Factory, MCP Factory, MCP Directory, API Hub, Brazos.
- Chat/Models: Multi-Agent Chat, Ollama Chat, Voice Agent, Ask-Octo.

---

## 5. MEMORY: "BUBBLES" — THE INFINITE MIND MAP

A new and differential capability:
- OCTOPUS will be able to **create organically separated folder bubbles**, classifying the user’s information **by categories**.
- Dual benefit:
  1. **Token optimization** — information is distributed and only the relevant bubble is retrieved.
  2. **Better search and organization** — the user finds what they want faster.
- Concept: OCTOPUS’s **"infinite mind map"** — its living, self-organized, scalable memory.

> **Technical note for the developer:** this leverages the existing RAG/knowledge-base system. "Bubbles" are categorized collections with selective retrieval to minimize context sent to the model.

---

## 6. CONNECTION CHANNELS (OMNICHANNEL)

OCTOPUS connects and responds through:
- **Telegram**
- **WhatsApp**
- **Text messages (SMS)**

The user can give commands and receive results from these channels, not just from the web. The terminal is the central home, but OCTOPUS is accessible from where the user already lives.

---

## 7. DESIGN PRINCIPLES (for the developer)

1. **Simplicity first:** a new user must understand everything without a manual. One chat, one Enter.
2. **Zero terminal for the end user:** the Bridge hides all technical complexity.
3. **OCTOPUS honesty:** never claim something executed without real feedback (already implemented — maintain this standard).
4. **Modularity:** each capability is a plug-in "arm"; adding a new one must not break the rest.
5. **Customization:** pastel colors by default, but the user decides the style.
6. **Own identity:** inspired by Gemini/Hermes/Codex, but the result is unmistakably Octopus.

---

## 8. WHAT STAYS vs. WHAT CHANGES

| Area | Action |
|---|---|
| OCTOPUS engine (chat, voice, skill/MCP/bot creation, real Bridge feedback) | ✅ Keep and enhance |
| Pastel palette + identity | ✅ Keep (with user customization option) |
| All functional tools | ✅ Keep and integrate in the terminal |
| Smart Home (Hogar) | ⭐ Elevate to flagship module ("lethal soul") |
| **Social Bridge** | 🔁 **Replace** with Automation List with credentials |
| Memory | ➕ Add **Bubbles** system (infinite mind map) |
| Channels | ➕ Add **Telegram / WhatsApp / SMS** |
| General interface | 🔄 Redesign to **minimalist hybrid terminal** |

---

## 9. DEVELOPER FREEDOM & GUIDELINES

### 9.1 Creative Freedom
- **You may add up to 3 value-add elements** of your own creative judgment if you believe they strengthen the product. If you don’t think any are needed, skip this entirely.
- Creative additions must align with the vision: simplicity for new users, power under the hood, Octopus identity.

### 9.2 Bug Fixing & Optimization
- **The project is functional.** The goal is to **optimize, potentiate, and update** — NOT to rewrite or rebuild.
- If you find bugs during development, **fix them** as part of the process. Perfecting what already works is expected.
- Do NOT break existing functionality. Every module listed in this manifest already works in production.

### 9.3 Language — BILINGUAL
- The entire application must support **both English and Spanish**. The i18n system is already in place (`lib/i18n-context.tsx`).
- All new UI text, labels, tooltips, and messages must be provided in both languages.

### 9.4 Build Priority
1. **Phase 1:** New terminal-chat shell (UI) + style customization.
2. **Phase 2:** Replace Social Bridge → Automation List (credentials + per-platform sections, e.g. Publer).
3. **Phase 3:** Bubbles memory system.
4. **Phase 4:** Omnichannel (Telegram / WhatsApp / SMS).
5. **Phase 5:** Smart Home polish as flagship + Code Engine with API/model selector.

---

## APPENDIX A: REAL TECHNICAL INVENTORY

This is the **exact current state** of the platform. Use it as your source of truth — don’t reinvent what already exists.

### A.1 Database Models (Prisma — 86 models)

**Core:**
User, Account, Session, VerificationToken, Subscription, Workspace, WorkspaceIndex, OnboardingData

**Chat & AI:**
ChatSession, ChatMessage, ConsciousnessState, SessionMemory, SemanticMemory, SemanticVector, MessageFeedback, OllamaChatSession, OllamaChatMessage, QueryHistory

**OCTOPUS (Jarvis) Chat:**
Jarvis uses ChatSession/ChatMessage models. Memory: `/api/jarvis/memory`. Personality: `lib/octopus-personality.ts`. Tools: `lib/octopus-tools.ts`. Executor: `lib/octopus-tool-executor.ts`.

**Skills/Agents/MCP:**
CustomSkill, SkillExecution, CustomAgent, CustomMcp, AgentLog

**Browser Automation:**
BrowserSession, BrowserCommand, BrowserTemplate, ScheduledBrowserTask, BridgeCommand

**Arms/Connections:**
ArmConnection, ArmData, ApiKey

**Projects & Creative:**
Project, ProjectFile, ProjectMemory, CreativeAsset, LearningPattern

**Growth Engine:**
GrowthLead, GrowthAction, GrowthMessage, GrowthInsight, Campaign, CampaignLead

**Smart Home (IoT):**
SmartDevice, SmartCommand, SmartScene

**Code Engine (Claude Code):**
CodeSession, CodeMessage, FileChangeEvent

**Sales & Voice:**
SalesAgent, SalesAgentLead, SalesChat, VoiceAgent

**Content & Publishing:**
ContentPublishLog, SocialConnection, SocialPost, ExtensionSession, TrainingPattern

**Calendar & Tasks:**
CalendarEvent, BookingConfig, TaskItem

**Invoicing:**
Invoice, InvoiceItem

**Hosted Sites:**
HostedSite, HostedSiteFile, HostedSiteSnapshot, HostedSiteView

**Knowledge/RAG:**
KnowledgeDocument, KnowledgeChunk, KnowledgeEntry, OctoKnowledge, GraphEntity, GraphRelation

**Nexus:**
NexusProject, NexusLaunch, NexusEvent, NexusReport, NexusGuardianReview, NexusBlacklist

**Other:**
OctoBlogPost, OctoGuideSession, OctoGuideMessage, OctoGuideAnalytics, LeadAssetProcess, LandingLead, Review, WebsiteIntelligence (via API)

### A.2 API Routes (170+ endpoints)

**Authentication:** `/api/auth/[...nextauth]`, `/api/signup`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`

**OCTOPUS Chat (Jarvis):** `/api/jarvis` (GET sessions), `/api/jarvis/chat` (POST message), `/api/jarvis/create` (POST tool creation), `/api/jarvis/memory` (GET/POST persistence), `/api/jarvis/generate-image`, `/api/jarvis/generate-video`, `/api/jarvis/web-search`, `/api/jarvis/tts`, `/api/jarvis/analyze-video`, `/api/jarvis/consciousness`, `/api/jarvis/introspect`, `/api/jarvis/implement`

**Browser Automation:** `/api/browser-bridge` (GET poll / POST heartbeat+command_result), `/api/browser-bridge/sessions` (GET sessions+commands / POST create_session, send_command, ai_task, run_template, start/stop_recording), `/api/browser-bridge/templates` (CRUD), `/api/browser-bridge/scheduled` (CRUD scheduled tasks), `/api/browser-bridge/installer` (Bridge download)

**Skills/Agents/MCP:** `/api/skill-factory/skills` (CRUD), `/api/skill-factory/execute` (POST run), `/api/agent-factory/agents` (CRUD), `/api/agent-factory/chat` (POST), `/api/mcp-factory/servers` (CRUD), `/api/mcp-factory/generate` (POST), `/api/mcp-factory/test` (POST)

**Code Engine (Claude Code):** `/api/arms/claude-code/*` (chat, analyze, code-review, confirm, export, github-*, hostinger-deploy, image-gen, memory, open, poll, preview-render, respond, snapshots, stream, vision, workspace)

**Smart Home:** `/api/hogar/devices`, `/api/hogar/control`, `/api/hogar/config`, `/api/hogar/scenes`, `/api/hogar/hubspace`, `/api/hogar/hubspace/discover`, `/api/hogar/bridge/*` (installer, token, heartbeat), `/api/iot/control`

**Creative:** `/api/creative/generate` (image+video), `/api/creative/gallery`, `/api/creative/capabilities`, `/api/ad-factory/*` (brand-dna, config, generate-image, generate-prompts, save-to-project), `/api/ugc-factory/*` (8 endpoints), `/api/motion-graphics/*` (8 endpoints), `/api/services/image-generate`

**Growth Engine:** `/api/growth/leads/*` (CRUD, import, research, auto-track), `/api/growth/campaigns/*` (CRUD, activate, nurture), `/api/growth/actions/*` (CRUD, batch-approve, update-copy), `/api/growth/outreach/*`, `/api/growth/inbox/*`, `/api/growth/stats`, `/api/growth/insights`, `/api/growth/reports`, `/api/growth/track` (pixel)

**Social Bridge (TO BE REPLACED):** `/api/social-bridge/*` (auth, publish, scheduler, status, history, linkedin/*, events, training, download-extension)

**Sales & Voice:** `/api/sales-agent/*`, `/api/voice-agent/*`

**Projects:** `/api/projects` (CRUD), `/api/projects/[id]` (GET/PATCH/DELETE), `/api/projects/[id]/upload`, `/api/preview/generate`, `/api/chat` (Orchestrator), `/api/chat/generate` (Agent swarm)

**Calendar & Tasks:** `/api/calendar/*`, `/api/tasks/*`

**Invoicing:** `/api/invoices/*`

**Hosted Sites:** `/api/hosted-sites/*`

**Knowledge:** `/api/knowledge`, `/api/octopus/knowledge`, `/api/octopus/memory`, `/api/octopus/arms`, `/api/octopus/graph`

**Admin:** `/api/admin/*` (CRUD, analytics, chat, email, octo-guide)

**Settings:** `/api/settings/profile`, `/api/settings/password`, `/api/settings/turbo`, `/api/settings/voice`, `/api/settings/watermark`

**Brazos (Arms):** `/api/brazos` (CRUD), `/api/brazos/health`, `/api/brazos/google/*`, `/api/brazos/telegram/*`, `/api/brazos/smtp/send`

**Other:** `/api/blog/*`, `/api/dashboard/kpis`, `/api/data-export/*`, `/api/indexnow`, `/api/leads/*`, `/api/multi-agent-chat`, `/api/nexus/*`, `/api/octo-guide/*`, `/api/onboarding/*`, `/api/plan/usage`, `/api/reviews/*`, `/api/stripe/*`, `/api/upload/avatar`, `/api/website-intelligence`, `/api/workspaces`, `/api/api-hub/*`, `/api/skills/*`, `/api/cron/*`

### A.3 Dashboard Pages (30 sections)

ad-factory, admin, agent-factory, api-hub, ask-octo, brazos, browser-automation, calendar, chat, claude-code, growth, hogar, invoices, jarvis (OCTOPUS chat), mcp-directory, mcp-factory, motion-graphics, multi-agent-chat, ollama-chat, project-builder, projects, sales-agent, settings, skill-factory, social-bridge (TO BE REPLACED), tasks, ugc-factory, voice-agent, website-intelligence

### A.4 Public Pages

`/` (landing), `/pricing`, `/legal`, `/privacy`, `/terms`, `/contact`, `/support`, `/blog`, `/promo`, `/nexus`

### A.5 Key Libraries

**OCTOPUS Brain:** `octopus-personality.ts` (25 personality modules), `octopus-tools.ts` (tool definitions), `octopus-tool-executor.ts` (execution engine), `octopus-rag.ts`, `octopus-reranker.ts`, `octopus-vectors.ts`, `octopus-knowledge-graph.ts`, `octopus-arms-integration.ts`, `octopus-global-state.ts`

**Jarvis Core:** `jarvis-core.ts`, `jarvis-chat.ts`, `jarvis-memory.ts`, `jarvis-actions.ts`, `jarvis-types.ts`, `jarvis-intelligence.ts`, `jarvis-enhancer.ts`, `jarvis-summarizer.ts`, `jarvis-eyes.ts`

**Auth & Plans:** `auth.ts`, `plan-gate.ts`, `plan-limits.ts`, `admin-guard.ts`, `admin-email.ts`

**Creative:** `creative-agents.ts`, `elite-creative-director.ts`, `image-model-router.ts`, `image-models.ts`, `visual-enhancer.ts`, `cinematic-components.ts`, `cinematic-presets.ts`

**LLM/Models:** `turbo-llm.ts`, `turbo-config.ts`, `model-detector.ts`, `context-router.ts`

**Skills System:** `skills/*.ts` (game-skill, image-skill, code-refiner, self-review, web-vision, skill-bridge, skill-factory-service, lead-to-asset-*), `skill-validation.ts`

**Infrastructure:** `prisma.ts`, `s3.ts`, `aws-config.ts`, `stripe.ts`, `google-oauth.ts`, `telegram.ts`, `hubspace.ts`, `github-deploy.ts`, `hostinger-deploy.ts`

**UI Context:** `i18n-context.tsx` (EN/ES), `theme-context.tsx`, `metrics-context.tsx`, `workspace-context.tsx`

### A.6 Implemented Features to Preserve

- **Anti-smoke system:** Bridge heartbeat pre-check (45s), real command polling (60s), honest reporting, pseudo-code skill validation → drafts.
- **Image→Browser chaining:** `{{last_image_url}}` placeholder auto-resolved in ai_task and template variables.
- **Plan gate:** feature limits per plan (starter/pro/business), daily email limits, admin bypass.
- **Growth engine:** campaigns, leads, outreach, batch approve with rate limiting, open rate tracking pixel.
- **Onboarding:** 5-step checklist from real DB data, tentacle health widget.
- **Turbo Mode:** OpenRouter integration for user-selected models.
- **Google SSO + Credentials auth.**
- **Stripe billing** (checkout, portal, webhooks, subscription management).
- **i18n** (English/Spanish) throughout the app.
- **Persistent OCTOPUS chat** with retry logic.

---

## APPENDIX B: FILE SUMMARIES (for developer reference)

Below are concise summaries of key files in the project, providing context on their purpose, recent changes, imports, exports, and dependencies.

### B.1 Database & Auth

**`prisma/schema.prisma`** — 86 models. Recent additions: `tabId` on BrowserCommand (multi-tab), `ScheduledBrowserTask` model. Relations to User and BrowserTemplate.

**`lib/prisma.ts`** — PrismaClient with benign error filtering (idle-session timeout 57P05), `withDbRetry` for transparent reconnections. Exports: `prisma`, `withDbRetry`.

**`lib/auth.ts`** — NextAuth config: Google SSO + Credentials. JWT/session callbacks propagate email. PrismaAdapter. Exports: `authOptions`.

**`app/api/auth/[...nextauth]/route.ts`** — NextAuth handlers.

**`app/api/signup/route.ts`** — User registration with optional Pro trial promo (date-windowed) and Brazos unlimited promo.

### B.2 Core UI

**`app/layout.tsx`** — Root layout: fonts, metadata, JSON-LD schemas (SoftwareApplication, Organization, Product), SessionProvider, Analytics.

**`app/(dashboard)/layout.tsx`** — Dashboard layout: Sidebar, Header, MetricsProvider, WorkspaceContext, lazy-loaded RouteLightSweep, OctoGuideBubble, BrazosHealthMonitor, SchedulerMonitor, PlanLimitToast, OnboardingTour.

**`components/layout/sidebar.tsx`** — Main navigation. Uses `isAdminEmail` from client-safe `admin-email.ts`. Plan-aware, i18n-enabled.

**`components/layout/header.tsx`** — Dashboard header: metrics, theme toggle, language, workspace selector, Turbo Mode badge, user profile. Horizontal scroll for overflow.

**`components/ui/button.tsx`** — 4 variants (primary/secondary/outline/ghost), 3 sizes, Framer Motion animations.

### B.3 Dashboard & Pages

**`app/(dashboard)/dashboard/page.tsx`** — Main dashboard: KPI cards, GettingStartedChecklist, TentacleHealthWidget, MegaSkillLauncher.

**`app/(dashboard)/dashboard/jarvis/page.tsx`** — OCTOPUS chat (~4500 lines). Voice input/output, multi-step actions, browser command polling, image generation, creative chaining, tool execution, activity log.

**`app/(dashboard)/dashboard/project-builder/page.tsx`** — Project Foundry: multi-step wizard, live AI preview with streaming, dual-engine (Claude/Abacus), industry templates.

### B.4 Key Libraries

**`lib/octopus-personality.ts`** — 25 personality modules defining OCTOPUS’s behavior per domain. Includes grounding rules (anti-smoke), chaining instructions, honesty rules.

**`lib/octopus-tools.ts`** — Tool definitions: creative (generate_image/video), browser (ai_task, run_template), system (navigate, create_skill, create_agent, create_mcp), social, IoT, growth, knowledge, voice, web_search.

**`lib/octopus-tool-executor.ts`** — Execution engine: routes tools to specialized executors. Bridge pre-check (getBridgeStatus, 45s heartbeat). Skill validation (assessSkillCode). create_skill with draft detection.

**`lib/skill-validation.ts`** — `assessSkillCode(code)`: detects pseudo-code (browser.click, page.*, puppeteer/playwright/selenium patterns). Returns `{executable, reason}`.

**`lib/metrics-context.tsx`** — React context: real-time metrics, activity logs, Turbo Mode state (enabled/provider/model).

**`lib/i18n-context.tsx`** — Internationalization context: English and Spanish. Used across all UI components.

**`lib/plan-gate.ts`** — Plan-based feature gating. Checks usage vs. limits. Admin bypass for `1billontopview@gmail.com`.

**`lib/turbo-llm.ts`** — Centralized LLM caller with Turbo Mode (OpenRouter) support. `callLLM(userId, messages, options)`.

### B.5 Connections & Integrations

**`lib/brazos-types.ts`** — TypeScript types for Arms and Browser Automation commands. Supports multi-tab and recorder modes.

**`app/api/brazos/route.ts`** — CRUD for arm connections with plan gate enforcement.

**`app/(dashboard)/dashboard/brazos/page.tsx`** — Arms management UI with icon mapping for all arm types.

**`lib/telegram.ts`** — Telegram Bot integration.

**`lib/hubspace.ts`** — HubSpace smart home integration.

**`lib/google-oauth.ts`** — Google Workspace OAuth flows.

### B.6 Environment Variables (configured)

ABACUSAI_API_KEY, DATABASE_URL, NEXTAUTH_SECRET, GOOGLE_CLIENT_ID/SECRET, GOOGLE_WORKSPACE_CLIENT_ID/SECRET, GOOGLE_CLOUD_API_KEY, GOOGLE_GEMINI_API_KEY, LINKEDIN_CLIENT_ID/SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, NEXT_PUBLIC_GA_ID, FAL_KEY, AWS_BUCKET_NAME/REGION/FOLDER_PREFIX, CRON_SECRET, BLOG_INGEST_KEY, VPS_CERT_API_KEY/URL, WEB_APP_ID, + 10 NOTIF_ID_* variables for email notifications.

---

*End of manifest. This document is the source of truth for Rafael’s vision for "the new face of OCTOPUS".*
