"use client";

import { motion } from "framer-motion";

// TODO: Replace with a real reception/lobby interior photo of PwC Tunisia
// (warm lighting, plants, modern furniture, digital displays).
const RECEPTION_IMAGE = "/images/techlab.jpg";

export default function SceneReception() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <motion.img
        src={RECEPTION_IMAGE}
        alt=""
        className="h-full w-full object-cover"
        initial={{ scale: 1.05, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: "easeOut" }}
      />
      {/* Warm interior lighting tint */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-orange-900/15" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center"
      >
        <p className="text-lg text-white/90">Someone will be right with you.</p>
      </motion.div>
    </div>
  );
}
