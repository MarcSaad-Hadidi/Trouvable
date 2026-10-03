"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

const STEPS = [
  { label: "Structuration des données", status: "done" },
  { label: "Enrichissement contenu", status: "done" },
  { label: "Validation qualité", status: "active" },
  { label: "Déploiement sécurisé", status: "pending" },
  { label: "Contrôle d\u2019intégrité", status: "pending" },
];

export default function MandateVisualImplementation() {
  return (
    <div className="relative rounded-2xl border border-white/8 bg-[#0a0a0a] p-6 sm:p-8 min-h-[360px] overflow-hidden group">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(52,211,153,0.06)_0%,transparent_60%)] opacity-50 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative flex flex-col gap-0 z-10">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">Pipeline d&apos;exécution</span>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]">
            3/5 validés
          </span>
        </div>

        {STEPS.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.1, type: "spring", stiffness: 100 }}
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center relative">
                {step.status === "done" && (
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" style={{ animationDuration: '3s' }} />
                    <CheckCircle2 className="relative z-10 h-5 w-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  </div>
                )}
                {step.status === "active" && (
                  <div className="relative">
                    <Loader2 className="relative z-10 h-5 w-5 text-[#5b73ff] animate-spin drop-shadow-[0_0_8px_rgba(91,115,255,0.6)]" style={{ animationDuration: "2s" }} />
                  </div>
                )}
                {step.status === "pending" && <Circle className="h-5 w-5 text-white/10" />}
              </div>
              <div className="flex flex-1 items-center justify-between py-3 group/item">
                <span className={`text-[13px] font-medium transition-colors ${step.status === "done" ? "text-white/90" : step.status === "active" ? "text-white" : "text-white/30"}`}>
                  {step.label}
                </span>
                <span className={`rounded px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.06em] transition-colors ${
                  step.status === "done" ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" :
                  step.status === "active" ? "bg-[#5b73ff]/15 text-[#aebaff] border border-[#5b73ff]/20" :
                  "bg-white/[0.02] text-white/20 border border-white/5"
                }`}>
                  {step.status === "done" ? "Validé" : step.status === "active" ? "Actif" : "À venir"}
                </span>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div className="relative ml-[9px] h-4 w-px overflow-hidden bg-white/[0.04]">
                {step.status === "done" && (
                  <motion.div
                    initial={{ height: 0 }}
                    whileInView={{ height: "100%" }}
                    viewport={{ once: true, amount: 0.1 }}
                    transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                    className="absolute top-0 w-full bg-emerald-400/50 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                  />
                )}
              </div>
            )}
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.5, delay: 1 }}
          className="mt-6 pt-5 border-t border-white/5"
        >
          <div className="flex items-center justify-between text-[11px] text-white/40 mb-3">
            <span className="uppercase tracking-widest font-semibold text-[9px]">Progression</span>
            <span className="font-mono text-emerald-400">60%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-white/[0.04] overflow-hidden relative border border-white/5">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: "60%" }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 1.5, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-emerald-500/50 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            >
              <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30" />
            </motion.div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-5 left-6 right-6 flex items-center justify-between text-[10px] text-emerald-400/40 font-mono">
        <span>[SYS.DEPLOY_MERGE]</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          EXECUTION_ACTIVE
        </span>
      </div>
    </div>
  );
}
