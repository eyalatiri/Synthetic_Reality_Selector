"use client";

import { motion } from "framer-motion";
import { AudioLines, ScanFace, DatabaseZap } from "lucide-react";
import FeatureCard from "./FeatureCard";

const FEATURES = [
  {
    icon: AudioLines,
    title: "Natural voice conversations",
    description:
      "Speak in French, English, or Arabic and get responses in real time — no menus, no typing required.",
  },
  {
    icon: ScanFace,
    title: "Photorealistic AI avatar",
    description:
      "A lifelike digital human brings every conversation to life, with expressions and timing that feel like talking to a colleague.",
  },
  {
    icon: DatabaseZap,
    title: "Enterprise knowledge assistant",
    description:
      "Every answer is grounded in PwC Tunisia's internal policies and documents, retrieved live from your knowledge base.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-neutral-50 px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-16 max-w-xl text-center"
        >
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
            Built for the way you work
          </h2>
          <p className="mt-3 text-neutral-500">
            Everything Aura needs to have a real conversation with you —
            hearing, appearing, and knowing.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.title} index={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
