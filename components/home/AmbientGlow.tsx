"use client";

import { motion } from "framer-motion";

/**
 * A slow, breathing radial glow behind the hero headline.
 * Echoes the pulsing "live" indicator on the voice conversation screen,
 * so the two experiences read as one product rather than two separate builds.
 */
export default function AmbientGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <motion.div
        className="h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent) 0%, transparent 70%)",
        }}
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.25, 0.4, 0.25],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
