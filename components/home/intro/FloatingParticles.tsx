"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Particle {
  id: number;
  left: number; // percentage
  size: number; // px
  duration: number; // seconds
  delay: number; // seconds
}

/**
 * Subtle floating particles for atmosphere.
 * Generated client-side only (after mount) to avoid SSR/CSR hydration
 * mismatches from Math.random().
 */
export default function FloatingParticles({ count = 16 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 8 + Math.random() * 10,
        delay: Math.random() * 6,
      }))
    );
  }, [count]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-white/40"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            bottom: "-5%",
          }}
          animate={{
            y: ["0%", "-120vh"],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
