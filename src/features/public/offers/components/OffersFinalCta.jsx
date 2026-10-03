"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import ContactButton from "@/features/public/shared/ContactButton";
import Link from "next/link";

export default function OffersFinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.05] px-6 py-28 sm:px-10 sm:py-36">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] bg-[radial-gradient(ellipse,rgba(91,115,255,0.08)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-[680px] text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]"
        >
          Prochaine étape
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, delay: 0.06 }}
          className="mb-6 text-[clamp(28px,4vw,48px)] font-bold leading-[1.06] tracking-[-0.04em]"
        >
          Un appel de cadrage.<br />
          <span className="bg-gradient-to-r from-white/50 to-white/25 bg-clip-text text-transparent">Zéro engagement.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="mx-auto mb-10 max-w-lg text-[16px] leading-[1.65] text-[#a0a0a0]"
        >
          Nous identifions le mandat adapté, le périmètre et le rythme, avant tout engagement. Chaque mandat est unique, nous cadrons le vôtre.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-[15px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8] hover:shadow-[0_20px_60px_rgba(255,255,255,0.06)]">
            Planifier un appel de cadrage <ArrowRight className="h-4 w-4" />
          </ContactButton>
          <Link
            href="/methodologie"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-8 py-4 text-[15px] font-medium text-[#a0a0a0] transition hover:border-white/25 hover:text-white"
          >
            Notre méthode d&apos;exécution
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
