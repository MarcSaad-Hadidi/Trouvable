"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import ContactButton from "@/features/public/shared/ContactButton";
import Link from "next/link";
import { ArrowRight, Bot, Search, BarChart3, Lock, ShieldCheck, BookOpen, Eye, ChevronRight } from "lucide-react";

const EVIDENCE = [
  { num: "01", accent: "#a78bfa", icon: Bot, title: "Part de voix IA", value: "Réponses IA", desc: "Combien de fois ChatGPT, Claude ou Gemini vous cite spontanément sur les requêtes de votre marché, et à quel rang." },
  { num: "02", accent: "#5b73ff", icon: Search, title: "Domination Google Local", value: "Pack local", desc: "Position sur le pack local, déclenchement des actions itinéraire / appel / clic, la conversion organique pure." },
  { num: "03", accent: "#34d399", icon: BarChart3, title: "Conversion réelle", value: "Leads entrants", desc: "Le seul indicateur qui compte : les prises de contact effectives générées par votre signal public." },
];

const PROCESS_MILESTONES = [
  { phase: "Cartographie", desc: "Audit de vos signaux actuels, identification des failles SEO et GEO, rapport stratégique." },
  { phase: "Déploiement", desc: "Structuration Schema.org, configuration llms.txt, alignement des annuaires, enrichissement sémantique." },
  { phase: "Mesure", desc: "Relevés périodiques, suivi des positions Map Pack, couverture IA, rapports vérifiables." },
  { phase: "Itération", desc: "Ajustements continus basés sur les données réelles, pas sur des projections." },
];

export default function CasesPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,#080808,#050505)]" />

      <main>
        {/* HERO - editorial, scroll-reactive */}
        <motion.section ref={heroRef} style={{ opacity: heroOpacity, scale: heroScale }} className="relative mt-[58px] overflow-hidden px-6 pt-[90px] pb-28 sm:pt-[120px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(167,139,250,0.06),transparent_60%)]" />
          <div className="relative z-[1] mx-auto max-w-[1100px] grid gap-16 lg:grid-cols-[1fr_320px] items-end">
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a78bfa]">Résultats documentés</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(40px,6.5vw,80px)] font-bold leading-[1.02] tracking-[-0.05em] mb-8">
                La preuve<br />par<br /><span className="bg-gradient-to-r from-[#a78bfa]/70 to-[#5b73ff]/60 bg-clip-text text-transparent">l&apos;exécution.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }} className="max-w-[480px] text-[17px] leading-[1.7] text-[#a0a0a0]">
                Par exigence de confidentialité, nous n&apos;exposons ni les noms ni les chiffres de nos partenaires publiquement. Mais notre rigueur de mesure est documentée.
              </motion.p>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.2 }} className="hidden lg:block relative rounded-2xl border border-[#a78bfa]/15 bg-[#0a0a0a] p-7 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-[#a78bfa]/40 to-transparent" />
              <Lock className="mb-4 h-5 w-5 text-[#a78bfa]/50" />
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/20 mb-3">Politique de confidentialité</div>
              <div className="space-y-2.5 text-[12px] text-[#888]">
                <div className="flex items-center gap-2"><ShieldCheck className="h-3 w-3 shrink-0 text-[#a78bfa]/60" /> Noms et chiffres protégés</div>
                <div className="flex items-center gap-2"><Eye className="h-3 w-3 shrink-0 text-[#a78bfa]/60" /> Données réelles sur entretien</div>
                <div className="flex items-center gap-2"><BookOpen className="h-3 w-3 shrink-0 text-[#a78bfa]/60" /> Dossier-type consultable</div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* EVIDENCE BLOCKS - horizontal reveal */}
        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1100px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-16">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#a78bfa]">Ce que nous mesurons</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Trois couches de preuve</h2>
            </motion.div>
            <div className="space-y-0">
              {EVIDENCE.map((e, i) => {
                const Icon = e.icon;
                return (
                  <motion.div
                    key={e.num}
                    initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.6, delay: i * 0.08 }}
                    className="group"
                  >
                    {i > 0 && <div className="mx-auto h-px max-w-[85%] bg-gradient-to-r from-transparent via-white/6 to-transparent" />}
                    <div className="grid items-center gap-6 py-12 lg:grid-cols-[80px_200px_1fr] lg:gap-10">
                      <span className="hidden lg:block font-mono text-[clamp(40px,4vw,64px)] font-bold leading-none tracking-[-0.06em]" style={{ color: `${e.accent}15` }}>{e.num}</span>
                      <div className="flex items-center gap-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border bg-white/[0.03]" style={{ borderColor: `${e.accent}20` }}>
                          <Icon className="h-5 w-5" style={{ color: e.accent }} />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: `${e.accent}70` }}>{e.value}</div>
                          <div className="text-[16px] font-bold text-white">{e.title}</div>
                        </div>
                      </div>
                      <p className="text-[14px] leading-[1.65] text-[#888] group-hover:text-white/70 transition-colors max-w-lg">{e.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PROCESS - cinematic milestones */}
        <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[900px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-16 text-center">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400">Le cycle d&apos;un mandat</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">De l&apos;audit au résultat</h2>
            </motion.div>
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-emerald-400/30 via-[#5b73ff]/20 to-transparent sm:left-8" />
              {PROCESS_MILESTONES.map((m, i) => (
                <motion.div key={m.phase} initial={{ opacity: 0, y: 20, x: -10 }} whileInView={{ opacity: 1, y: 0, x: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.1 }} className="relative flex gap-6 pb-12 sm:gap-10">
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-400/25 bg-[#0a0a0a] sm:h-16 sm:w-16">
                      <span className="font-mono text-[12px] font-bold text-emerald-400 sm:text-[14px]">{String(i + 1).padStart(2, "0")}</span>
                    </div>
                  </div>
                  <div className="pt-2 sm:pt-4">
                    <h3 className="mb-2 text-[16px] font-bold text-white sm:text-[18px]">{m.phase}</h3>
                    <p className="max-w-md text-[13px] leading-[1.65] text-[#888]">{m.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* DOSSIER-TYPE - dramatic CTA */}
        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="mx-auto max-w-[900px]">
            <div className="relative overflow-hidden rounded-2xl border border-[#a78bfa]/15 bg-[#0a0a0a] shadow-[0_30px_80px_rgba(167,139,250,0.06)]">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#a78bfa] via-[#5b73ff] to-emerald-400" />
              <div className="absolute bottom-0 right-0 p-8 opacity-[0.02]">
                <BookOpen className="h-48 w-48 text-white" />
              </div>
              <div className="relative z-10 grid gap-8 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-14">
                <div>
                  <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[#a78bfa]">Dossier de référence</div>
                  <h2 className="mb-4 text-[clamp(22px,3vw,32px)] font-bold tracking-[-0.03em] leading-snug">Consultez un dossier d&apos;exécution complet.</h2>
                  <p className="max-w-md text-[14px] leading-[1.65] text-[#888]">
                    Diagnostic, déploiement, suivi : chaque phase est documentée. Visualisez l&apos;anatomie d&apos;un vrai mandat Trouvable.
                  </p>
                </div>
                <Link href="/etudes-de-cas/dossier-type" className="group inline-flex items-center gap-3 rounded-xl bg-white px-8 py-4 text-[15px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8] hover:shadow-[0_20px_60px_rgba(255,255,255,0.06)]">
                  Ouvrir le dossier <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ACCESS - lock section */}
        <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] bg-[radial-gradient(ellipse,rgba(91,115,255,0.04)_0%,transparent_55%)]" />
          <div className="relative z-10 mx-auto max-w-[660px] text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <Lock className="mx-auto mb-6 h-10 w-10 text-[#888]" />
            </motion.div>
            <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.06 }} className="mb-5 text-[clamp(24px,3.5vw,36px)] font-bold tracking-[-0.03em]">
              Accédez aux données réelles<br />lors d&apos;un premier appel de cadrage.
            </motion.h3>
            <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.12 }} className="mx-auto mb-10 max-w-lg text-[15px] leading-[1.65] text-[#a0a0a0]">
              Un responsable de dossier vous présente de vrais déploiements techniques et compare anonymement votre signal public face à celui de vos concurrents.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.18 }}>
              <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-[15px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8] hover:shadow-[0_20px_60px_rgba(255,255,255,0.06)]">
                Planifier un appel de cadrage <ArrowRight className="h-4 w-4" />
              </ContactButton>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
