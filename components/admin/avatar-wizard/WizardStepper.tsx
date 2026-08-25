"use client";

import { Check } from "lucide-react";

export type WizardStepId = "avatar" | "persona" | "knowledge" | "test";

export const wizardSteps: { id: WizardStepId; label: string }[] = [
  { id: "avatar", label: "Avatar" },
  { id: "persona", label: "Persona" },
  { id: "knowledge", label: "Knowledge" },
  { id: "test", label: "Test" },
];

export function WizardStepper({
  activeIndex,
  steps = wizardSteps,
}: {
  activeIndex: number;
  steps?: { id: string; label: string }[];
}) {
  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;

        return (
          <div key={step.id} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  done
                    ? "bg-accent text-white"
                    : active
                      ? "bg-accent/15 text-accent ring-2 ring-accent"
                      : "bg-stone-100 text-stone-400"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-sm font-medium ${active ? "text-stone-900" : "text-stone-500"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div className={`mx-4 h-px flex-1 ${done ? "bg-accent" : "bg-stone-200"}`} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
