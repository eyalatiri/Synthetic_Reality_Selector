"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mic, FileText } from "lucide-react";
import type { ResolvedCombination } from "@/lib/admin/types";

// Fetches /api/experience/combinations instead of importing
// getAvailableCombinations() from lib/admin/mock-data.ts directly — that
// mock array was never actually wired up, so every Published avatar/persona
// pair created in /admin was invisible here until now.
export default function AvatarPicker() {
  const router = useRouter();
  const [combinations, setCombinations] = useState<ResolvedCombination[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/experience/combinations")
      .then(async (res) => {
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Got a ${res.status} non-JSON response from /api/experience/combinations`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load combinations");
        return data as ResolvedCombination[];
      })
      .then((data) => {
        if (!cancelled) setCombinations(data);
      })
      .catch((err) => {
        // This section is decorative on a marketing page — if it fails to
        // load, fail quietly (render nothing) rather than show an error box
        // to an employee who just wants to talk to an avatar. Still log it
        // so it's not silently swallowed during development.
        console.error("Failed to load avatar combinations:", err);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Stay invisible until the fetch resolves (avoids a flash of an empty
  // section), then behave exactly like before: nothing to show, no section.
  if (!loaded || combinations.length === 0) return null;

  return (
    <section id="choose-avatar" className="bg-white px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Who would you like to talk to?
          </h2>
          <p className="mt-3 text-neutral-500">
            Each assistant is tuned for a different topic, with its own knowledge base attached.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {combinations.map((combo, i) => (
            <motion.div
              key={combo.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="flex flex-col rounded-3xl border border-neutral-200 bg-neutral-50/60 p-6 transition-shadow hover:shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 font-serif text-xl font-semibold text-accent">
                  {combo.avatar.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-neutral-900">{combo.avatar.name}</p>
                  <p className="text-sm text-neutral-500">{combo.persona.type}</p>
                </div>
              </div>

              <p className="mt-4 line-clamp-3 text-sm text-neutral-600">{combo.persona.prompt}</p>

              {combo.knowledgeSources.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {combo.knowledgeSources.map((source) => (
                    <span
                      key={source.id}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-neutral-500 ring-1 ring-neutral-200"
                    >
                      <FileText className="h-3 w-3" />
                      {source.name}
                    </span>
                  ))}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() =>
                  router.push(`/conversation?avatar=${combo.avatar.id}&persona=${combo.persona.id}&combination=${combo.id}`)
                }
                className="mt-6 flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Mic className="h-4 w-4" />
                Start with {combo.avatar.name}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
