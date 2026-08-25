"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: replace with real auth once the backend is wired, e.g.:
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    // On success, read the role claim (employee/admin) and redirect straight
    // to /experience or /admin instead of always going through the gateway.
    setTimeout(() => {
      router.push("/select-role");
    }, 600);
  }

  function handleSsoSignIn() {
    setIsSubmitting(true);
    // TODO: replace with Supabase Auth + Microsoft Entra ID OAuth provider, e.g.:
    // await supabase.auth.signInWithOAuth({ provider: "azure" })
    setTimeout(() => {
      router.push("/select-role");
    }, 600);
  }

  return (
    <main className="min-h-screen bg-panel flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <span className="text-xs tracking-[0.2em] uppercase text-ink/50">
            PwC Tunisia
          </span>
          <h1 className="mt-3 font-serif text-3xl text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-ink/60">
            Access your AI avatar workspace
          </p>
        </div>

        <div className="rounded-3xl border border-ink/10 bg-white/80 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                Work email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@pwc.com"
                  className="w-full rounded-xl border border-ink/15 bg-white py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-ink/15 bg-white py-2.5 pl-10 pr-10 text-sm text-ink placeholder:text-ink/30 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/70"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink/60">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-ink/30 accent-[var(--color-accent)]"
                />
                Remember me
              </label>
              <span
                className="cursor-not-allowed text-ink/40"
                title="Not wired up yet"
              >
                Forgot password?
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-ink/10" />
            <span className="text-xs uppercase tracking-wide text-ink/40">or</span>
            <div className="h-px flex-1 bg-ink/10" />
          </div>

          <button
            type="button"
            onClick={handleSsoSignIn}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-ink/15 bg-white py-3 text-sm font-medium text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Continue with SSO
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-ink/40">
          Need access? Contact your workspace administrator.
        </p>
      </motion.div>
    </main>
  );
}
