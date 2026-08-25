# Avatar Chatbot — PwC Internal Digital Human Platform

A Next.js application that lets employees have voice or text conversations
with AI-powered digital human avatars. Each avatar is backed by a
configurable persona (name, role, tone, voice, knowledge base) and a RAG
pipeline over internal documents. Admins build and publish avatars through a
step-by-step wizard; employees pick an avatar and talk to it via text or
voice.

---

## Tech Stack

| Layer                | Technology                                                |
|----------------------|------------------------------------------------------------|
| Framework            | Next.js 16 (App Router, Route Handlers)                    |
| UI                   | React 19, Tailwind CSS 4, Framer Motion, Lucide icons       |
| Language             | TypeScript                                                  |
| Database             | Supabase (Postgres + pgvector)                              |
| Chat LLM             | Anthropic Claude — Opus / Sonnet / Haiku (via internal gateway, AWS Bedrock route) |
| Embeddings           | Azure OpenAI `text-embedding-3-small`                       |
| Speech-to-text       | Whisper (`openai.global.whisper-1`)                         |
| Text-to-speech       | `gpt-4o-mini-tts`                                           |
| LLM Gateway          | Internal PwC shared GenAI service (LiteLLM-based proxy)     |
| Document ingestion   | `pdf-parse`, `unpdf`, `mammoth` (.docx), `@mozilla/readability` + `jsdom` (web pages) |
| Realtime transport   | `ws` (used internally by the ingestion/utility layer)       |

---

## Requirements

- **Node.js 20+**
- **npm** (or a compatible package manager)
- A **Supabase** project (Postgres with the `pgvector` extension available)
- An API key for the internal PwC GenAI gateway, with access to:
  - Chat completions (Anthropic Claude models via Bedrock route)
  - Embeddings (Azure OpenAI)
  - Audio transcription (Whisper)
  - Audio speech / TTS (`gpt-4o-mini-tts`)

---

## Project Structure

```
avatar-chatbot/
├── app/                               # Next.js App Router
│   ├── layout.tsx, page.tsx, globals.css
│   ├── select-role/page.tsx           # Role selection screen
│   ├── experience/page.tsx            # Avatar picker screen
│   ├── conversation/page.tsx          # Live conversation screen (voice/text)
│   │
│   ├── admin/                         # Admin dashboard
│   │   ├── page.tsx, layout.tsx
│   │   ├── avatars/                   # Avatar list + creation wizard
│   │   │   ├── page.tsx, new/page.tsx, add/page.tsx
│   │   │   └── [avatarId]/page.tsx
│   │   ├── personas/                  # Persona list + editor
│   │   │   ├── page.tsx
│   │   │   └── [personaId]/page.tsx
│   │   ├── knowledge/                 # Knowledge source management
│   │   │   ├── page.tsx
│   │   │   └── [knowledgeId]/page.tsx
│   │   ├── combinations/[id]/page.tsx
│   │   ├── conversations/page.tsx     # Conversation history/logs
│   │   ├── testing/page.tsx
│   │   └── settings/page.tsx
│   │
│   └── api/                           # Route Handlers
│       ├── chat/route.ts              # RAG + LLM streaming endpoint (SSE)
│       ├── tts/route.ts               # Text-to-speech endpoint
│       ├── conversations/
│       │   ├── route.ts               # Create a conversation session
│       │   └── [id]/
│       │       ├── end/route.ts
│       │       └── messages/route.ts
│       ├── experience/combinations/route.ts
│       └── admin/
│           ├── avatars/
│           │   ├── route.ts, [id]/route.ts
│           │   └── publish/route.ts   # Wizard "Publish" action
│           ├── personas/
│           │   ├── route.ts
│           │   └── [id]/route.ts
│           ├── knowledge/
│           │   ├── route.ts
│           │   └── [id]/
│           │       ├── route.ts, urls/route.ts, ingest/route.ts
│           │       └── files/route.ts, files/[fileId]/route.ts
│           ├── combinations/
│           │   ├── route.ts, [id]/route.ts
│           ├── conversations/route.ts
│           └── tests/route.ts
│
├── components/
│   ├── chat/ConversationChat.tsx      # Wires STT + chat stream + TTS together
│   ├── voice/VoiceConversationScreen.tsx  # Voice UI (mic, transcript, avatar video)
│   ├── admin/
│   │   ├── AdminSidebar.tsx, AdminCard.tsx, AdminPageHeader.tsx, nav-config.ts
│   │   ├── avatar-wizard/
│   │   │   ├── AvatarWizard.tsx, WizardStepper.tsx, wizard-types.ts
│   │   │   └── steps/
│   │   │       ├── StepAvatar.tsx, StepPersona.tsx, PersonaFieldsForm.tsx
│   │   │       ├── StepKnowledge.tsx, StepTest.tsx
│   │   ├── persona/PersonaEditor.tsx
│   │   ├── knowledge/KnowledgeFolderCard.tsx, KnowledgeFolderModal.tsx
│   │   └── table/Table.tsx, ActionsMenu.tsx
│   └── home/
│       ├── Hero.tsx, Navbar.tsx, Footer.tsx, AvatarPicker.tsx, FeaturesSection.tsx
│       └── intro/                     # Animated landing intro sequence
│           ├── IntroSequence.tsx, SceneReception.tsx, SceneEntrance.tsx
│           ├── SceneExterior.tsx, SceneAvatar.tsx, FloatingParticles.tsx
│
├── hooks/
│   ├── useChatStream.ts               # Consumes /api/chat SSE stream
│   ├── useSpeechToText.ts             # Browser mic capture (Web Speech API)
│   └── useTextToSpeech.ts             # Calls /api/tts, plays back audio
│
├── lib/
│   ├── admin/
│   │   ├── types.ts                   # DTO + Supabase row types + mappers
│   │   ├── api-utils.ts               # badRequest/notFound/serverError/asRecord
│   │   └── mock-data.ts               # Static picklists (QNA_MODELS, etc.)
│   │
│   ├── llm/
│   │   ├── chatClient.ts              # Streams Chat Completions (SSE)
│   │   ├── sttClient.ts               # Whisper transcription client
│   │   ├── ttsClient.ts               # gpt-4o-mini-tts synthesis client
│   │   ├── models.ts                  # Persona tier -> real model ID mapping
│   │   ├── systemPrompt.ts            # Builds system prompt from persona + RAG context
│   │   ├── chatPipeline.ts            # retrieval -> prompt -> LLM -> logging -> SSE
│   │   ├── resolveContext.ts          # Resolves persona/avatar/knowledge from IDs
│   │   └── metrics.ts                 # Per-turn latency/token metrics
│   │
│   ├── ingestion/                     # RAG knowledge-base pipeline
│   │   ├── pipeline.ts                # fetch -> extract -> chunk -> embed -> store
│   │   ├── fetchUrl.ts, extract.ts, chunk.ts
│   │   ├── embed.ts                   # Azure OpenAI embeddings call
│   │   └── retrieve.ts                # pgvector similarity search
│   │
│   └── supabase/admin.ts              # Supabase service-role client
│
├── supabase/
│   └── migrations/
│       └── 0001_init.sql              # Full baseline schema (single source of truth)
│
├── public/                            # Static assets
├── .env.local                         # Local secrets (not committed)
├── next.config.ts, tsconfig.json, package.json
└── README.md
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# --- Internal GenAI Gateway ---
# Single endpoint + key used for chat, embeddings, STT, and TTS. The
# gateway routes by the `model` string in each request body.
AZURE_OPENAI_ENDPOINT=https://genai-sharedservice-emea.pwcinternal.com
AZURE_OPENAI_API_KEY=your-gateway-api-key

# --- Optional: override individual model tiers without touching code ---
# CHAT_MODEL_QUALITY=bedrock.anthropic.claude-opus-4-5
# CHAT_MODEL_BALANCED=bedrock.anthropic.claude-sonnet-4-5
# CHAT_MODEL_FAST=bedrock.anthropic.claude-haiku-4-5
# STT_MODEL=openai.global.whisper-1
# TTS_MODEL=openai.gpt-4o-mini-tts
# TTS_VOICE_FEMALE=nova
# TTS_VOICE_MALE=onyx

# --- Optional: embeddings tuning ---
# AZURE_OPENAI_EMBEDDING_MODEL=azure.text-embedding-3-small
# AZURE_OPENAI_EMBEDDING_DIMENSIONS=512
```

**Do not commit `.env.local`.**

---

## Models Used

| Purpose        | Model                                   | Notes                                      |
|-----------------|------------------------------------------|---------------------------------------------|
| Chat — Quality tier  | `bedrock.anthropic.claude-opus-4-5`   | Persona `qna_model = "Claude Opus"`         |
| Chat — Balanced tier | `bedrock.anthropic.claude-sonnet-4-5` | Persona `qna_model = "Claude Sonnet"` (default) |
| Chat — Fast tier     | `bedrock.anthropic.claude-haiku-4-5`  | Persona `qna_model = "Claude Haiku"`        |
| Embeddings           | `azure.text-embedding-3-small`        | 512 dimensions, used for RAG vector search  |
| Speech-to-text (STT) | `openai.global.whisper-1`             | Free tier on the gateway                    |
| Text-to-speech (TTS) | `openai.gpt-4o-mini-tts`              | Voice picked per persona: `nova` (female) / `onyx` (male) |

All models are routed through the internal GenAI gateway using a single
`AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` pair — the gateway
dispatches to the correct upstream provider (Azure, OpenAI, AWS Bedrock)
based on the `model` string sent in each request.

---

## Database Setup

The full schema lives in a single migration:

```
supabase/migrations/0001_init.sql
```

Run it once against a fresh Supabase project (SQL editor or CLI). It creates:

- `avatars` — avatar identity (name, image, owner, body type, publish status)
- `personas` — persona configuration (prompt, Q&A model tier, creativity,
  role/department, **gender** for TTS voice selection)
- `knowledge_sources` / `knowledge_files` / `knowledge_chunks` — RAG
  document storage and pgvector embeddings
- `avatar_combinations` — links an avatar + persona + set of knowledge
  sources into a publishable combination
- `conversations` / `conversation_messages` — session and transcript logging
- `tests` — test-run tracking (Scenario/Regression/Smoke)
- `profiles` — links to Supabase `auth.users`, with an `employee`/`admin`
  role enum

The migration also sets up required Postgres extensions (`pgcrypto` for
UUID generation, `vector` for embeddings), the `user_role` enum, and
indexes on every foreign key + the `ivfflat` vector index needed for
performant similarity search.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Apply the database schema (Supabase SQL editor or CLI)
#    Run supabase/migrations/0001_init.sql

# 3. Create .env.local (see Environment Variables above)

# 4. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build       # Production build
npm run start        # Run the production build
npm run lint          # Lint the codebase
npm run dev:https     # Dev server over HTTPS (needed for mic access on some setups)
```

---

## Core Flows

**Employee — talking to an avatar**
1. `/select-role` → `/experience` → pick an avatar → `/conversation`
2. `ConversationChat.tsx` starts a session (`POST /api/conversations`),
   which resolves the persona's `gender` into a TTS voice and returns
   avatar/persona display info.
3. Each turn: `useChatStream` streams a reply from `POST /api/chat`
   (RAG retrieval → system prompt → Claude → SSE deltas); `useTextToSpeech`
   sends the finished reply to `POST /api/tts` and plays back the audio.
4. Voice input (optional) is captured via `useSpeechToText` (browser Web
   Speech API) and sent as a normal chat message once finalized.

**Admin — building an avatar**
1. `/admin/avatars/new` launches the wizard (`AvatarWizard.tsx`).
2. Steps: avatar identity → persona (existing or new, incl. gender) →
   knowledge sources → live test chat (`StepTest.tsx`, calls `/api/chat`
   in preview mode with an in-memory persona draft).
3. Publishing (`POST /api/admin/avatars/publish`) creates the avatar,
   persona, knowledge source(s), and an `avatar_combinations` row in one
   transaction-like flow (with manual rollback on failure).

---

## RAG Pipeline

`lib/ingestion/pipeline.ts` handles turning uploaded files or URLs into
searchable knowledge:
1. **Fetch** — download the file or scrape the URL (`fetchUrl.ts`, using
   `@mozilla/readability` + `jsdom` for clean article extraction).
2. **Extract** — pull raw text from PDFs (`pdf-parse` / `unpdf`) or `.docx`
   files (`mammoth`).
3. **Chunk** — split into overlapping text chunks (`chunk.ts`).
4. **Embed** — call the gateway's embeddings endpoint (`embed.ts`).
5. **Store** — persist chunks + vectors into `knowledge_chunks`.

At chat time, `chatPipeline.ts` runs similarity search across every
knowledge source attached to the active persona in parallel, merges and
re-ranks the results, and injects the top matches into the system prompt
built by `systemPrompt.ts`.
