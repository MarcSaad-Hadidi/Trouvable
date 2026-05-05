"use client";

import { motion } from "framer-motion";

const STEPS = [
  { title: "Cadrage", desc: "Objectifs, territoire, contraintes, interlocuteur unique." },
  { title: "Preuve", desc: "État initial documenté, repères mesurables." },
  { title: "Exécution", desc: "Nous appliquons ; vous validez ce qui est convenu." },
  { title: "Compte rendu", desc: "Ce qui est fait, ce qui reste, ce que nous observons." },
  { title: "Poursuite", desc: "Clôture du mandat ou passage au pilotage récurrent." },
];

export default function OffersTimeline() {
  return (
    <section className="border-t border-white/[0.05] bg-[#0a0a0a] px-6 py-24 sm:px-10 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="mb-4 text-center text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]"
        >
          Notre cadre de travail
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.06 }}
          className="mb-6 text-center text-[clamp(26px,3.5vw,42px)] font-bold tracking-[-0.04em]"
        >
          Comment nous travaillons ensemble
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mx-auto mb-20 max-w-xl text-center text-[15px] leading-relaxed text-[#888]"
        >
          Pas de promesse de « première place » : une exécution disciplinée, des livrables vérifiables et une lecture honnête des résultats.
        </motion.p>

        <div className="relative">
          {/* Static background line */}
          <div className="absolute left-[23px] top-0 h-full w-px bg-white/[0.04] md:left-1/2 md:-translate-x-1/2" />
          
          {/* Animated glowing progress line */}
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: "100%" }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute left-[23px] top-0 w-px bg-gradient-to-b from-transparent via-[#5b73ff]/80 to-transparent md:left-1/2 md:-translate-x-1/2 shadow-[0_0_12px_rgba(91,115,255,0.8)]"
          />

          <div className="space-y-12 md:space-y-0">
            {STEPS.map((step, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24, x: isLeft ? -20 : 20 }}
                  whileInView={{ opacity: 1, y: 0, x: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className={`relative flex items-start gap-8 md:gap-0 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"} md:items-center md:py-10`}
                >
                  <div className={`hidden md:flex md:w-1/2 ${isLeft ? "md:justify-end md:pr-16" : "md:justify-start md:pl-16"}`}>
                    <div className="group relative max-w-[340px] rounded-2xl border border-white/6 bg-[#0d0d0d] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[#5b73ff]/30 hover:bg-white/[0.03] hover:shadow-[0_8px_30px_rgba(91,115,255,0.06)]">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#5b73ff]/[0.02] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="relative z-10">
                        <div className="mb-2 text-[15px] font-semibold text-white transition-colors group-hover:text-[#aebaff]">{step.title}</div>
                        <p className="text-[14px] leading-[1.6] text-[#888] transition-colors group-hover:text-[#a0a0a0]">{step.desc}</p>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#080808] md:absolute md:left-1/2 md:-translate-x-1/2 shadow-xl">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true, amount: 0.8 }}
                      transition={{ duration: 0.4, delay: 0.4 }}
                      className="absolute inset-0 rounded-full border border-[#5b73ff]/40 bg-[#5b73ff]/10"
                    />
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true, amount: 0.8 }}
                      transition={{ duration: 1, delay: 0.6, repeat: Infinity, repeatType: "reverse" }}
                      className="absolute inset-0 rounded-full shadow-[0_0_15px_rgba(91,115,255,0.4)]"
                    />
                    <span className="relative z-10 text-[12px] font-mono font-bold text-[#aebaff]">{String(i + 1).padStart(2, "0")}</span>
                  </div>

                  <div className="flex-1 md:hidden pt-1">
                    <div className="text-[15px] font-semibold text-white mb-1.5">{step.title}</div>
                    <p className="text-[14px] leading-[1.6] text-[#888]">{step.desc}</p>
                  </div>

                  <div className="hidden md:block md:w-1/2" />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
