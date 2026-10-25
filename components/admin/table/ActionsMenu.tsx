"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  History,
  FlaskConical,
  Pencil,
  Copy,
  Sparkles,
  Users,
  Archive,
  Trash2,
  Rocket,
  ShieldCheck,
  UserRound,
  UserX,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { Avatar, Persona, KnowledgeSource, ResolvedCombination, UserProfile } from "@/lib/admin/types";


type ActionItem = { label: string; icon: LucideIcon; onClick: () => void; destructive?: boolean };

type Router = ReturnType<typeof useRouter>;

async function withBusy(setBusy: (b: boolean) => void, fn: () => Promise<void>) {
  setBusy(true);
  try {
    await fn();
  } catch (err) {
    alert(err instanceof Error ? err.message : "Something went wrong");
  } finally {
    setBusy(false);
  }
}
function combinationItems(
  combo: ResolvedCombination,
  router: Router,
  onChanged: () => void,
  setBusy: (b: boolean) => void
): ActionItem[] {
  const { avatar, persona, knowledgeSources } = combo;
  const isPublic = avatar.status === "Public" && persona.status === "Public";

  return [
    {
    label: "Edit",
    icon: Pencil,
    onClick: () => router.push(`/admin/combinations/${combo.id}`),
    },
    { label: "View tests", icon: FlaskConical, onClick: () => router.push("/admin/testing") },
    // Publishing a combination means both the avatar AND the persona need to
    // be "Public" — /api/experience/combinations filters on both. Toggling
    // just one from here would leave the pair in a half-published state, so
    // this PATCHes both records together.
    {
      label: isPublic ? "Make private" : "Publish",
      icon: Rocket,
      onClick: () =>
        withBusy(setBusy, async () => {
          const nextStatus = isPublic ? "Private" : "Public";
          const [avatarRes, personaRes] = await Promise.all([
            fetch(`/api/admin/avatars/${avatar.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: nextStatus }),
            }),
            fetch(`/api/admin/personas/${persona.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: nextStatus }),
            }),
          ]);
          if (!avatarRes.ok) throw new Error((await avatarRes.json()).error ?? "Failed to update avatar status");
          if (!personaRes.ok) throw new Error((await personaRes.json()).error ?? "Failed to update persona status");
          onChanged();
        }),
    },
    {
      label: "Duplicate",
      icon: Copy,
      onClick: () =>
        withBusy(setBusy, async () => {
          const res = await fetch("/api/admin/combinations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              avatar: `${combo.avatar} (copy)`,
              persona: combo.persona,
              knowledgeSources: combo.knowledgeSources,
              status: "Private",
              
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to duplicate persona");
          onChanged();
        }),
    },
    {
      label: "Archive",
      icon: Archive,
      onClick: () =>
        withBusy(setBusy, async () => {
          const [avatarRes, personaRes] = await Promise.all([
            fetch(`/api/admin/avatars/${avatar.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "Archived" }),
            }),
            fetch(`/api/admin/personas/${persona.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "Archived" }),
            }),
          ]);
          if (!avatarRes.ok) throw new Error((await avatarRes.json()).error ?? "Failed to archive avatar");
          if (!personaRes.ok) throw new Error((await personaRes.json()).error ?? "Failed to archive persona");
          onChanged();
        }),
    },
    // Deliberately calls /api/admin/combinations/:id, NOT the avatar or
    // persona delete routes — this unpairs the row only. The avatar,
    // persona, and knowledge source all remain intact and reusable.
    {
      label: "Remove pairing",
      icon: Trash2,
      destructive: true,
      onClick: () => {
        if (!confirm(`Remove this combination (${avatar.name} + ${persona.name})? The avatar and persona themselves won't be deleted.`)) return;
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/combinations/${combo.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to remove combination");
          onChanged();
        });
      },
    },
  ];
}
function personaItems(persona: Persona, router: Router, onChanged: () => void, setBusy: (b: boolean) => void): ActionItem[] {
  return [
    { label: "View", icon: Eye, onClick: () => router.push(`/admin/personas/${persona.id}`) },
    {
      label: "Versions",
      icon: History,
      onClick: () => alert(`Version history isn't tracked yet — "${persona.name}" is currently at ${persona.version}.`),
    },
    { label: "View tests", icon: FlaskConical, onClick: () => router.push("/admin/testing") },
    { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/personas/${persona.id}`) },
    {
      label: "Duplicate",
      icon: Copy,
      onClick: () =>
        withBusy(setBusy, async () => {
          const res = await fetch("/api/admin/personas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `${persona.name} (copy)`,
              type: persona.type,
              prompt: persona.prompt,
              roleTitle: persona.roleTitle,
              department: persona.department,
              qnaModel: persona.qnaModel,
              creativity: persona.creativity,
              status: "Private",
              // Deliberately not carrying avatarId over — a duplicate starts
              // unlinked so you don't end up with two personas both claiming
              // to be "the" persona for the same avatar.
            }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to duplicate persona");
          onChanged();
        }),
    },
    { label: "Smart edit", icon: Sparkles, onClick: () => console.log("smart edit", persona.name) },
    {
      label: "Creators",
      icon: Users,
      onClick: () => alert("Creator/audit tracking isn't built yet — there's no user or auth system wired up."),
    },
    // Publish is what actually surfaces a persona (paired with a Published
    // avatar) on the /experience avatar picker — see
    // app/api/experience/combinations/route.ts, which filters to
    // status === "Published" on BOTH sides. There was previously no menu
    // item that could ever set a persona to "Published" at all.
    {
      label: persona.status === "Public" ? "Private" : "Public",
      icon: Rocket,
      onClick: () =>
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/personas/${persona.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: persona.status === "Public" ? "Private" : "Public" }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update persona status");
          onChanged();
        }),
    },
    {
      label: "Archive",
      icon: Archive,
      onClick: () =>
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/personas/${persona.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Archived" }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to archive persona");
          onChanged();
        }),
    },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => {
        if (!confirm(`Delete "${persona.name}"? This can't be undone.`)) return;
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/personas/${persona.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete persona");
          onChanged();
        });
      },
    },
  ];
}

function avatarItems(avatar: Avatar, router: Router, onChanged: () => void, setBusy: (b: boolean) => void): ActionItem[] {
  return [
    // There is no app/admin/avatars/[avatarId]/persona route anymore (that
    // was the old persona editor pattern from the original recap) — the
    // live page at this id is app/admin/avatars/[avatarId]/page.tsx, the
    // plain avatar-fields editor. Linking to .../persona 404'd.
    { label: "View", icon: Eye, onClick: () => router.push(`/admin/avatars/${avatar.id}`) },
    { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/avatars/${avatar.id}`) },
    // Same reasoning as personaItems' Publish action: the avatars list had
    // no row actions at all, so an avatar could never leave "Draft" either.
    // Both this AND the linked persona need status "Published" before a
    // combination shows up on /experience.
    {
      label: avatar.status === "Public" ? "Private" : "Public",
      icon: Rocket,
      onClick: () =>
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/avatars/${avatar.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: avatar.status === "Public" ? "Private" : "Public" }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update avatar status");
          onChanged();
        }),
    },
    {
      label: "Archive",
      icon: Archive,
      onClick: () =>
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/avatars/${avatar.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Archived" }),
          });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to archive avatar");
          onChanged();
        }),
    },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => {
        if (!confirm(`Delete "${avatar.name}"? This also removes its linked persona and can't be undone.`)) return;
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/avatars/${avatar.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete avatar");
          onChanged();
        });
      },
    },
  ];
}

function userItems(
  user: UserProfile,
  isSelf: boolean,
  onEdit: (user: UserProfile) => void,
  onChanged: () => void,
  setBusy: (b: boolean) => void
): ActionItem[] {
  const patch = (body: Record<string, unknown>, failure: string) =>
    withBusy(setBusy, async () => {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? failure);
      onChanged();
    });

  const items: ActionItem[] = [{ label: "Edit", icon: Pencil, onClick: () => onEdit(user) }];

  // Your own row only gets "Edit": the API also refuses self-demotion,
  // self-suspension and self-deletion, so hiding them here is just UX.
  if (!isSelf) {
    items.push(
      user.role === "admin"
        ? { label: "Make employee", icon: UserRound, onClick: () => patch({ role: "employee" }, "Failed to change role") }
        : { label: "Make admin", icon: ShieldCheck, onClick: () => patch({ role: "admin" }, "Failed to change role") },
      user.status === "Active"
        ? {
            label: "Suspend",
            icon: UserX,
            onClick: () => {
              if (!confirm(`Suspend ${user.fullName || user.email}? They'll be signed out and blocked immediately.`)) return;
              patch({ status: "Suspended" }, "Failed to suspend user");
            },
          }
        : { label: "Reactivate", icon: UserCheck, onClick: () => patch({ status: "Active" }, "Failed to reactivate user") },
      {
        label: "Delete",
        icon: Trash2,
        destructive: true,
        onClick: () => {
          if (!confirm(`Delete ${user.fullName || user.email}? Their account is removed permanently.`)) return;
          withBusy(setBusy, async () => {
            const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Failed to delete user");
            onChanged();
          });
        },
      }
    );
  }
  return items;
}

function knowledgeItems(
  source: KnowledgeSource,
  router: Router,
  onChanged: () => void,
  setBusy: (b: boolean) => void
): ActionItem[] {
  return [
    { label: "View", icon: Eye, onClick: () => router.push(`/admin/knowledge/${source.id}`) },
    { label: "Edit", icon: Pencil, onClick: () => router.push(`/admin/knowledge/${source.id}`) },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      onClick: () => {
        if (!confirm(`Delete "${source.name}"? This removes its files too and can't be undone.`)) return;
        withBusy(setBusy, async () => {
          const res = await fetch(`/api/admin/knowledge/${source.id}`, { method: "DELETE" });
          if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete knowledge source");
          onChanged();
        });
      },
    },
  ];
}

type PersonaVariantProps = { variant: "persona"; persona: Persona; onChanged: () => void };
type AvatarVariantProps = { variant: "avatar"; avatar: Avatar; onChanged: () => void };
type KnowledgeVariantProps = { variant: "knowledge"; source: KnowledgeSource; onChanged: () => void };
// Conversations/tests aren't wired to real actions yet — same stub behaviour

type UserVariantProps = {
  variant: "user";
  user: UserProfile;
  /** True when this row is the signed-in admin. */
  isSelf: boolean;
  onEdit: (user: UserProfile) => void;
  onChanged: () => void;
};

type CombinationVariantProps = { variant: "combination"; combination: ResolvedCombination; onChanged: () => void };

type ActionsMenuProps =
  | PersonaVariantProps
  | AvatarVariantProps
  | KnowledgeVariantProps
  | CombinationVariantProps
  | UserVariantProps
  | StandardVariantProps;
type StandardVariantProps = { variant?: "standard"; name: string };



const MENU_WIDTH = 192; // w-48
const GAP = 6;

type Coords = { top: number; left: number };

export function ActionsMenu(props: ActionsMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);



  const items: ActionItem[] =
    props.variant === "persona"
      ? personaItems(props.persona, router, props.onChanged, setBusy)
      : props.variant === "avatar"
        ? avatarItems(props.avatar, router, props.onChanged, setBusy)
        : props.variant === "knowledge"
          ? knowledgeItems(props.source, router, props.onChanged, setBusy)
          : props.variant === "combination"
            ? combinationItems(props.combination, router, props.onChanged, setBusy)
            : props.variant === "user"
            ? userItems(props.user, props.isSelf, props.onEdit, props.onChanged, setBusy)
            : [
                { label: "View", icon: Eye, onClick: () => console.log("view", props.name) },
                { label: "Versions", icon: History, onClick: () => console.log("versions", props.name) },
                { label: "View tests", icon: FlaskConical, onClick: () => console.log("view tests", props.name) },
                { label: "Edit", icon: Pencil, onClick: () => console.log("edit", props.name) },
                { label: "Duplicate", icon: Copy, onClick: () => console.log("duplicate", props.name) },
                { label: "Smart edit", icon: Sparkles, onClick: () => console.log("smart edit", props.name) },
                { label: "Creators", icon: Users, onClick: () => console.log("creators", props.name) },
                { label: "Archive", icon: Archive, onClick: () => console.log("archive", props.name) },
                { label: "Delete", icon: Trash2, onClick: () => console.log("delete", props.name), destructive: true },
              ];

  // Computed from the trigger's real screen position every time the menu
  // opens (and on scroll/resize while it's open) — this is what lets the
  // menu render into document.body via a portal instead of the table's own
  // overflow-x-auto wrapper, so no ancestor's overflow can ever clip it.
  const updateCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 40 + 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight + GAP && rect.top > menuHeight + GAP;

    setCoords({
      top: openUpward ? rect.top - menuHeight - GAP : rect.bottom + GAP,
      left: Math.min(Math.max(rect.right - MENU_WIDTH, GAP), window.innerWidth - MENU_WIDTH - GAP),
    });
  }, [items.length]);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updateCoords]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{ position: "fixed", top: coords.top, left: coords.left, width: MENU_WIDTH }}
              className="z-50 overflow-hidden rounded-2xl border border-stone-200 bg-white py-1.5 shadow-lg"
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    item.onClick();
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors ${
                    item.destructive ? "text-red-600 hover:bg-red-50" : "text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
