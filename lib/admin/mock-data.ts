import type { BadgeTone } from "@/components/admin/table/Table";



// TODO: once Supabase is wired up, these fetch functions (or the arrays
// directly) are the only place that needs to change — every consumer below
// already reads through this file.
// ---------------------------------------------------------------------------

export const PUBLISH_STATES = ["Private", "Public", "Archived"] as const;
export type PublishState = (typeof PUBLISH_STATES)[number];

export function publishTone(status: PublishState): BadgeTone {
  if (status === "Public") return "success";
  if (status === "Private") return "neutral";
  return "danger"; // Archived
}
// ---------------------------------------------------------------------------
// Avatars — fields: image / name / owner / owner type / body type / status
// ---------------------------------------------------------------------------

export const OWNER_TYPES = ["Organisation", "Individual"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const BODY_TYPES = ["Full body", "Half body", "Head only"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export type Avatar = {
  id: string;
  name: string;
  imageUrl: string | null;
  owner: string;
  ownerType: OwnerType;
  bodyType: BodyType;
  status: PublishState;
};

export const avatars: Avatar[] = [
  {
    id: "Sarra",
    name: "Sarra",
    imageUrl: null,
    owner: "Eya Latiri",
    ownerType: "Organisation",
    bodyType: "Half body",
    status: "Published",
  },
];

// ---------------------------------------------------------------------------
// Personas — fields: type / name / prompt / Q&A model / creativity / status
// / version (actions come from the shared "standard" ActionsMenu preset)
// ---------------------------------------------------------------------------

export const QNA_MODELS = ["Claude Opus", "Claude Sonnet", "Claude Haiku"] as const;
export type QnaModel = (typeof QNA_MODELS)[number];

export type Persona = {
  id: string;
  avatarId: string;
  type: string;
  name: string;
  prompt: string;
  qnaModel: QnaModel;
  creativity: number; // 0-100
  status: PublishState;
  version: string;
};

export const personas: Persona[] = [
  {
    id: "Sarra",
    avatarId: "Sarra",
    type: "HR assistant",
    name: "Sarra",
    prompt:
      "You are Sarra, a senior HR advisor for PwC Tunisia. Answer employee questions about leave, benefits, onboarding and payroll with a warm, professional tone.",
    qnaModel: "Claude Sonnet",
    creativity: 35,
    status: "Published",
    version: "v1.2",
  },
];

// ---------------------------------------------------------------------------
// Knowledge sources — fields: name / file count / status / description
// (actions use the smaller "knowledge" ActionsMenu preset)
// ---------------------------------------------------------------------------

export const KNOWLEDGE_STATES = ["Indexed", "Processing", "Error"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATES)[number];

export type KnowledgeSource = {
  id: string;
  name: string;
  fileCount: number;
  status: KnowledgeStatus;
  description: string;
};

export function knowledgeTone(status: KnowledgeStatus): BadgeTone {
  if (status === "Indexed") return "success";
  if (status === "Processing") return "warning";
  return "danger"; // Error
}

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "hr-policies",
    name: "HR policies",
    fileCount: 412,
    status: "Indexed",
    description: "Leave, onboarding, payroll and conduct policy documents.",
  },
  {
    id: "benefits",
    name: "Benefits",
    fileCount: 208,
    status: "Indexed",
    description: "Health insurance, retirement plans, and perks documentation.",
  },
  {
    id: "it-manuals",
    name: "IT manuals",
    fileCount: 156,
    status: "Processing",
    description: "Hardware, software, and access-request how-to guides.",
  },
  {
    id: "faqs",
    name: "FAQs",
    fileCount: 318,
    status: "Indexed",
    description: "Frequently asked questions across all departments.",
  },
  {
    id: "compliance",
    name: "Compliance",
    fileCount: 110,
    status: "Indexed",
    description: "Regulatory, ethics, and conduct compliance material.",
  },
];

// ---------------------------------------------------------------------------
// Conversations — fields: name / public / status / personal avatar request /
// active avatar / persona name / conversation type / language / creator user
// ---------------------------------------------------------------------------

export const CONVERSATION_STATES = ["Active", "Resolved", "Escalated"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATES)[number];

export const CONVERSATION_TYPES = ["Voice", "Text"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export type Conversation = {
  id: string;
  name: string;
  isPublic: boolean;
  status: ConversationStatus;
  personalAvatarRequest: boolean;
  activeAvatar: string;
  personaName: string;
  conversationType: ConversationType;
  language: string;
  creatorUser: string;
};

export function conversationTone(status: ConversationStatus): BadgeTone {
  if (status === "Active") return "success";
  if (status === "Resolved") return "neutral";
  return "danger"; // Escalated
}

export const conversations: Conversation[] = [
  {
    id: "conv-1",
    name: "Daniel — parental leave",
    isPublic: false,
    status: "Resolved",
    personalAvatarRequest: false,
    activeAvatar: "Sarra",
    personaName: "Sarra",
    conversationType: "Voice",
    language: "English",
    creatorUser: "Daniel",
  },
];

// ---------------------------------------------------------------------------
// Tests — fields: name / conversation / created (GMT+1) / type / total
// questions / status
// ---------------------------------------------------------------------------

export const TEST_TYPES = ["Scenario", "Regression", "Smoke"] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const TEST_STATES = ["Pass", "Running", "Review", "Fail"] as const;
export type TestStatus = (typeof TEST_STATES)[number];

export type TestCase = {
  id: string;
  name: string;
  conversation: string;
  createdAt: string; // ISO timestamp, rendered via formatTunisTime()
  type: TestType;
  totalQuestions: number;
  status: TestStatus;
};

export function testTone(status: TestStatus): BadgeTone {
  if (status === "Pass") return "success";
  if (status === "Running") return "warning";
  return "danger"; // Review / Fail
}

export const tests: TestCase[] = [
  {
    id: "test-1",
    name: "Sensitive topic deflection",
    conversation: "Daniel — parental leave",
    createdAt: "2026-07-14T09:12:00Z",
    type: "Scenario",
    totalQuestions: 8,
    status: "Pass",
  },
];
// ---------------------------------------------------------------------------
// Avatar combinations — what /experience offers employees to choose from.
// Each combination pairs one avatar with one persona and the knowledge
// sources that persona can draw on. getAvailableCombinations() only surfaces
// combos where *both* the avatar and persona are Published — Draft/Archived
// items stay admin-only, never shown on the public picker.
//
// TODO: once an avatar/persona/knowledge relationship exists in Supabase,
// this list (and the filtering rule) moves server-side; consumers below
// don't need to change.
// ---------------------------------------------------------------------------

export type AvatarCombination = {
  id: string;
  avatarId: string;
  personaId: string;
  knowledgeSourceIds: string[];
};

export const avatarCombinations: AvatarCombination[] = [
  {
    id: "sarra-hr",
    avatarId: "Sarra",
    personaId: "Sarra",
    knowledgeSourceIds: ["hr-policies", "benefits"],
  },
];

export type ResolvedCombination = {
  id: string;
  avatar: Avatar;
  persona: Persona;
  knowledgeSources: KnowledgeSource[];
};

export function getAvailableCombinations(): ResolvedCombination[] {
  return avatarCombinations.reduce<ResolvedCombination[]>((acc, combo) => {
    const avatar = avatars.find((a) => a.id === combo.avatarId);
    const persona = personas.find((p) => p.id === combo.personaId);
    if (!avatar || !persona) return acc;
    if (avatar.status !== "Public" || persona.status !== "Public") return acc;

    const combinedKnowledgeSources = combo.knowledgeSourceIds
      .map((id) => knowledgeSources.find((k) => k.id === id))
      .filter((k): k is KnowledgeSource => Boolean(k));

    acc.push({ id: combo.id, avatar, persona, knowledgeSources: combinedKnowledgeSources });
    return acc;
  }, []);
}
