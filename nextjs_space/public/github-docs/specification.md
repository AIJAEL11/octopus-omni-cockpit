# Octopus AI — Technical Specification

## Overview

Octopus AI is a multi-module autonomous platform for sales & marketing automation. This document details the technical capabilities, data formats, and integration protocols.

## Platform Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Framer Motion |
| Backend | API Routes (serverless functions) |
| Database | PostgreSQL with Prisma ORM |
| Authentication | NextAuth.js (credentials + OAuth) |
| AI Models | Multi-provider (OpenAI, Anthropic Claude, Google Gemini, ElevenLabs, Kling, Veo) |
| Real-Time | Server-Sent Events (streaming responses) |
| Storage | AWS S3 (cloud file storage) |
| Payments | Stripe (subscriptions + usage billing) |
| Deployment | Serverless (standalone build) |

## OCTOPUS Agent System

### Prompt Architecture

The OCTOPUS agent uses a **3-layer modular prompt system**:

1. **Core Personality (~3K tokens)** — Always injected. Defines identity, tone, capabilities, and behavioral rules.
2. **Module Contexts** — Selectively injected by the **Context Router** based on user intent. Each module (Growth Engine, Code Engine, etc.) has its own context block with specific instructions.
3. **Action Contexts** — Action examples and response templates for active modules.

### Context Router

The Context Router (`context-router.ts`) analyzes user messages via keyword matching and injects only relevant module contexts. Each module defines:
- **Signals**: Keywords that activate the module (e.g., "lead", "campaign", "prospecting" → Growth Engine)
- **Companions**: Related modules that are co-injected for cross-module workflows

### RAG 2.0+ (5-Layer Retrieval)

| Layer | Source | Purpose |
|-------|--------|---------|
| 1. Semantic Memory | Conversation history | Short-term context and user intent continuity |
| 2. Knowledge Base | User-uploaded documents | Domain-specific knowledge retrieval |
| 3. Vector Search | Embeddings store | Semantic similarity matching across all data |
| 4. Graph Context | Relationship mapping | Entity relationships and cross-module connections |
| 5. Arms (Brazos) | External integrations | Real-time data from GitHub, Gmail, APIs, etc. |

### Global State System

The `buildGlobalState(userId)` function executes ~19 parallel database queries to build a comprehensive snapshot:

- User plan + usage limits
- Connected Brazos (integrations) with configuration details
- Active voice agents, sales agents (with per-agent lead counts)
- IoT devices and their states
- Growth Engine campaigns with metrics
- Creative assets, social bridge connections
- Invoices, calendar events
- Knowledge base documents
- Subscription status

This state is always injected into the agent prompt, giving OCTOPUS real-time awareness of the user's entire workspace.

## Module Specifications

### Growth Engine

- **Lead Scoring**: AI-powered scoring based on engagement signals, profile completeness, and interaction history
- **Campaign Types**: Email sequences, social outreach, ad campaigns, content funnels
- **Prospecting**: Automated lead discovery with filtering by industry, location, company size
- **Actions**: `create_campaign`, `assign_leads_to_campaign`, `generate_prospects`, `lead_scoring`

### Code Engine

- **AI Model**: Claude Sonnet 4.6 (default), supports model selection
- **Bridge System**: Octopus Bridge — local desktop app that syncs files between the platform and user's machine
- **Templates**: 6 built-in (3 Frontend: SaaS Dark, Portfolio, E-commerce; 3 Full-Stack: SaaS Dashboard, Blog CMS, CRM Pipeline)
- **Deploy Targets**: GitHub, Vercel, Netlify, Railway, Hostinger, Octopus Pages, ZIP export
- **Features**: Real-time preview (iframe with Babel transpilation), Git integration (push/pull/branches/commits), AI code review (score 0-100), workspace intelligence (file tracking in DB)
- **Prompt System**: 17 sections (§1-§17) with dynamic schema injection from Prisma models

### Creative Studio

- **Asset Types**: Images (DALL-E, Flux), Videos (Veo 3.1, Kling, Seedance), Audio (ElevenLabs TTS), Documents (PDF generation)
- **Lead-to-Asset Pipeline**: Automatically generates personalized assets per lead (video with name, company, custom messaging)
- **UGC Factory**: AI-generated user-generated content style videos

### Sales Agent

- **Embeddable**: JavaScript widget for any website
- **Customizable**: Custom personality, knowledge base, appearance
- **Lead Capture**: Real-time form collection during conversations
- **Analytics**: Conversation metrics, conversion tracking

### Voice Agent

- **TTS Providers**: ElevenLabs (premium voices), browser TTS (fallback)
- **STT**: Real-time speech-to-text
- **Storage**: Database-backed (VoiceAgent model with full CRUD)
- **Integration**: Works with Sales Agent for voice-enabled chat

## Integration Protocols (Brazos)

### GitHub Integration

- **Auth**: OAuth (personal access token)
- **Capabilities**: Push/Pull repos, list/create/merge branches, list commits, AI code review
- **API**: Git Trees API (recursive), capped at 200 files, 500KB per file

### Gmail Integration

- **Auth**: OAuth 2.0 (scope: gmail.send, gmail.readonly)
- **Actions**: `list_emails`, `get_message`, `send_email`, `create_draft`, `reply`, `search`
- **Safety**: OCTOPUS confirms with user before sending; drafts as fallback

### Ollama Integration

- **Protocol**: HTTP API to local Ollama instance
- **Models**: Llama 3, Mistral, DeepSeek, and any Ollama-supported model
- **Use Case**: Private/local AI processing without cloud dependency

## Data Models

Key database entities:

- **User** — Authentication, plan, preferences
- **ArmConnection** — External service connections (type, credentials, status)
- **CustomAgent** — User-created AI agents (name, personality, model, category)
- **CustomSkill** — User-created reusable AI skills
- **CustomMcp** — User-configured MCP (Model Context Protocol) servers
- **VoiceAgent** — Voice agent configurations
- **SalesAgent** — Sales agent configurations with lead tracking
- **OctoBlogPost** — Blog articles with SEO metadata
- **TaskItem** — Task management items
- **WorkspaceIndex** — Code Engine file tracking
- **SessionMemory** — Cross-session context for Code Engine

## API Structure

```
/api/
├── jarvis/
│   ├── chat/          # Main OCTOPUS chat endpoint (streaming)
│   └── web-search/    # Web search with grounding
├── brazos/
│   ├── google/        # Gmail, Calendar, Drive
│   └── [service]/     # Other integration endpoints
├── agent-factory/
│   └── agents/        # CRUD for custom agents
├── skill-factory/
│   └── skills/        # CRUD for custom skills
├── mcp-factory/
│   └── servers/       # CRUD for MCP servers
├── voice-agent/       # CRUD for voice agents
├── sales-agent/       # CRUD for sales agents
├── growth/            # Growth engine campaigns & leads
├── tasks/             # Task management
├── blog/              # Blog articles
└── arms/
    └── claude-code/   # Code Engine (chat, GitHub, workspace, review)
```

## Internationalization

- **Supported Languages**: Spanish (es), English (en)
- **Implementation**: Client-side locale detection + i18n dictionary
- **Coverage**: All UI elements, agent responses, error messages, metadata
