"use client";

import { motion } from "framer-motion";

const CHANNELS = [
  { name: "Google Local", status: "stable", delta: "+4%", color: "#34d399" },
  { name: "Réponses IA", status: "+12%", delta: "↑", color: "#a78bfa" },
  { name: "Signal NAP", status: "conforme", delta: "→", color: "#5b73ff" },
];

const TREND_PATH = "M 0 50 Q 15 42, 30 44 T 60 38 T 90 35 T 120 30 T 150 28 T 180 22 T 210 20 T 240 18";

export default function MandateVisualContinuous() {
  return (
    <div className="relative rounded-2xl border border-white/8 bg-[#0a0a0a] p-6 sm:p-8 min-h-[360px] overflow-hidden group">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.06)_0%,transparent_60%)] opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative z-10">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">Pilotage mensuel</span>
          <span className="rounded-full border border-[#a78bfa]/20 bg-[#a78bfa]/10 px-2.5 py-1 text-[10px] font-semibold text-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.2)]">
            Mandat actif
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#a78bfa]/[0.02] to-transparent translate-x-[-100%] animate-[shimmer_3s_infinite]" />
          <div className="mb-2 flex justify-between items-end">
            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/30">
              Tendance recommandation
            </div>
            <div className="text-[9px] font-mono text-[#a78bfa]/70">6 MOIS</div>
          </div>
          <svg viewBox="0 0 240 60" className="w-full h-[60px]" preserveAspectRatio="none">
            <motion.path
              d={TREND_PATH}
              fill="none"
              stroke="url(#trendGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 2, delay: 0.4, ease: "easeInOut" }}
              style={{ filter: "drop-shadow(0 4px 6px rgba(167,139,250,0.4))" }}
            />
            <defs>
              <linearGradient id="trendGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#5b73ff" stopOpacity="0.4" />
                <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        <div className="space-y-2.5">
          {CHANNELS.map((ch, i) => (
            <motion.div
              key={ch.name}
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.4, delay: 0.6 + i * 0.15, type: "spring", stiffness: 100 }}
              className="group/item flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 transition-colors hover:border-[#a78bfa]/20 hover:bg-[#a78bfa]/[0.02]"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-2 w-2 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ backgroundColor: ch.color, animationDelay: `${i * 0.3}s` }} />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ch.color, boxShadow: `0 0 6px ${ch.color}` }} />
                </div>
                <span className="text-[12px] font-medium text-white/70 transition-colors group-hover/item:text-white/90">{ch.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold" style={{ color: ch.color }}>{ch.status}</span>
                <span className="text-[10px] text-white/30 font-mono">{ch.delta}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.4, delay: 1.2 }}
          className="mt-6 flex items-center justify-between rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/[0.05] px-4 py-3 shadow-[0_0_15px_rgba(167,139,250,0.05)]"
        >
          <span className="text-[11px] text-white/60 font-medium">Prochain compte rendu</span>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#a78bfa] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#a78bfa]" />
            </span>
            <span className="text-[11px] font-bold text-[#a78bfa]">15 jours</span>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[10px] text-[#a78bfa]/40 font-mono">
        <span>[SYS.MONITOR_ITERATE]</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a78bfa] animate-pulse shadow-[0_0_8px_#a78bfa]" />
          SUIVI_CONTINU
        </span>
      </div>
    </div>
  );
}
