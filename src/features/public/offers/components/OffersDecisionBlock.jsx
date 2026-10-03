"use client";

import { motion } from "framer-motion";
import { ArrowRight, Search, ShieldCheck, TrendingUp } from "lucide-react";

const SCENARIOS = [
  {
    icon: Search,
    situation: "Vous devez clarifier avant d\u2019agir",
    detail: "Vous n\u2019avez pas de diagnostic fiable ou les signaux sont contradictoires.",
    mandate: "Cartographie stratégique",
    anchor: "cartographie-strategique",
    accent: "#5b73ff",
  },
  {
    icon: ShieldCheck,
    situation: "Vous savez quoi faire, rien n\u2019est exécuté",
    detail: "Le diagnostic existe mais la mise en \u0153uvre n\u2019avance pas faute de bande passante.",
    mandate: "Mandat d\u2019implémentation",
    anchor: "mandat-implementation",
    accent: "#34d399",
  },
  {
    icon: TrendingUp,
    situation: "Vous voulez tenir la cadence",
    detail: "L\u2019implémentation est faite, mais les moteurs changent et personne ne surveille.",
    mandate: "Pilotage continu",
    anchor: "pilotage-continu",
    accent: "#a78bfa",
  },
];

export default function OffersDecisionBlock() {
  return (
    <section className="border-t border-white/[0.05] px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]"
        >
          Choisir le bon mandat
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.06 }}
          className="mb-14 text-center text-[clamp(26px,3.5vw,42px)] font-bold tracking-[-0.04em]"
        >
          Quelle est votre situation ?
        </motion.h2>

        <div className="grid gap-5 md:grid-cols-3">
          {SCENARIOS.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.a
                key={s.anchor}
                href={`#${s.anchor}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="group relative flex flex-col rounded-2xl border border-white/7 bg-[#0d0d0d] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-white/15 cursor-pointer"
              >
                <div className="absolute top-0 inset-x-0 h-px opacity-0 transition-opacity group-hover:opacity-100" style={{ background: `linear-gradient(90deg, transparent, ${s.accent}50, transparent)` }} />

                <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl border bg-white/[0.03] transition-colors group-hover:bg-white/[0.06]" style={{ borderColor: `${s.accent}20` }}>
                  <Icon className="h-5 w-5" style={{ color: s.accent }} />
                </div>

                <h3 className="mb-2 text-[15px] font-semibold text-white leading-snug">{s.situation}</h3>
                <p className="mb-6 flex-1 text-[13px] leading-[1.6] text-[#888]">{s.detail}</p>

                <div className="flex items-center gap-2 text-[13px] font-semibold transition-colors group-hover:text-white" style={{ color: s.accent }}>
                  {s.mandate} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
