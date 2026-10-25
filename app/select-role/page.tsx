import Link from "next/link";
import { UserRound, ShieldCheck, ArrowRight } from "lucide-react";

export default function SelectRolePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-panel px-6">
      <div className="w-full max-w-3xl">
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent font-serif text-xl font-semibold text-white">
            P
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-stone-900">
            Where to next?
          </h1>
          <p className="mt-2 text-stone-500">You have administrator access &mdash; pick a side.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RoleCard
            href="/experience"
            icon={UserRound}
            title="Employee experience"
            description="Talk with SRS TN for questions, onboarding help, and benefits."
          />
          <RoleCard
            href="/admin"
            icon={ShieldCheck}
            title="Admin panel"
            description="Manage avatars, personas, knowledge sources, and conversation logs."
          />
        </div>

        <form action="/auth/signout" method="post" className="mt-8 text-center">
          <button type="submit" className="text-sm text-stone-400 underline-offset-4 transition-colors hover:text-stone-700 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}

function RoleCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof UserRound;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-4 rounded-3xl border border-stone-200/70 bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      <span className="mt-auto flex items-center gap-1.5 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
        Continue <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
