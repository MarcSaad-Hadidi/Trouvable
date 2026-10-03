"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Search, ShieldCheck, TrendingUp } from "lucide-react";
import ContactButton from "@/features/public/shared/ContactButton";
import Link from "next/link";

const CARDS = [
  { icon: Search, label: "Cartographie stratégique", desc: "Comprendre avant d\u2019agir", accent: "#5b73ff", anchor: "cartographie-strategique" },
  { icon: ShieldCheck, label: "Mandat d\u2019implémentation", desc: "Exécuter sans compromis", accent: "#34d399", anchor: "mandat-implementation" },
  { icon: TrendingUp, label: "Pilotage continu", desc: "Tenir la cadence", accent: "#a78bfa", anchor: "pilotage-continu" },
];

export default function OffersHero() {
  return (
    <section className="relative mt-[58px] overflow-hidden px-6 pb-0 pt-[80px] sm:pt-[110px]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_25%,transparent_100%)]" />
      <div className="pointer-events-none absolute left-1/2 top-[-140px] z-0 h-[700px] w-[1000px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(91,115,255,0.13)_0%,transparent_56%)]" />
      <div className="pointer-events-none absolute right-[-200px] top-[100px] z-0 h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(167,139,250,0.06)_0%,transparent_70%)]" />

      <div className="relative z-[1] mx-auto flex w-full max-w-[880px] flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]"
        >
          Mandats d&apos;exécution
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08 }}
          className="text-[clamp(36px,6.5vw,80px)] font-bold leading-[1.04] tracking-[-0.045em]"
        >
          <span className="block">Trois niveaux d&apos;engagement.</span>
          <span className="block bg-gradient-to-b from-white/50 to-white/20 bg-clip-text text-transparent">
            Une même exigence.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mb-10 mt-8 max-w-[560px] text-[17px] leading-[1.65] text-[#a0a0a0]"
        >
          Cartographie pour décider. Implémentation pour livrer. Pilotage pour tenir la cadence.
          Le travail est fait pour vous, sur mandat cadré.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-10 flex flex-wrap items-center justify-center gap-5 text-[13px] font-medium text-white/40"
        >
          {["Périmètre contractualisé", "Livrables documentés", "Interlocuteur dédié"].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400/80" /> {t}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.38 }}
          className="flex flex-wrap justify-center gap-3"
        >
          <ContactButton className="rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
            Planifier un appel de cadrage
          </ContactButton>
          <Link href="/methodologie" className="rounded-lg border border-white/15 px-7 py-3.5 text-sm font-medium text-[#a0a0a0] transition hover:-translate-y-px hover:border-white/30 hover:text-white">
            Notre méthode ?
          </Link>
        </motion.div>
      </div>

      <div className="relative z-[1] mx-auto mt-20 grid max-w-[960px] gap-4 sm:grid-cols-3 pb-10">
        {CARDS.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.a
              key={c.anchor}
              href={`#${c.anchor}`}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.5 + i * 0.1 }}
              className="group relative overflow-hidden rounded-2xl border border-white/8 bg-[#0d0d0d] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-white/15 cursor-pointer block"
            >
              <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c.accent}40, transparent)` }} />
              <div className="flex items-center gap-3 mb-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border bg-white/[0.03]" style={{ borderColor: `${c.accent}25`, backgroundColor: `${c.accent}08` }}>
                  <Icon className="h-4 w-4" style={{ color: c.accent }} />
                </div>
                <span className="text-sm font-semibold text-white">{c.label}</span>
              </div>
              <p className="text-[13px] text-[#888] leading-relaxed">{c.desc}</p>
              <ArrowRight className="absolute bottom-6 right-6 h-4 w-4 text-white/15 transition-all group-hover:text-white/40 group-hover:translate-x-0.5" />
            </motion.a>
          );
        })}
      </div>
    </section>
  );
}
