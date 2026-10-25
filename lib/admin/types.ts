// ---------------------------------------------------------------------------
// DTO types returned by the API routes. These mirror the ACTUAL personas
// table schema (id, avatar_id, type, name, prompt, qna_model, creativity,
// status, version, role_title, department, gender, created_at, updated_at)
// - expertise/formality/empathy/humour/confidence/forbidden_topics/
// escalation_instructions were removed on 2026-07-30: they were referenced
// by toPersonaDTO() and several UI components but never actually existed
// as columns (select("*") silently returned undefined for all of them,
// and the PATCH route never persisted them either) or added value. Anything
// that previously depended on them (systemPrompt.ts's tone paragraph,
// PersonaEditor.tsx's sliders/guardrails cards, the wizard's tone step) has
// been simplified accordingly - see each file for details.
// ---------------------------------------------------------------------------

export type OwnerType = "Organisation" | "Individual";
export type BodyType = "Full body" | "Half body" | "Head only";
export type PublishState = "Private" | "Public" | "Archived";
export type QnaModel = "Claude Opus" | "Claude Sonnet" | "Claude Haiku";
export type PersonaGender = "female" | "male";
export type KnowledgeStatus = "Indexed" | "Processing" | "Error";
export type ConversationStatus = "Active" | "Resolved" | "Escalated";
export type ConversationType = "Voice" | "Text";
export type TestType = "Scenario" | "Regression" | "Smoke";
export type TestStatus = "Pass" | "Running" | "Review" | "Fail";
import type { UserRole, UserStatus } from "@/lib/auth/roles";
export type { UserRole, UserStatus };

export type Avatar = {
  id: string;
  name: string;
  imageUrl: string | null;
  // LivePortrait-animated avatar video, generated once at creation time —
  // see app/api/admin/avatars/create-video/route.ts and
  // supabase/migrations/0005_avatar_video_url.sql. Null until an admin
  // uploads a source video in the wizard's Basics step.
  videoUrl: string | null;
  owner: string;
  ownerType: OwnerType;
  bodyType: BodyType;
  status: PublishState;
  createdAt: string;
  updatedAt: string;
};

export type Persona = {
  id: string;
  avatarId: string | null;
  type: string;
  name: string;
  prompt: string;
  qnaModel: QnaModel;
  creativity: number;
  status: PublishState;
  version: string;
  roleTitle: string;
  department: string;
  /** Drives TTS voice selection - see app/api/conversations/route.ts (maps to an OpenAI TTS voice name) and supabase/migrations/0004_persona_gender.sql. */
  gender: PersonaGender;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeFile = {
  id: string;
  name: string;
  sizeBytes: number;
  storagePath: string | null;
  sourceUrl: string | null;
  createdAt: string;
};

export type KnowledgeSource = {
  id: string;
  name: string;
  description: string;
  status: KnowledgeStatus;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AvatarCombination = {
  id: string;
  avatarId: string;
  personaId: string;
  knowledgeSourceIds: string[];
};

export type ResolvedCombination = {
  id: string;
  avatar: Avatar;
  persona: Persona;
  knowledgeSources: KnowledgeSource[];
};

export type Conversation = {
  id: string;
  name: string;
  isPublic: boolean;
  status: ConversationStatus;
  personalAvatarRequest: boolean;
  activeAvatarId: string | null;
  personaId: string | null;
  conversationType: ConversationType;
  language: string;
  creatorUser: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TestCase = {
  id: string;
  name: string;
  conversationId: string | null;
  type: TestType;
  totalQuestions: number;
  status: TestStatus;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Row shapes as they come back from Supabase (snake_case).
// ---------------------------------------------------------------------------

export type AvatarRow = {
  id: string;
  name: string;
  image_url: string | null;
  video_url: string | null;
  owner: string;
  owner_type: OwnerType;
  body_type: BodyType;
  status: PublishState;
  created_at: string;
  updated_at: string;
};

export type PersonaRow = {
  id: string;
  avatar_id: string | null;
  type: string;
  name: string;
  prompt: string;
  qna_model: QnaModel;
  creativity: number;
  status: PublishState;
  version: string;
  role_title: string;
  department: string;
  gender: PersonaGender;
  created_at: string;
  updated_at: string;
};

export type KnowledgeSourceRow = {
  id: string;
  name: string;
  description: string;
  status: KnowledgeStatus;
  created_at: string;
  updated_at: string;
};

export type KnowledgeFileRow = {
  id: string;
  knowledge_source_id: string;
  name: string;
  size_bytes: number;
  storage_path: string | null;
  source_url: string | null;
  created_at: string;
};

export type AvatarCombinationRow = {
  id: string;
  avatar_id: string;
  persona_id: string;
  knowledge_source_ids: string[];
};

export type ConversationRow = {
  id: string;
  name: string;
  is_public: boolean;
  status: ConversationStatus;
  personal_avatar_request: boolean;
  active_avatar_id: string | null;
  persona_id: string | null;
  conversation_type: ConversationType;
  language: string;
  creator_user: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

export type UserRow = {
  id: string;
  email: string;
  full_name: string;
  department: string;
  role: UserRole;
  status: UserStatus;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TestRow = {
  id: string;
  name: string;
  conversation_id: string | null;
  type: TestType;
  total_questions: number;
  status: TestStatus;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

export function toAvatarDTO(row: AvatarRow): Avatar {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    owner: row.owner,
    ownerType: row.owner_type,
    bodyType: row.body_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPersonaDTO(row: PersonaRow): Persona {
  return {
    id: row.id,
    avatarId: row.avatar_id,
    type: row.type,
    name: row.name,
    prompt: row.prompt,
    qnaModel: row.qna_model,
    creativity: row.creativity,
    status: row.status,
    version: row.version,
    roleTitle: row.role_title,
    department: row.department,
    gender: row.gender,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toKnowledgeSourceDTO(row: KnowledgeSourceRow, fileCount: number): KnowledgeSource {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    fileCount,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const KNOWLEDGE_SOURCE_WITH_COUNT_SELECT = "*, knowledge_files(count)";

export type KnowledgeSourceRowWithCount = KnowledgeSourceRow & { knowledge_files: { count: number }[] };

export function toKnowledgeSourceDTOFromJoin(row: KnowledgeSourceRowWithCount): KnowledgeSource {
  return toKnowledgeSourceDTO(row, row.knowledge_files?.[0]?.count ?? 0);
}

export function toKnowledgeFileDTO(row: KnowledgeFileRow): KnowledgeFile {
  return {
    id: row.id,
    name: row.name,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
  };
}

export function toConversationDTO(row: ConversationRow): Conversation {
  return {
    id: row.id,
    name: row.name,
    isPublic: row.is_public,
    status: row.status,
    personalAvatarRequest: row.personal_avatar_request,
    activeAvatarId: row.active_avatar_id,
    personaId: row.persona_id,
    conversationType: row.conversation_type,
    language: row.language,
    creatorUser: row.creator_user,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
  };
}

export function toTestDTO(row: TestRow): TestCase {
  return {
    id: row.id,
    name: row.name,
    conversationId: row.conversation_id,
    type: row.type,
    totalQuestions: row.total_questions,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function toUserDTO(row: UserRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    department: row.department,
    role: row.role,
    status: row.status,
    lastSignInAt: row.last_sign_in_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
