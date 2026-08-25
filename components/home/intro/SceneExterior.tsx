"use client";

import { motion } from "framer-motion";
import FloatingParticles from "./FloatingParticles";

// Reusing the confirmed PwC Tunisia building photo for the exterior shot.
// Swap for a wider, golden-hour establishing shot when available.
const EXTERIOR_IMAGE = "/images/1763457275895.jpg";

export default function SceneExterior() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <motion.img
        src={EXTERIOR_IMAGE}
        alt=""
        className="h-full w-full object-cover"
        initial={{ scale: 1 }}
        animate={{ scale: 1.08 }}
        transition={{ duration: 4.5, ease: "easeOut" }}
      />

      {/* Warm morning-light gradient + dark overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-orange-900/20" />
      <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />

      <FloatingParticles count={14} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center"
      >
        <p className="text-xs font-medium tracking-[0.3em] text-white/60">
          PWC TUNISIA
        </p>
        <p className="mt-2 text-lg text-white/90">Good morning.</p>
      </motion.div>
    </div>
  );
}
