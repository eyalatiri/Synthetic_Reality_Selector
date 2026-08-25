"use client";

import { motion } from "framer-motion";

// TODO: Replace with a real entrance/lobby-door photo of PwC Tunisia.
// Reusing the exterior shot, more zoomed and blurred, as a stand-in.
const ENTRANCE_IMAGE = "/images/recep.jpg";

export default function SceneEntrance() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <motion.img
        src={ENTRANCE_IMAGE}
        alt=""
        className="h-full w-full object-cover"
        initial={{ scale: 1.15, filter: "blur(4px)" }}
        animate={{ scale: 1.3, filter: "blur(0px)" }}
        transition={{ duration: 3.2, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-black/50" />

      {/* Glass door panels — start closed, slide open to reveal the entrance */}
      <motion.div
        className="absolute inset-y-0 left-0 w-1/2 border-r border-white/20 bg-white/5 backdrop-blur-md"
        initial={{ x: "0%" }}
        animate={{ x: "-100%" }}
        transition={{ delay: 1.1, duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent/70 to-transparent" />
      </motion.div>
      <motion.div
        className="absolute inset-y-0 right-0 w-1/2 border-l border-white/20 bg-white/5 backdrop-blur-md"
        initial={{ x: "0%" }}
        animate={{ x: "100%" }}
        transition={{ delay: 1.1, duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
      >
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-accent/70 to-transparent" />
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.8 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 text-lg text-white/90"
      >
        Welcome inside.
      </motion.p>
    </div>
  );
}
