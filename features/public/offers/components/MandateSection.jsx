"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import ContactButton from "@/features/public/shared/ContactButton";
import Link from "next/link";

export default function MandateSection({
  id,
  number,
  title,
  subtitle,
  accent,
  reversed = false,
  hook,
  forWho,
  when,
  outcome,
  bullets,
  cta,
  secondaryLink,
  children,
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-white/[0.05] px-6 py-24 sm:px-10 sm:py-32"
      style={number === "02" ? { backgroundColor: "#0a0a0a" } : undefined}
    >
      <div className="mx-auto max-w-[1100px]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="mb-4 flex items-center gap-4"
        >
          <span className="font-mono text-[clamp(40px,5vw,64px)] font-bold leading-none tracking-[-0.06em]" style={{ color: `${accent}30` }}>
            {number}
          </span>
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${accent}25, transparent)` }} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, delay: 0.06 }}
          className="mb-3 text-[clamp(28px,4vw,48px)] font-bold leading-[1.06] tracking-[-0.04em]"
        >
          {title}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mb-14 max-w-2xl text-[16px] leading-[1.6] text-[#a0a0a0]"
        >
          {subtitle}
        </motion.p>

        <div className={`grid gap-8 lg:grid-cols-2 lg:gap-12 items-start mb-16 ${reversed ? "" : ""}`}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className={`flex flex-col justify-center ${reversed ? "lg:order-2" : ""}`}
          >
            <p className="mb-8 text-[15px] leading-[1.7] text-[#b0b0b0]">{hook}</p>

            <ul className="mb-8 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[14px] text-[#999]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: `${accent}90` }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <ContactButton className="rounded-lg bg-white px-6 py-3 text-[13px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                {cta}
              </ContactButton>
              {secondaryLink && (
                <Link href={secondaryLink.href} className="flex items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-white" style={{ color: `${accent}cc` }}>
                  {secondaryLink.label} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className={reversed ? "lg:order-1" : ""}
          >
            {children}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 sm:grid-cols-3"
        >
          {[
            { label: "Pour qui", value: forWho },
            { label: "Quand", value: when },
            { label: "Résultat attendu", value: outcome },
          ].map((block) => (
            <div
              key={block.label}
              className="rounded-xl border border-white/6 bg-white/[0.02] p-5 transition-colors hover:border-white/10"
            >
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: `${accent}80` }}>
                {block.label}
              </div>
              <p className="text-[13px] leading-[1.6] text-[#999]">{block.value}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
