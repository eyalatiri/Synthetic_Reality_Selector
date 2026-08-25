"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ConversationChat } from "@/components/chat/ConversationChat";

// Reads the ?avatar=&persona= query params AvatarPicker links here with
// (see components/home/AvatarPicker.tsx) and hands them to ConversationChat,
// which creates the real conversation row and drives the live chat.
function ConversationRoute() {
  const searchParams = useSearchParams();

  return (
    <ConversationChat
      avatarId={searchParams.get("avatar") ?? undefined}
      personaId={searchParams.get("persona") ?? undefined}
    />
  );
}

// useSearchParams() opts this route out of static rendering unless wrapped
// in Suspense — this page is inherently dynamic (per-visitor chat session)
// anyway, but wrapping avoids the Next.js build-time warning.
export default function ConversationPage() {
  return (
    <Suspense fallback={null}>
      <ConversationRoute />
    </Suspense>
  );
}
