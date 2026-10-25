"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Mic, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  // Admins get a shortcut back to the admin panel; employees never see it.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => setIsAdmin(me?.role === "admin"))
      .catch(() => {});
  }, []);

  function goToConversationPicker() {
    const picker = document.getElementById("choose-avatar");
    if (picker) {
      picker.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push("/conversation");
    }
  }
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold tracking-wide text-white">
            PWC
          </span>
          <span className="h-4 w-px bg-white/30" />
          <span className="text-sm text-white/70">SRS TN · Enterprise AI</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ShieldCheck size={14} />
              Admin
            </Link>
          )}
          <button
            onClick={goToConversationPicker}
            className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Mic size={14} />
            Start Conversation
          </button>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
