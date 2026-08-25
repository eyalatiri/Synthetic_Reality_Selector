"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import IntroSequence from "@/components/home/intro/IntroSequence";
import HomepageContent from "@/components/home/HomepageContent";

export default function HomePage() {
  const [introDone, setIntroDone] = useState(false);
  // Respect prefers-reduced-motion: skip straight to the homepage.
  const prefersReducedMotion = useReducedMotion();

  const showIntro = !introDone && !prefersReducedMotion;

  return (
    <main className="relative">
      <AnimatePresence mode="wait">
        {showIntro ? (
          <IntroSequence key="intro" onComplete={() => setIntroDone(true)} />
        ) : (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
          >
            <HomepageContent />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
