-- supabase/migrations/0001_init.sql
-- Consolidated baseline schema for the Avatar Chatbot platform.
-- Supersedes all previous incremental migrations (0001-0005) - this is the
-- single source of truth for a fresh database. Run this once on an empty
-- Supabase project.
--
-- Order matters: tables are created in dependency order (referenced tables
-- before the tables that FK to them).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- gen_random_uuid() - used as the default for every table's `id` column.
create extension if not exists pgcrypto;

-- vector type - used by knowledge_chunks.embedding for similarity search
-- (see lib/ingestion/retrieve.ts). 512 dimensions matches
-- AZURE_OPENAI_EMBEDDING_DIMENSIONS / azure.text-embedding-3-small's
-- configured output size (see lib/ingestion/embed.ts) - adjust the
-- dimension below if that env var is ever changed.
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Used by public.profiles.role. Referenced as "USER-DEFINED" in Supabase's
-- schema export - this is the actual type definition.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('employee', 'admin');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- avatars
-- ---------------------------------------------------------------------------

create table public.avatars (
  id uuid not null default gen_random_uuid(),
  name text not null,
  image_url text,
  owner text not null,
  owner_type text not null check (owner_type = any (array['Organisation'::text, 'Individual'::text])),
  body_type text not null check (body_type = any (array['Full body'::text, 'Half body'::text, 'Head only'::text])),
  status text not null default 'Private'::text check (status = any (array['Private'::text, 'Public'::text, 'Archived'::text])),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint avatars_pkey primary key (id)
);

-- ---------------------------------------------------------------------------
-- personas
-- ---------------------------------------------------------------------------

create table public.personas (
  id uuid not null default gen_random_uuid(),
  avatar_id uuid,
  type text not null default ''::text,
  name text not null,
  prompt text not null default ''::text,
  qna_model text not null default 'Claude Sonnet'::text
    check (qna_model = any (array['Claude Opus'::text, 'Claude Sonnet'::text, 'Claude Haiku'::text])),
  creativity integer not null default 35 check (creativity >= 0 and creativity <= 100),
  status text not null default 'Private'::text check (status = any (array['Private'::text, 'Public'::text, 'Archived'::text])),
  version text not null default 'v1.0'::text,
  role_title text not null default ''::text,
  department text not null default ''::text,
  -- Drives TTS voice selection - see app/api/conversations/route.ts (maps
  -- to "nova"/"onyx") and lib/llm/ttsClient.ts.
  gender text not null default 'female'::text check (gender = any (array['female'::text, 'male'::text])),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint personas_pkey primary key (id),
  constraint personas_avatar_id_fkey foreign key (avatar_id) references public.avatars(id)
);

-- ---------------------------------------------------------------------------
-- knowledge_sources
-- ---------------------------------------------------------------------------

create table public.knowledge_sources (
  id uuid not null default gen_random_uuid(),
  name text not null,
  description text not null default ''::text,
  status text not null default 'Processing'::text check (status = any (array['Indexed'::text, 'Processing'::text, 'Error'::text])),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint knowledge_sources_pkey primary key (id)
);

-- ---------------------------------------------------------------------------
-- knowledge_files
-- ---------------------------------------------------------------------------

create table public.knowledge_files (
  id uuid not null default gen_random_uuid(),
  knowledge_source_id uuid not null,
  name text not null,
  size_bytes bigint not null default 0,
  storage_path text,
  created_at timestamp with time zone not null default now(),
  source_url text,
  constraint knowledge_files_pkey primary key (id),
  constraint knowledge_files_knowledge_source_id_fkey foreign key (knowledge_source_id) references public.knowledge_sources(id)
);

-- ---------------------------------------------------------------------------
-- avatar_combinations
-- ---------------------------------------------------------------------------

create table public.avatar_combinations (
  id uuid not null default gen_random_uuid(),
  avatar_id uuid not null,
  persona_id uuid not null,
  knowledge_source_ids uuid[] not null default '{}'::uuid[],
  created_at timestamp with time zone not null default now(),
  constraint avatar_combinations_pkey primary key (id),
  constraint avatar_combinations_avatar_id_fkey foreign key (avatar_id) references public.avatars(id),
  constraint avatar_combinations_persona_id_fkey foreign key (persona_id) references public.personas(id)
);

-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid not null default gen_random_uuid(),
  name text not null,
  is_public boolean not null default false,
  status text not null default 'Active'::text check (status = any (array['Active'::text, 'Resolved'::text, 'Escalated'::text])),
  personal_avatar_request boolean not null default false,
  active_avatar_id uuid,
  persona_id uuid,
  conversation_type text not null default 'Voice'::text check (conversation_type = any (array['Voice'::text, 'Text'::text])),
  language text not null default 'English'::text,
  creator_user text not null default 'anonymous'::text,
  started_at timestamp with time zone not null default now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  combination_id uuid,
  constraint conversations_pkey primary key (id),
  constraint conversations_active_avatar_id_fkey foreign key (active_avatar_id) references public.avatars(id),
  constraint conversations_persona_id_fkey foreign key (persona_id) references public.personas(id),
  constraint conversations_combination_id_fkey foreign key (combination_id) references public.avatar_combinations(id)
);

-- ---------------------------------------------------------------------------
-- tests
-- ---------------------------------------------------------------------------

create table public.tests (
  id uuid not null default gen_random_uuid(),
  name text not null,
  conversation_id uuid,
  type text not null check (type = any (array['Scenario'::text, 'Regression'::text, 'Smoke'::text])),
  total_questions integer not null default 0,
  status text not null default 'Running'::text check (status = any (array['Pass'::text, 'Running'::text, 'Review'::text, 'Fail'::text])),
  created_at timestamp with time zone not null default now(),
  constraint tests_pkey primary key (id),
  constraint tests_conversation_id_fkey foreign key (conversation_id) references public.conversations(id)
);

-- ---------------------------------------------------------------------------
-- profiles (links to Supabase auth.users)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid not null,
  email text not null,
  role user_role not null default 'employee'::user_role,
  created_at timestamp with time zone not null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_id_fkey foreign key (id) references auth.users(id)
);

-- ---------------------------------------------------------------------------
-- knowledge_chunks (RAG vector store)
-- ---------------------------------------------------------------------------

create table public.knowledge_chunks (
  id uuid not null default gen_random_uuid(),
  knowledge_source_id uuid not null,
  knowledge_file_id uuid not null,
  chunk_index integer not null,
  content text not null,
  -- Dimension must match AZURE_OPENAI_EMBEDDING_DIMENSIONS (see
  -- lib/ingestion/embed.ts) - default is 512 for azure.text-embedding-3-small.
  embedding vector(512) not null,
  created_at timestamp with time zone not null default now(),
  constraint knowledge_chunks_pkey primary key (id),
  constraint knowledge_chunks_knowledge_source_id_fkey foreign key (knowledge_source_id) references public.knowledge_sources(id),
  constraint knowledge_chunks_knowledge_file_id_fkey foreign key (knowledge_file_id) references public.knowledge_files(id)
);

-- Vector similarity index - without this, searchKnowledgeChunks()
-- (lib/ingestion/retrieve.ts) does a full sequential scan per query, which
-- gets slow as knowledge_chunks grows. ivfflat is a good default for
-- moderate-sized collections; switch to hnsw if pgvector version supports
-- it and recall/latency tuning is needed later.
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ---------------------------------------------------------------------------
-- conversation_messages (per-turn transcript log)
-- ---------------------------------------------------------------------------

create table public.conversation_messages (
  id uuid not null default gen_random_uuid(),
  conversation_id uuid not null,
  role text not null check (role = any (array['user'::text, 'assistant'::text])),
  content text not null,
  created_at timestamp with time zone not null default now(),
  constraint conversation_messages_pkey primary key (id),
  constraint conversation_messages_conversation_id_fkey foreign key (conversation_id) references public.conversations(id)
);

-- ---------------------------------------------------------------------------
-- Helpful indexes for common lookups (not in the original export, but
-- worth having from day one - foreign keys are NOT automatically indexed
-- in Postgres, and these columns are queried constantly by the app).
-- ---------------------------------------------------------------------------

create index personas_avatar_id_idx on public.personas(avatar_id);
create index avatar_combinations_avatar_id_idx on public.avatar_combinations(avatar_id);
create index avatar_combinations_persona_id_idx on public.avatar_combinations(persona_id);
create index conversations_persona_id_idx on public.conversations(persona_id);
create index conversations_combination_id_idx on public.conversations(combination_id);
create index conversation_messages_conversation_id_idx on public.conversation_messages(conversation_id);
create index knowledge_files_knowledge_source_id_idx on public.knowledge_files(knowledge_source_id);
create index knowledge_chunks_knowledge_source_id_idx on public.knowledge_chunks(knowledge_source_id);
create index knowledge_chunks_knowledge_file_id_idx on public.knowledge_chunks(knowledge_file_id);
