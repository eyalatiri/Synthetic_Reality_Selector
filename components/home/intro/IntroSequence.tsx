"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import SceneExterior from "./SceneExterior";
import SceneEntrance from "./SceneEntrance";
import SceneReception from "./SceneReception";

const SCENES = [SceneExterior, SceneEntrance, SceneReception];

// How long each scene stays on screen before advancing, in ms.
const SCENE_DURATIONS = [4200, 3400, 3400];

interface IntroSequenceProps {
  onComplete: () => void;
}

export default function IntroSequence({ onComplete }: IntroSequenceProps) {
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    if (sceneIndex >= SCENES.length) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => {
      setSceneIndex((i) => i + 1);
    }, SCENE_DURATIONS[sceneIndex]);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex]);

  const CurrentScene = SCENES[Math.min(sceneIndex, SCENES.length - 1)];

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={sceneIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0"
        >
          <CurrentScene />
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {SCENES.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === sceneIndex
                ? "w-6 bg-accent"
                : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Skip button */}
      <button
        onClick={onComplete}
        aria-label="Skip introduction"
        className="absolute right-6 top-6 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Skip intro
        <SkipForward size={14} />
      </button>
    </div>
  );
}
