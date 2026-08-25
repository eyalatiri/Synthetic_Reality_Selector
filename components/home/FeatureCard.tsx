"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export default function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: 0.55,
        delay: index * 0.12,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6 }}
      className="group rounded-3xl border border-black/5 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow duration-300 hover:border-accent/20 hover:shadow-[0_20px_40px_-12px_rgba(255,109,0,0.18)]"
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
        <Icon size={22} strokeWidth={1.75} />
      </div>
      <h3 className="text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-500">
        {description}
      </p>
    </motion.div>
  );
}
