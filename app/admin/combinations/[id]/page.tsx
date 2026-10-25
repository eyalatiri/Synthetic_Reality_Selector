"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { WizardStepper } from "@/components/admin/avatar-wizard/WizardStepper";
import { StepAvatar } from "@/components/admin/avatar-wizard/steps/StepAvatar";
import { StepPersona } from "@/components/admin/avatar-wizard/steps/StepPersona";
import { StepKnowledge } from "@/components/admin/avatar-wizard/steps/StepKnowledge";
import type { WizardData } from "@/components/admin/avatar-wizard/wizard-types";
import type { ResolvedCombination } from "@/lib/admin/types";

const EDIT_STEPS = [
  { id: "avatar", label: "Avatar" },
  { id: "persona", label: "Persona" },
  { id: "knowledge", label: "Knowledge" },
] as const;

export default function CombinationEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [combo, setCombo] = useState<ResolvedCombination | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [stepIndex, setStepIndex] = useState(0);
  // Both avatar and persona now default to mode "new", meaning "edit this
  // combination's own avatar/persona fields in place" (the original
  // behaviour). Switching either toggle to "existing" — same StepAvatar.tsx /
  // StepPersona.tsx components the creation wizard uses — lets you re-point
  // this combination at a different avatar or persona instead.
  const [avatarDraft, setAvatarDraft] = useState<WizardData["avatar"] | null>(null);
  const [personaDraft, setPersonaDraft] = useState<WizardData["persona"] | null>(null);
  const [knowledgeDraft, setKnowledgeDraft] = useState<WizardData["knowledge"] | null>(null);
  const [videoProcessing, setVideoProcessing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/combinations/${params.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load combination");
        return res.json();
      })
      .then((data: ResolvedCombination) => {
        if (cancelled) return;
        setCombo(data);
        setAvatarDraft({
          mode: "new",
          existingAvatarId: null,
          imagePreviewUrl: data.avatar.imageUrl,
          videoUrl: data.avatar.videoUrl,
          name: data.avatar.name,
          owner: data.avatar.owner,
          ownerType: data.avatar.ownerType,
          bodyType: data.avatar.bodyType,
          status: data.avatar.status,
        });
        setPersonaDraft({
          mode: "new",
          existingPersonaId: null,
          name: data.persona.name,
          type: data.persona.type,
          prompt: data.persona.prompt,
          qnaModel: data.persona.qnaModel,
          creativity: data.persona.creativity,
          gender: data.persona.gender,
        });
        setKnowledgeDraft({
          mode: "existing",
          selectedIds: data.knowledgeSources.map((k) => k.id),
          newSource: { name: "", description: "", files: [] },
        });
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load combination");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const isLastStep = stepIndex === EDIT_STEPS.length - 1;

  function goBack() {
    if (stepIndex === 0) {
      router.push("/admin");
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function goNext() {
    if (isLastStep) {
      handleSave();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, EDIT_STEPS.length - 1));
  }

  async function handleSave() {
    if (!combo || !avatarDraft || !personaDraft || !knowledgeDraft) return;

    if (avatarDraft.mode === "existing" && !avatarDraft.existingAvatarId) {
      setSaveError('Select an existing avatar, or switch to "Create a new avatar".');
      return;
    }
    if (personaDraft.mode === "existing" && !personaDraft.existingPersonaId) {
      setSaveError('Select an existing persona, or switch to "Create a new persona".');
      return;
    }
    if (videoProcessing) {
      setSaveError("The avatar video is still processing — wait for it to finish before saving.");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      let knowledgeSourceIds = knowledgeDraft.selectedIds;

      if (knowledgeDraft.mode === "new" && knowledgeDraft.newSource.name.trim()) {
        const createRes = await fetch("/api/admin/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: knowledgeDraft.newSource.name,
            description: knowledgeDraft.newSource.description,
          }),
        });
        if (!createRes.ok) throw new Error((await createRes.json()).error ?? "Failed to create knowledge source");
        const created = await createRes.json();
        knowledgeSourceIds = [...knowledgeDraft.selectedIds, created.id];
      }

      // Avatar: either point this combination at a different existing
      // avatar, or save this combination's own avatar's fields in place.
      let nextAvatarId = combo.avatar.id;
      if (avatarDraft.mode === "existing") {
        nextAvatarId = avatarDraft.existingAvatarId as string;
      } else {
        const avatarRes = await fetch(`/api/admin/avatars/${combo.avatar.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: avatarDraft.name,
            owner: avatarDraft.owner,
            ownerType: avatarDraft.ownerType,
            bodyType: avatarDraft.bodyType,
            imageUrl: avatarDraft.imagePreviewUrl,
            videoUrl: avatarDraft.videoUrl,
          }),
        });
        if (!avatarRes.ok) throw new Error((await avatarRes.json()).error ?? "Failed to save avatar");
      }

      // Persona: same existing/new branch as the avatar above.
      let nextPersonaId = combo.persona.id;
      if (personaDraft.mode === "existing") {
        nextPersonaId = personaDraft.existingPersonaId as string;
      } else {
        const personaRes = await fetch(`/api/admin/personas/${combo.persona.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: personaDraft.name,
            type: personaDraft.type,
            prompt: personaDraft.prompt,
            qnaModel: personaDraft.qnaModel,
            creativity: personaDraft.creativity,
            gender: personaDraft.gender,
          }),
        });
        if (!personaRes.ok) throw new Error((await personaRes.json()).error ?? "Failed to save persona");
      }

      const comboRes = await fetch(`/api/admin/combinations/${combo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: nextAvatarId, personaId: nextPersonaId, knowledgeSourceIds }),
      });
      if (!comboRes.ok) throw new Error((await comboRes.json()).error ?? "Failed to save changes");

      router.push("/admin");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-stone-500">Loading combination…</p>;
  if (loadError || !combo || !avatarDraft || !personaDraft || !knowledgeDraft) {
    return (
      <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
        {loadError ?? "Combination not found"}
      </p>
    );
  }

  return (
    <>
      <AdminPageHeader
        title={`Edit ${combo.avatar.name}`}
        subtitle="Update the avatar, its persona, and its linked knowledge in one place — same flow as creation."
      />

      <div className="mt-8">
        <WizardStepper activeIndex={stepIndex} steps={EDIT_STEPS} />
      </div>

      <div className="mt-8">
        {EDIT_STEPS[stepIndex].id === "avatar" ? (
          <StepAvatar data={avatarDraft} onChange={setAvatarDraft} onVideoProcessingChange={setVideoProcessing} />
        ) : null}
        {EDIT_STEPS[stepIndex].id === "persona" ? (
          <StepPersona data={personaDraft} onChange={setPersonaDraft} />
        ) : null}
        {EDIT_STEPS[stepIndex].id === "knowledge" ? (
          <StepKnowledge data={knowledgeDraft} onChange={setKnowledgeDraft} />
        ) : null}
      </div>

      {saveError ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {saveError}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <AdminSecondaryButton onClick={goBack}>{stepIndex === 0 ? "Cancel" : "Back"}</AdminSecondaryButton>
        <AdminPrimaryButton onClick={goNext} disabled={saving || (isLastStep && videoProcessing)}>
          {isLastStep ? (saving ? "Saving…" : videoProcessing ? "Processing video…" : "Save changes") : "Next"}
        </AdminPrimaryButton>
      </div>
    </>
  );
}
