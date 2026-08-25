"use client";

import { motion } from "framer-motion";
import { UserRound } from "lucide-react";

export default function SceneAvatar() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-black to-black" />

      {/* Ambient glow behind the avatar placeholder */}
      <motion.div
        className="absolute h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Avatar placeholder — swap this block for the live HeyGen render/video */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md sm:h-48 sm:w-48"
      >
        <UserRound size={64} strokeWidth={1.25} className="text-white/80" />
        <motion.span
          className="absolute inset-0 rounded-full border border-accent/50"
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.7 }}
        className="relative z-10 mt-8 text-center"
      >
        <p className="text-2xl font-semibold text-white sm:text-3xl">Aura</p>
        <p className="mt-1 text-sm tracking-wide text-white/60">
          is here for you
        </p>
      </motion.div>
    </div>
  );
}
