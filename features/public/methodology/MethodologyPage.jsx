"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import ContactButton from "@/features/public/shared/ContactButton";
import GeoSeoInjector from "@/features/public/shared/GeoSeoInjector";
import Link from "next/link";
import { ArrowRight, Layers, FileCode2, LineChart, Zap, ShieldCheck, CheckCircle2 } from "lucide-react";
import { SITE_LAST_MODIFIED, SITE_LAST_MODIFIED_ISO, SITE_URL } from "@/lib/site-config";

const STEPS = [
  { icon: Layers, accent: "#5b73ff", num: "01", title: "Audit et cartographie initiale", desc: "Avant d'agir, nous cartographions vos signaux actuels. Nous mesurons l'exactitude de vos profils publics, la qualité technique de votre site et identifions si les algorithmes vous comprennent correctement face à vos concurrents.", deliverables: ["Rapport de diagnostic complet", "Cartographie des signaux publics", "Évaluation de la cohérence IA"] },
  { icon: FileCode2, accent: "#34d399", num: "02", title: "Mise aux normes", desc: "Nos experts structurent vos informations sans perturber votre infrastructure. Nettoyage des incohérences, formats techniques attendus par Google et les moteurs IA, création des contenus nécessaires pour être compris correctement.", deliverables: ["Structuration technique complète", "Nettoyage des informations publiques", "Alignement des formats attendus"] },
  { icon: Zap, accent: "#f59e0b", num: "03", title: "Enrichissement pour les réponses IA", desc: "Nous structurons les spécificités de votre activité pour que les systèmes conversationnels puissent vous comprendre et vous recommander lorsque les internautes posent des questions précises sur votre marché.", deliverables: ["FAQ métier structurées", "Contenus sémantiques ciblés", "Signaux de crédibilité renforcés"] },
  { icon: LineChart, accent: "#a78bfa", num: "04", title: "Boucle de validation et suivi", desc: "Chaque mois, nous vérifions par relevés contrôlés comment vous progressez dans les recommandations organiques. Nous ajustons notre exécution en fonction de données réelles.", deliverables: ["Compte rendu périodique", "Relevés de positionnement", "Plan d'itération ajusté"] },
];

const METHODOLOGY_URL = `${SITE_URL}/methodologie`;
const METHODOLOGY_ARTICLE_SCHEMA = {
  url: METHODOLOGY_URL,
  headline: "Methodologie Trouvable",
  description: "Protocole d execution en 4 etapes: audit, mise aux normes, enrichissement IA et validation continue.",
  datePublished: SITE_LAST_MODIFIED_ISO,
  dateModified: SITE_LAST_MODIFIED_ISO,
  about: ["methodologie d execution", "visibilite Google", "coherence IA"],
  mentions: [`${SITE_URL}/offres`, `${SITE_URL}/notre-mesure`],
};
const METHODOLOGY_HOWTO_SCHEMA = {
  url: METHODOLOGY_URL,
  name: "Comment Trouvable execute un mandat de visibilite",
  description: "Sequence d execution en 4 phases pour deployer et piloter la visibilite Google et IA.",
  steps: STEPS.map((step) => `${step.title}. ${step.desc}`),
  dateModified: SITE_LAST_MODIFIED_ISO,
};

function StepExplorer() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  const Icon = step.icon;

  return (
    <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
      <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 lg:border-r lg:border-white/6 lg:pr-6">
        {STEPS.map((s, i) => (
          <button
            key={s.num}
            onClick={() => setActive(i)}
            className={`group relative flex items-center gap-3 rounded-xl px-4 py-3.5 text-left text-[13px] font-medium transition-all whitespace-nowrap lg:whitespace-normal ${i === active ? "bg-white/[0.06] text-white" : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"}`}
          >
            {i === active && (
              <motion.div layoutId="stepPill" className="absolute inset-0 rounded-xl border bg-white/[0.04]" style={{ borderColor: `${s.accent}30` }} transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />
            )}
            <span className="relative z-10 font-mono text-[11px] font-bold" style={{ color: i === active ? s.accent : undefined }}>{s.num}</span>
            <span className="relative z-10 hidden lg:inline">{s.title}</span>
            <span className="relative z-10 lg:hidden">{s.title.split(" ").slice(0, 2).join(" ")}</span>
          </button>
        ))}
      </div>

      <div className="lg:pl-10">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
            <div className="mb-4 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border bg-white/[0.03]" style={{ borderColor: `${step.accent}25` }}>
                <Icon className="h-5 w-5" style={{ color: step.accent }} />
              </div>
              <div>
                <span className="font-mono text-[11px] font-bold" style={{ color: `${step.accent}80` }}>{step.num}</span>
                <h3 className="text-[18px] font-bold tracking-[-0.02em] text-white">{step.title}</h3>
              </div>
            </div>
            <p className="mb-8 max-w-lg text-[15px] leading-[1.7] text-[#a0a0a0]">{step.desc}</p>

            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: `${step.accent}70` }}>Livrables de cette phase</div>
            <ul className="space-y-2.5">
              {step.deliverables.map((d) => (
                <li key={d} className="flex items-center gap-2.5 text-[13px] text-[#999]">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: `${step.accent}80` }} />
                  {d}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <GeoSeoInjector
        article={METHODOLOGY_ARTICLE_SCHEMA}
        howTo={METHODOLOGY_HOWTO_SCHEMA}
        itemList={{
          id: `${METHODOLOGY_URL}#methodology-steps`,
          name: "Phases de la méthodologie Trouvable",
          pageUrl: METHODOLOGY_URL,
          items: STEPS.map((step) => step.title),
        }}
        baseUrl={SITE_URL}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(91,115,255,0.05),transparent_55%),linear-gradient(to_bottom,#080808,#080808)]" />

      <main>
        <section className="relative mt-[58px] overflow-hidden px-6 pt-[80px] pb-4 sm:pt-[110px]">
          <div className="pointer-events-none absolute left-1/2 top-[-100px] z-0 h-[500px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(91,115,255,0.08)_0%,transparent_60%)]" />
          <div className="relative z-[1] mx-auto max-w-[860px]">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]">
              <ShieldCheck className="h-3.5 w-3.5" /> Protocole d&apos;exécution
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(36px,6vw,72px)] font-bold leading-[1.06] tracking-[-0.045em] mb-6">
              Quatre phases.<br /><span className="bg-gradient-to-b from-white/50 to-white/20 bg-clip-text text-transparent">Zéro improvisation.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }} className="max-w-[580px] text-[17px] leading-[1.65] text-[#a0a0a0]">
              Notre approche est d&apos;une grande rigueur. Chaque mandat suit un protocole défini : audit, correction, enrichissement et validation, avec des livrables vérifiables à chaque étape.
            </motion.p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] uppercase tracking-[0.08em] text-white/35">
              <span>Par Trouvable</span>
              <span aria-hidden>•</span>
              <span>Dernière mise à jour: {SITE_LAST_MODIFIED}</span>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1000px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]">Les quatre phases</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Explorez chaque étape du protocole</h2>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}>
              <StepExplorer />
            </motion.div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1000px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14 text-center">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400">Progression linéaire</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Le flux d&apos;exécution complet</h2>
            </motion.div>
            <div className="relative flex flex-col gap-0">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div key={s.num} initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.5, delay: i * 0.08 }} className="relative flex items-stretch gap-6 pb-2">
                    <div className="flex flex-col items-center">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-[#0d0d0d]" style={{ boxShadow: `0 0 20px ${s.accent}15` }}>
                        <Icon className="h-4 w-4" style={{ color: s.accent }} />
                      </div>
                      {i < STEPS.length - 1 && <div className="flex-1 w-px my-2" style={{ background: `linear-gradient(to bottom, ${s.accent}30, ${STEPS[i + 1].accent}30)` }} />}
                    </div>
                    <div className="pb-10 pt-1.5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[11px] font-bold" style={{ color: `${s.accent}80` }}>{s.num}</span>
                        <h3 className="text-[15px] font-semibold text-white">{s.title}</h3>
                      </div>
                      <p className="max-w-md text-[13px] leading-[1.65] text-[#888]">{s.desc}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {s.deliverables.map((d) => (
                          <span key={d} className="rounded-full border px-3 py-1 text-[10px] font-semibold" style={{ borderColor: `${s.accent}20`, color: `${s.accent}90`, backgroundColor: `${s.accent}08` }}>{d}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[900px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14 text-center">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400">Résultat pour vous</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Ce que cela change pour vous</h2>
            </motion.div>
            <div className="grid gap-5 sm:grid-cols-3">
              {[
                { title: "Gain de temps", desc: "Nous exécutons les tâches techniques. Vous n'avez pas à en assumer la mise en \u0153uvre." },
                { title: "Clarté commerciale", desc: "Les clients qui cherchent vos services trouvent des informations exactes et structurées partout." },
                { title: "Sécurité d\u2019avenir", desc: "Les moteurs évoluent vite. Votre profil est déjà structuré pour être compris et cité par les systèmes actuels et futurs." },
              ].map((o, i) => (
                <motion.div key={o.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }} className="group relative overflow-hidden rounded-2xl border border-white/7 bg-[#0d0d0d] p-7 transition-all hover:-translate-y-1 hover:border-emerald-400/20">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <CheckCircle2 className="mb-5 h-5 w-5 text-emerald-400" />
                  <div className="mb-2 text-[15px] font-semibold text-white">{o.title}</div>
                  <div className="text-[13px] leading-[1.65] text-[#888]">{o.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-10 sm:px-10">
          <div className="mx-auto max-w-[960px]">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b8fff]">À retenir</div>
            <ul className="grid gap-3 md:grid-cols-4">
              {STEPS.map((step) => (
                <li key={step.num} className="border-l border-white/10 pl-4 text-[13px] leading-[1.65] text-white/62">
                  <span className="font-semibold text-white/82">{step.title}.</span> {step.desc}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] bg-[radial-gradient(ellipse,rgba(91,115,255,0.05)_0%,transparent_60%)]" />
          <div className="relative z-10 mx-auto max-w-[660px] text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]">Prochaine étape</motion.div>
            <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.06 }} className="mb-5 text-[clamp(22px,3vw,32px)] font-bold tracking-[-0.03em]">Prêt à déléguer votre visibilité ?</motion.h3>
            <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.12 }} className="mx-auto mb-8 max-w-md text-[15px] leading-[1.65] text-[#a0a0a0]">
              Notre méthode sécurise votre visibilité organique et la cohérence de votre signal face aux moteurs et aux réponses IA.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.18 }} className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                Planifier un appel de cadrage <ArrowRight className="h-4 w-4" />
              </ContactButton>
              <Link href="/etudes-de-cas/dossier-type" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-7 py-3.5 text-sm font-medium text-[#a0a0a0] transition hover:border-white/30 hover:text-white">
                Consulter un dossier-type
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
