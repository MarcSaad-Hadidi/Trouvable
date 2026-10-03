'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const HERO_PLATFORMS = [
  "Google AI Overviews",
  "ChatGPT",
  "Claude",
  "Google",
  "Perplexity",
  "Gemini",
  "Copilot",

];

export default function HeroPlatformWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % HERO_PLATFORMS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="relative inline-flex min-h-[1.4em] items-center justify-center overflow-visible px-2 py-2">
      {/* Invisible spacer to maintain layout height and width based on longest word */}
      <span className="pointer-events-none opacity-0 select-none whitespace-nowrap" aria-hidden="true">
        Google AI Overviews
      </span>

      <AnimatePresence mode="wait">
        <motion.span
          key={HERO_PLATFORMS[index]}
          initial={{ opacity: 0, y: 15, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -15, filter: 'blur(8px)' }}
          transition={{
            duration: 0.6,
            ease: [0.23, 1, 0.32, 1] // Premium cubic bezier
          }}
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap bg-gradient-to-r from-[#5b73ff] via-[#7b8fff] to-[#b79cff] bg-clip-text text-transparent leading-tight"
        >
          {HERO_PLATFORMS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
