import { personas, type OwnerType, type BodyType, type PublishState, type QnaModel } from "@/lib/admin/mock-data";
import type { PersonaGender } from "@/lib/admin/types";

export type WizardKnowledgeFile = {
  id: string;
  name: string;
  sizeLabel: string;
};

export type WizardData = {
  avatar: {
    // "existing" reuses an avatar already in the table (picked from the
    // list StepAvatar.tsx fetches from /api/admin/avatars) — mirrors the
    // existing/new toggle StepKnowledge.tsx and StepPersona.tsx already
    // have. "new" is the original inline-form flow below.
    mode: "existing" | "new";
    // Set when mode is "existing"; the id of the chosen avatar row.
    existingAvatarId: string | null;
    imagePreviewUrl: string | null;
    // Set once /api/admin/avatars/create-video finishes (LivePortrait's
    // returned, re-animated clip, stored in Supabase Storage — see
    // supabase/migrations/0005_avatar_video_url.sql). Null until that
    // upload completes; "Publish avatar" is disabled while it's null but a
    // source video is selected, so a half-finished upload can't be published.
    videoUrl: string | null;
    name: string;
    owner: string;
    ownerType: OwnerType;
    bodyType: BodyType;
    status: PublishState;
  };
  persona: {
    mode: "existing" | "new";
    existingPersonaId: string | null;
    type: string;
    name: string;
    prompt: string;
    qnaModel: QnaModel;
    creativity: number;
    // Drives TTS voice selection - see app/api/conversations/route.ts and
    // supabase/migrations/0004_persona_gender.sql. formality/empathy/
    // humour/confidence were removed here on 2026-07-30 - they were never
    // real columns on `personas` (see that migration's comment for the
    // full audit), so this whole tone step was a no-op cosmetic mockup.
    gender: PersonaGender;
  };
  knowledge: {
    mode: "existing" | "new";
    selectedIds: string[];
    newSource: {
      name: string;
      description: string;
      files: WizardKnowledgeFile[];
    };
  };
};

export const initialWizardData: WizardData = {
  avatar: {
    mode: "new",
    existingAvatarId: null,
    imagePreviewUrl: null,
    videoUrl: null,
    name: "",
    owner: "",
    ownerType: "Organisation",
    bodyType: "Half body",
    status: "Private",
  },
  persona: {
    mode: "existing",
    existingPersonaId: personas[0]?.id ?? null,
    type: "",
    name: "",
    prompt: "",
    qnaModel: "Claude Sonnet",
    creativity: 35,
    gender: "female",
  },
  knowledge: {
    mode: "existing",
    selectedIds: [],
    newSource: { name: "", description: "", files: [] },
  },
};
