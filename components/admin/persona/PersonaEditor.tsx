"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, User } from "lucide-react";
import { AdminPageHeader, AdminPrimaryButton } from "@/components/admin/AdminPageHeader";
import { AdminCard, AdminLivePanel } from "@/components/admin/AdminCard";
import type { Persona, PersonaGender } from "@/lib/admin/types";

type PersonaEditorProps = {
  avatarId: string;
  avatarName: string;
};

// NOTE (2026-07-30): this editor previously also had Communication style
// sliders (formality/empathy/humour/confidence), an expertise chip list,
// and a Guardrails card (forbidden topics + escalation instructions).
// Those fields were never real columns on the `personas` table - select("*")
// always returned them as undefined, and the PATCH route never persisted
// them either - so the whole UI was silently a no-op cosmetic mockup. They
// were removed here to match the real schema (see
// supabase/migrations/0004_persona_gender.sql for the audit). If/when those
// get real columns + a matching PATCH allowlist, reintroduce the
// corresponding cards using the same pattern as Role & expertise below.
export function PersonaEditor({ avatarId, avatarName }: PersonaEditorProps) {
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [roleTitle, setRoleTitle] = useState("Senior HR Advisor");
  const [department, setDepartment] = useState("People & Culture");
  const [gender, setGender] = useState<PersonaGender>("female");

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/personas")
      .then((res) => res.json())
      .then((personas: Persona[]) => {
        if (cancelled) return;
        const existing = personas.find((p) => p.avatarId === avatarId);
        if (!existing) return; // no persona yet - keep the defaults, handleSave will create one

        setPersonaId(existing.id);
        setRoleTitle(existing.roleTitle || "");
        setDepartment(existing.department || "");
        setGender(existing.gender || "female");
      })
      .catch(() => {
        // Non-fatal - editor just falls back to defaults for a brand-new avatar.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarId]);

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);

    const payload = { avatarId, roleTitle, department, gender };

    try {
      const res = personaId
        ? await fetch(`/api/admin/personas/${personaId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/personas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, name: avatarName, type: roleTitle || "Assistant" }),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save persona");
      }

      const saved: Persona = await res.json();
      setPersonaId(saved.id);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1800);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save persona");
      setSaveState("error");
    }
  }

  return (
    <>
      <AdminPageHeader
        title={`Define ${avatarName}'s personality`}
        subtitle="Shape how she thinks, speaks, and represents PwC."
        breadcrumb={
          <span className="flex items-center gap-1.5">
            <Link href="/admin/avatars" className="hover:text-stone-700">
              Avatars
            </Link>
            <span>/</span>
            <span>{avatarName}</span>
            <span>/</span>
            <span className="font-medium text-stone-700">Persona</span>
          </span>
        }
        action={
          <div className="flex items-center gap-3">
            {saveState === "error" && saveError ? <span className="text-sm text-red-600">{saveError}</span> : null}
            <AdminPrimaryButton onClick={handleSave} disabled={loading || saveState === "saving"}>
              {saveState === "saved" ? "Saved" : saveState === "saving" ? "Saving…" : "Save persona"}
            </AdminPrimaryButton>
          </div>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <AdminCard>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Briefcase className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-stone-900">Role</h2>
                <p className="text-sm text-stone-500">What {avatarName} does and who she serves.</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Role title</span>
                <input
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-stone-700">Department</span>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />
              </label>
            </div>
          </AdminCard>

          <AdminCard>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <User className="h-4 w-4" />
              </div>
              <div>
                <h2 className="font-semibold text-stone-900">Voice</h2>
                <p className="text-sm text-stone-500">Picks the text-to-speech voice used in live conversations.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  gender === "female" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
                }`}
              >
                Female
              </button>
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  gender === "male" ? "bg-stone-900 text-white" : "border border-stone-200 text-stone-600"
                }`}
              >
                Male
              </button>
            </div>
          </AdminCard>
        </div>

        <div className="xl:sticky xl:top-10 xl:self-start">
          <AdminLivePanel>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Behaviour preview</p>

            <div className="mt-4 flex flex-col gap-3">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/20 px-4 py-3 text-sm text-white">
                Can I get more parental leave than the policy states?
              </div>
              <div className="max-w-[92%] rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm leading-relaxed text-white/90">
                That&rsquo;s a fair question. Standard policy covers 16 weeks — for exceptions, I&rsquo;ll
                connect you with an HR partner who can review your case personally.
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <PreviewTile label="Role" value={roleTitle || "—"} />
              <PreviewTile label="Department" value={department || "—"} />
              <PreviewTile label="Voice" value={gender === "male" ? "Male" : "Female"} />
              <PreviewTile label="Mission" value="Support & guide" />
            </div>
          </AdminLivePanel>
        </div>
      </div>
    </>
  );
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
