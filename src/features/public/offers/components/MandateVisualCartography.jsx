"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const POINTS = [
  { label: "Google Local", x: "22%", y: "28%", delay: 0 },
  { label: "Recherche organique", x: "68%", y: "24%", delay: 1.2 },
  { label: "Réponses IA", x: "72%", y: "62%", delay: 2.5 },
  { label: "Cohérence NAP", x: "26%", y: "68%", delay: 3.8 },
];

function ScrambledText({ text, delay }) {
  const [displayText, setDisplayText] = useState("");
  const chars = "!<>-_\\\\/[]{}—=+*^?#_";
  
  useEffect(() => {
    let timeoutId;
    let intervalId;
    
    timeoutId = setTimeout(() => {
      let iteration = 0;
      intervalId = setInterval(() => {
        setDisplayText((prev) => 
          text.split("").map((letter, index) => {
            if (index < iteration) {
              return text[index];
            }
            return chars[Math.floor(Math.random() * chars.length)];
          }).join("")
        );
        
        if (iteration >= text.length) {
          clearInterval(intervalId);
        }
        
        iteration += 1 / 3;
      }, 30);
    }, delay * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, delay]);

  return <span>{displayText}</span>;
}

export default function MandateVisualCartography() {
  return (
    <div className="relative flex items-center justify-center rounded-2xl border border-white/8 bg-[#0a0a0a] p-6 min-h-[360px] overflow-hidden group">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(91,115,255,0.06)_0%,transparent_70%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

      <div className="relative h-[280px] w-[280px] sm:h-[300px] sm:w-[300px]">
        {/* Radar Rings */}
        {[0.9, 0.65, 0.4].map((s, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#5b73ff]/[0.15]"
            style={{ width: `${s * 100}%`, height: `${s * 100}%` }}
          />
        ))}

        {/* Crosshairs */}
        <div className="absolute left-0 top-1/2 h-[1px] w-full bg-[#5b73ff]/10" />
        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[#5b73ff]/10" />

        {/* Center Node */}
        <div className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full bg-[#5b73ff] shadow-[0_0_20px_rgba(91,115,255,1)] z-10" />

        {/* Sweeping Scanner */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          className="absolute inset-[5%] rounded-full z-0 origin-center"
          style={{
            background: "conic-gradient(from 0deg, transparent 270deg, rgba(91,115,255,0.05) 330deg, rgba(91,115,255,0.5) 360deg)",
          }}
        />

        {/* Data Points */}
        {POINTS.map((p, i) => (
          <motion.div
            key={p.label}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.1, delay: p.delay }}
            className="absolute flex items-center gap-2 z-20"
            style={{ left: p.x, top: p.y }}
          >
            <div className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5b73ff] opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_#ffffff]" />
            </div>
            <span className="text-[10px] font-mono font-bold text-[#5b73ff] whitespace-nowrap bg-[#0a0a0a]/80 px-1.5 py-0.5 border border-[#5b73ff]/20 rounded backdrop-blur-sm">
              <ScrambledText text={p.label} delay={p.delay} />
            </span>
          </motion.div>
        ))}
      </div>

      <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[10px] text-[#5b73ff]/40 font-mono">
        <span>[SYS.SCAN_ACTIVE]</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5b73ff] animate-pulse shadow-[0_0_8px_#5b73ff]" />
          ANALYSIS_MODE
        </span>
      </div>
    </div>
  );
}
