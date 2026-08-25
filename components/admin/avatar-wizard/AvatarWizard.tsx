"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminPageHeader, AdminPrimaryButton, AdminSecondaryButton } from "@/components/admin/AdminPageHeader";
import { WizardStepper, wizardSteps } from "./WizardStepper";
import { initialWizardData } from "./wizard-types";
import { StepAvatar } from "./steps/StepAvatar";
import { StepPersona } from "./steps/StepPersona";
import { StepKnowledge } from "./steps/StepKnowledge";
import { StepTest } from "./steps/StepTest";

export function AvatarWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState(initialWizardData);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const currentStep = wizardSteps[stepIndex];
  const isLastStep = stepIndex === wizardSteps.length - 1;

  function goNext() {
    if (isLastStep) {
      handlePublish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, wizardSteps.length - 1));
  }

  function goBack() {
    if (stepIndex === 0) {
      router.push("/admin/avatars");
      return;
    }
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const res = await fetch("/api/admin/avatars/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data), // { avatar, persona, knowledge } — matches WizardData exactly
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to publish avatar");
      }

      router.push("/admin/avatars");
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Failed to publish avatar");
      setPublishing(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Create avatar"
        subtitle="Set the avatar, pick its persona, attach knowledge, then test it end to end."
      />

      <div className="mt-8">
        <WizardStepper activeIndex={stepIndex} />
      </div>

      <div className="mt-8">
        {currentStep.id === "avatar" ? (
          <StepAvatar data={data.avatar} onChange={(avatar) => setData({ ...data, avatar })} />
        ) : null}
        {currentStep.id === "persona" ? (
          <StepPersona data={data.persona} onChange={(persona) => setData({ ...data, persona })} />
        ) : null}
        {currentStep.id === "knowledge" ? (
          <StepKnowledge data={data.knowledge} onChange={(knowledge) => setData({ ...data, knowledge })} />
        ) : null}
        {currentStep.id === "test" ? <StepTest data={data} /> : null}
      </div>

      {publishError ? (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {publishError}
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <AdminSecondaryButton onClick={goBack}>{stepIndex === 0 ? "Cancel" : "Back"}</AdminSecondaryButton>
        <AdminPrimaryButton onClick={goNext} disabled={publishing}>
          {isLastStep ? (publishing ? "Publishing…" : "Publish avatar") : "Next"}
        </AdminPrimaryButton>
      </div>
    </>
  );
}
