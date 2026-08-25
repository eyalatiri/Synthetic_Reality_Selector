import { personas, type OwnerType, type BodyType, type PublishState, type QnaModel } from "@/lib/admin/mock-data";
import type { PersonaGender } from "@/lib/admin/types";

export type WizardKnowledgeFile = {
  id: string;
  name: string;
  sizeLabel: string;
};

export type WizardData = {
  avatar: {
    imagePreviewUrl: string | null;
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
    imagePreviewUrl: null,
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
