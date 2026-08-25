"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { WizardStepper } from "@/components/admin/avatar-wizard/WizardStepper";
import { StepAvatar } from "@/components/admin/avatar-wizard/steps/StepAvatar";
import { StepKnowledge } from "@/components/admin/avatar-wizard/steps/StepKnowledge";
import { PersonaFieldsForm, type PersonaFieldsData } from "@/components/admin/avatar-wizard/steps/PersonaFieldsForm";
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
  const [avatarDraft, setAvatarDraft] = useState<WizardData["avatar"] | null>(null);
  const [personaDraft, setPersonaDraft] = useState<PersonaFieldsData | null>(null);
  const [knowledgeDraft, setKnowledgeDraft] = useState<WizardData["knowledge"] | null>(null);

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
          imagePreviewUrl: data.avatar.imageUrl,
          name: data.avatar.name,
          owner: data.avatar.owner,
          ownerType: data.avatar.ownerType,
          bodyType: data.avatar.bodyType,
          status: data.avatar.status,
        });
        setPersonaDraft({
          name: data.persona.name,
          type: data.persona.type,
          prompt: data.persona.prompt,
          qnaModel: data.persona.qnaModel,
          creativity: data.persona.creativity,
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

      const [avatarRes, personaRes, comboRes] = await Promise.all([
        fetch(`/api/admin/avatars/${combo.avatar.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: avatarDraft.name,
            owner: avatarDraft.owner,
            ownerType: avatarDraft.ownerType,
            bodyType: avatarDraft.bodyType,
          }),
        }),
        fetch(`/api/admin/personas/${combo.persona.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: personaDraft.name,
            type: personaDraft.type,
            prompt: personaDraft.prompt,
            qnaModel: personaDraft.qnaModel,
            creativity: personaDraft.creativity,
          }),
        }),
        fetch(`/api/admin/combinations/${combo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledgeSourceIds }),
        }),
      ]);

      if (!avatarRes.ok) throw new Error((await avatarRes.json()).error ?? "Failed to save avatar");
      if (!personaRes.ok) throw new Error((await personaRes.json()).error ?? "Failed to save persona");
      if (!comboRes.ok) throw new Error((await comboRes.json()).error ?? "Failed to save knowledge links");

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
          <StepAvatar data={avatarDraft} onChange={setAvatarDraft} />
        ) : null}
        {EDIT_STEPS[stepIndex].id === "persona" ? (
          <AdminCard>
            <PersonaFieldsForm data={personaDraft} onChange={setPersonaDraft} />
          </AdminCard>
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
        <AdminPrimaryButton onClick={goNext} disabled={saving}>
          {isLastStep ? (saving ? "Saving…" : "Save changes") : "Next"}
        </AdminPrimaryButton>
      </div>
    </>
  );
}
