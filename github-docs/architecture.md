# Octopus AI — Architecture Document

## System Architecture

Octopus AI follows a **modular monolith** architecture where all modules share a common runtime but maintain clear boundaries through dedicated API routes, prompt contexts, and data models.

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                           │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Dashboard │ │Creative  │ │  Growth  │ │  Code    │      │
│  │  Views   │ │ Studio   │ │  Engine  │ │  Engine  │ ...  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       └────────────┬┴───────────┬┴────────────┘            │
│                    │            │                            │
│              ┌─────▼────────────▼─────┐                     │
│              │    OCTOPUS Chat UI     │                     │
│              │  (Unified Interface)    │                     │
│              └──────────┬────────────┘                     │
└─────────────────────────┼──────────────────────────────────┘
                          │ SSE (Streaming)
┌─────────────────────────┼──────────────────────────────────┐
│                   API Layer                                 │
│                         │                                   │
│              ┌──────────▼────────────┐                     │
│              │   /api/jarvis/chat    │                     │
│              │   (Main Chat Route)   │                     │
│              └──────────┬────────────┘                     │
│                         │                                   │
│    ┌────────────────────┼────────────────────┐             │
│    │                    │                    │              │
│    ▼                    ▼                    ▼              │
│ ┌────────┐    ┌─────────────┐    ┌──────────────┐         │
│ │Context │    │Global State │    │   Module      │         │
│ │Router  │    │  Builder    │    │   APIs        │         │
│ │        │    │(19 queries) │    │(/api/growth,  │         │
│ │Keyword │    │             │    │ /api/sales,   │         │
│ │matching│    │Builds full  │    │ /api/tasks,   │         │
│ │→ module│    │user context │    │ etc.)         │         │
│ │contexts│    │snapshot     │    │               │         │
│ └───┬────┘    └──────┬──────┘    └──────────────┘         │
│     │                │                                     │
│     └────────┬───────┘                                     │
│              │                                              │
│     ┌────────▼────────┐                                    │
│     │  Prompt Assembly │                                   │
│     │                  │                                    │
│     │  Layer 1: Core   │                                   │
│     │  Layer 2: Module │                                   │
│     │  Layer 3: Action │                                   │
│     │  + Global State  │                                   │
│     └────────┬─────────┘                                   │
│              │                                              │
│     ┌────────▼────────┐                                    │
│     │   LLM Provider   │                                   │
│     │  (Multi-model)   │                                   │
│     │  OpenAI/Claude/  │                                   │
│     │  Gemini          │                                   │
│     └──────────────────┘                                   │
└────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼──────────────────────────────────┐
│                   Data Layer                                │
│                         │                                   │
│  ┌──────────────────────▼──────────────────────┐           │
│  │              PostgreSQL (Prisma)             │           │
│  │                                              │           │
│  │  Users · Agents · Skills · MCPs · Arms      │           │
│  │  Leads · Campaigns · Sales Agents           │           │
│  │  Voice Agents · Blog Posts · Tasks          │           │
│  │  Workspace Index · Session Memory           │           │
│  │  IoT Devices · Invoices · Calendar          │           │
│  └──────────────────────────────────────────────┘           │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ AWS S3   │  │ Stripe   │  │ External │                 │
│  │ (Files)  │  │(Payments)│  │  APIs    │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## OCTOPUS Agent Flow

When a user sends a message, the following pipeline executes:

```
User Message
    │
    ▼
┌─────────────────┐
│ 1. Auth Check   │  Validate session, extract userId
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Global State │  buildGlobalState(userId)
│    Builder      │  ~19 parallel DB queries
│                 │  Returns: plan, arms, agents,
│                 │  campaigns, leads, IoT, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. Context      │  Analyze message keywords
│    Router       │  Select relevant modules
│                 │  Inject module contexts +
│                 │  companion modules
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 4. RAG 2.0+     │  5-layer retrieval:
│    Retrieval    │  - Conversation memory
│                 │  - Knowledge base docs
│                 │  - Vector embeddings
│                 │  - Graph relationships
│                 │  - Arms (live API data)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 5. Prompt       │  Assemble final prompt:
│    Assembly     │  Core + Modules + Actions
│                 │  + Global State + RAG context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 6. LLM Call     │  Stream response via SSE
│    (Streaming)  │  Multi-model support
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 7. Post-Process │  Parse action blocks
│                 │  Execute growth actions
│                 │  Update conversation memory
└─────────────────┘
```

## Code Engine Architecture

The Code Engine operates with a unique **Bridge** pattern:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│  Code Engine │ ──API── │   Backend    │ ──DB──  │   Octopus    │
│  (Browser)   │         │  Chat Route  │         │   Bridge     │
│              │         │              │         │ (Local App)  │
│  Editor UI   │         │  Claude LLM  │         │              │
│  Preview     │         │  File Cmds   │         │  Reads cmds  │
│  Git Panel   │         │  Git Ops     │         │  from DB     │
│  Dev Tools   │         │  Workspace   │         │  Writes to   │
│              │         │  Intelligence│         │  local FS    │
└──────────────┘         └──────────────┘         └──────────────┘
```

- **Session-based**: Each coding session has a unique ID tracking files and changes
- **Bridge Protocol**: Commands (write_file, execute_cmd) stored in DB, polled by Bridge app
- **Workspace Intelligence**: `WorkspaceIndex` model tracks all files, `FileChangeEvent` tracks changes
- **Template System**: 6 starter templates with category filtering and tech stack badges

## Integration Architecture (Brazos)

External integrations follow a consistent pattern:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  OCTOPUS    │     │  Arm API     │     │  External    │
│  Agent      │────▶│  Route       │────▶│  Service     │
│             │     │              │     │              │
│  Detects    │     │  /api/brazos │     │  GitHub API  │
│  intent     │     │  /[service]  │     │  Gmail API   │
│  from msg   │     │              │     │  Ollama      │
│             │     │  OAuth/Token │     │  etc.        │
│             │◀────│  handling    │◀────│              │
└─────────────┘     └──────────────┘     └──────────────┘
        │
        ▼
┌─────────────┐
│ ArmConnection│
│  (Database)  │
│              │
│  armType     │
│  credentials │
│  lastSeenAt  │
│  isActive    │
└──────────────┘
```

Each Brazo (Arm) is registered as an `ArmConnection` in the database with:
- **armType**: Service identifier (github, gmail, telegram, ollama, etc.)
- **Credentials**: Encrypted OAuth tokens or API keys
- **Status Tracking**: `lastSeenAt` for connection health monitoring

## Security Model

- **Authentication**: NextAuth.js with credential-based + OAuth providers
- **Authorization**: Session-based, all API routes validate `getServerSession(authOptions)`
- **Data Isolation**: All queries filtered by `userId` — users can only access their own data
- **Encryption**: AES-256 for sensitive data at rest, HTTPS for transit
- **API Keys**: Stored in environment variables, never exposed client-side
- **Rate Limiting**: Per-user limits based on subscription plan

## Blog Architecture

Two blog systems run within the platform:

1. **Octopus Blog** (octopuskills.com/blog)
   - Direct DB writes to `OctoBlogPost` table
   - Managed by MAGUI agent via `octopus_seo_publish` skill
   - Auto-publish cron at scheduled intervals
   - SEO-optimized with structured data, sitemap integration

2. **Wildverse Blog** (external)
   - Published via API to external endpoint
   - Managed by VERA agent via `wildverse_seo_publish` skill
   - Separate deployment with its own database

## Deployment

- **Production**: octopuskills.com (custom domain)
- **Build**: Standalone serverless output
- **Database**: Shared PostgreSQL instance (dev + prod)
- **CDN**: Static assets served via S3 + CloudFront
