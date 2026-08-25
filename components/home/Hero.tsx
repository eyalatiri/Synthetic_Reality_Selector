"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { Mic, ChevronDown, UserRound } from "lucide-react";
import AmbientGlow from "./AmbientGlow";

// TODO: Replace with real PwC Tunisia headquarters photography.
// Recommended: a wide, low-contrast interior/exterior shot so text stays legible.
const HERO_IMAGE_URL = "/images/1763457275895.jpg";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function Hero() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  function goToConversationPicker() {
    const picker = document.getElementById("choose-avatar");
    if (picker) {
      picker.scrollIntoView({ behavior: "smooth" });
    } else {
      // No published avatar/persona combinations to choose from — fall back
      // to the old direct-to-conversation behavior rather than a dead click.
      router.push("/conversation");
    }
  }
  // Subtle parallax on the background image as the user scrolls past the hero.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen min-h-[720px] w-full items-center justify-center overflow-hidden bg-black"
    >
      {/* Background image */}
      <motion.div
        className="absolute inset-0 -z-20"
        style={{ y: bgY, scale: 1.12 }}
      >
        <img
          src={HERO_IMAGE_URL}
          alt=""
          className="h-full w-full object-cover opacity-90"
        />
      </motion.div>

      {/* Dark overlay for legibility — lighter at the top/middle so the photo
          reads clearly, darker toward the bottom where the CTA/scroll cue sit. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

      {/* Signature ambient glow */}
      <AmbientGlow />

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-6 text-center"
      >
        {/* Avatar reveal — the "presence arrives" beat, now part of the
            hero itself rather than a separate full-screen scene. Swap the
            glass circle for the live HeyGen render when ready. */}
        <motion.div
          variants={itemVariants}
          className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md sm:h-24 sm:w-24"
        >
          <UserRound size={36} strokeWidth={1.25} className="text-white/80" />
          <motion.span
            className="absolute inset-0 rounded-full border border-accent/50"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <motion.span
          variants={itemVariants}
          className="mb-6 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-wide text-white/80 backdrop-blur-md"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          SRS TN is online
        </motion.span>

        <motion.h1
          variants={itemVariants}
          className="text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl"
        >
          How can I help you today?
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mt-6 max-w-xl text-base text-white/70 sm:text-lg"
        >
          Ask in French, English, or Arabic — every answer is grounded in
          PwC Tunisia&apos;s real policies and knowledge base, live.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-10">
          <motion.button
            onClick={goToConversationPicker}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="group relative flex items-center gap-3 overflow-hidden rounded-full bg-accent px-8 py-4 text-base font-semibold text-white shadow-[0_0_0_0_rgba(255,109,0,0.5)] transition-shadow duration-300 hover:shadow-[0_0_40px_8px_rgba(255,109,0,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <Mic size={20} className="transition-transform group-hover:scale-110" />
            Start Conversation
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/40"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden="true"
      >
        <ChevronDown size={22} />
      </motion.div>
    </section>
  );
}
