"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import ContactButton from "@/features/public/shared/ContactButton";
import GeoSeoInjector from "@/features/public/shared/GeoSeoInjector";
import Link from "next/link";
import { ArrowRight, BarChart3, Target, Bot, Search, Layers, Eye, TrendingUp } from "lucide-react";
import { SITE_LAST_MODIFIED, SITE_LAST_MODIFIED_ISO, SITE_URL } from "@/lib/site-config";

const LAYERS = [
  { id: "signals", label: "Les signaux", accent: "#5b73ff", icon: Layers, sublabel: "Fondation", desc: "Ce sont les balises Schema.org, les profils créés, le code injecté. Nous mesurons si l'implémentation technique est à 100\u00A0% propre pour que la donnée soit ingestible.", metrics: ["Score Schema.org", "Conformité llms.txt", "Cohérence NAP annuaires"] },
  { id: "presence", label: "La présence", accent: "#f59e0b", icon: Eye, sublabel: "Classement", desc: "C'est votre rang sur Google Maps ou la probabilité que ChatGPT vous mentionne dans sa liste de 3 réponses.", metrics: ["Positionnement Map Pack", "Part de voix IA (Share of Model)", "Exactitude des réponses IA"] },
  { id: "business", label: "Le business", accent: "#34d399", icon: TrendingUp, sublabel: "La vraie monnaie", desc: "Ce que nous visons ultimement : l'augmentation des appels entrants qualifiés et du volume de contacts provenant de recherches locales.", metrics: ["Appels entrants Maps", "Demandes de devis/contact", "Clics qualifiés depuis la fiche"] },
];

function LayerExplorer() {
  const [active, setActive] = useState(0);
  const layer = LAYERS[active];
  const Icon = layer.icon;

  return (
    <div>
      <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
        {LAYERS.map((l, i) => (
          <button key={l.id} onClick={() => setActive(i)} className={`relative flex items-center gap-2 rounded-xl px-5 py-3 text-[13px] font-semibold transition-all whitespace-nowrap ${i === active ? "text-white" : "text-white/35 hover:text-white/60"}`}>
            {i === active && <motion.div layoutId="layerPill" className="absolute inset-0 rounded-xl border bg-white/[0.05]" style={{ borderColor: `${l.accent}30` }} transition={{ type: "spring", bounce: 0.15, duration: 0.5 }} />}
            <span className="relative z-10 font-mono text-[10px]" style={{ color: i === active ? l.accent : undefined }}>{String(i + 1).padStart(2, "0")}</span>
            <span className="relative z-10">{l.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={active} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="grid gap-8 lg:grid-cols-2 items-start">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl border bg-white/[0.03]" style={{ borderColor: `${layer.accent}20` }}>
                <Icon className="h-5 w-5" style={{ color: layer.accent }} />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: `${layer.accent}80` }}>{layer.sublabel}</span>
                <h3 className="text-xl font-bold tracking-[-0.02em]">{layer.label}</h3>
              </div>
            </div>
            <p className="mt-4 text-[15px] leading-[1.7] text-[#a0a0a0]">{layer.desc}</p>
          </div>
          <div className="space-y-2.5">
            {layer.metrics.map((m, i) => (
              <motion.div key={m} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08, duration: 0.3 }} className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-5 py-3.5">
                <span className="text-[13px] font-medium text-white/70">{m}</span>
                <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: layer.accent, animationDelay: `${i * 0.2}s` }} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function NotreMesurePage() {
  const pageUrl = `${SITE_URL}/notre-mesure`;

  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <GeoSeoInjector
        baseUrl={SITE_URL}
        article={{
          url: pageUrl,
          headline: "Cadre de mesure Trouvable",
          description: "Cadre pour distinguer les signaux techniques, la présence Google et IA, puis les indicateurs d'affaires.",
          datePublished: SITE_LAST_MODIFIED_ISO,
          dateModified: SITE_LAST_MODIFIED_ISO,
          about: ["mesure SEO", "mesure GEO", "visibilité IA"],
          mentions: [`${SITE_URL}/methodologie`, `${SITE_URL}/offres`],
        }}
        itemList={{
          id: `${pageUrl}#measurement-layers`,
          name: "Couches de mesure Trouvable",
          pageUrl,
          items: LAYERS.map((layer) => layer.label),
        }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.04)_0%,rgba(91,115,255,0.04)_50%,transparent_70%),linear-gradient(to_bottom,#080808,#080808)]" />

      <main>
        <section className="relative mt-[58px] overflow-hidden px-6 pt-[80px] pb-4 sm:pt-[110px]">
          <div className="pointer-events-none absolute left-1/2 top-[-100px] z-0 h-[500px] w-[800px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(52,211,153,0.06)_0%,rgba(91,115,255,0.06)_40%,transparent_65%)]" />
          <div className="relative z-[1] mx-auto max-w-[860px] text-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">
              <BarChart3 className="h-3.5 w-3.5" /> Cadre de mesure
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(36px,6vw,72px)] font-bold leading-[1.06] tracking-[-0.045em] mb-6">
              Ce que nous mesurons,<br /><span className="bg-gradient-to-r from-emerald-400/70 to-[#5b73ff]/70 bg-clip-text text-transparent">et ce que nous excluons.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }} className="mx-auto max-w-[600px] text-[17px] leading-[1.65] text-[#a0a0a0]">
              Signaux publics, présence sur votre marché, indicateurs business : nous les dissocions pour éviter les confusions et les métriques de façade.
            </motion.p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[12px] uppercase tracking-[0.08em] text-white/35">
              <span>Par Trouvable</span>
              <span aria-hidden>•</span>
              <span>Dernière mise à jour: {SITE_LAST_MODIFIED}</span>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-10 sm:px-10">
          <div className="mx-auto max-w-[960px]">
            <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">À retenir</div>
            <ul className="grid gap-3 md:grid-cols-3">
              {LAYERS.map((layer) => (
                <li key={layer.id} className="border-l border-emerald-400/20 pl-4 text-[13.5px] leading-[1.65] text-white/62">
                  <span className="font-semibold text-white/82">{layer.label}.</span> {layer.desc}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1100px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]">Les trois couches</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Signal, Présence, Business, jamais confondus</h2>
            </motion.div>
            <LayerExplorer />
          </div>
        </section>

        <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1100px] grid gap-8 md:grid-cols-2">
            {[
              { icon: Search, accent: "#34d399", label: "SEO local", title: "L'axe Google", indicators: ["Positionnement Map Pack par code postal", "Actions de conversion Google (itinéraires, appels)", "Alignement d'autorité NAP sur les annuaires"] },
              { icon: Bot, accent: "#5b73ff", label: "GEO", title: "L'axe IA", indicators: ["Part de voix (Share of Model)", "Exactitude des réponses IA", "Disponibilité sémantique (llms.txt)"] },
            ].map((axis, i) => {
              const Icon = axis.icon;
              return (
                <motion.div key={axis.label} initial={{ opacity: 0, y: 20, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }} className="relative overflow-hidden rounded-2xl border border-white/7 bg-[#0a0a0a] p-8 md:p-10">
                  <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, ${axis.accent}50, transparent 70%)` }} />
                  <div className="flex items-center gap-4 mb-7">
                    <div className="grid h-12 w-12 place-items-center rounded-xl border bg-white/[0.03]" style={{ borderColor: `${axis.accent}25` }}>
                      <Icon className="h-5 w-5" style={{ color: axis.accent }} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: `${axis.accent}70` }}>{axis.label}</span>
                      <h2 className="text-xl font-bold tracking-[-0.02em]">{axis.title}</h2>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {axis.indicators.map((ind) => (
                      <li key={ind} className="flex items-start gap-3 text-[13px] leading-[1.65] text-[#999]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: axis.accent }} />
                        {ind}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1000px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14 text-center">
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Ce que nous ne confondons jamais</h2>
            </motion.div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { title: "Visibilité \u2260 Conversion", desc: "Être premier ne sert à rien si aucune action ne suit. Nous mesurons l'acquisition réelle." },
                { title: "Citation \u2260 Client signé", desc: "La recommandation sémantique doit être assez documentée pour déclencher un contact final." },
                { title: "Présence \u2260 Domination réelle", desc: "Être présent localement c'est essentiel. Dominer 80\u00A0% des requêtes de la métropole, c'est la domination." },
                { title: "Signal technique \u2260 Résultat immédiat", desc: "Un balisage parfait est une fondation invisible. Le résultat business se construit de manière incrémentale." },
              ].map((card, i) => (
                <motion.div key={card.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }} className="group relative overflow-hidden rounded-xl border border-white/7 bg-[#0a0a0a] p-6 transition-all hover:border-[#5b73ff]/20 cursor-default">
                  <div className="absolute left-0 top-0 h-full w-1 bg-[#5b73ff] opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-[#7b8fff]">
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /> {card.title}
                  </div>
                  <div className="text-[14px] leading-[1.65] text-[#a0a0a0] group-hover:text-white/80 transition-colors">{card.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] bg-[radial-gradient(ellipse,rgba(52,211,153,0.04)_0%,transparent_60%)]" />
          <div className="relative z-10 mx-auto max-w-[660px] text-center">
            <Target className="mx-auto mb-6 h-10 w-10 text-emerald-400" />
            <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-5 text-[clamp(22px,3vw,32px)] font-bold tracking-[-0.03em]">Voyez un audit en conditions réelles.</motion.h3>
            <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.08 }} className="mx-auto mb-8 max-w-xl text-[15px] leading-[1.65] text-[#a0a0a0]">
              Pour comprendre le niveau de granularité avec lequel nous mesurons une entreprise, visualisez le dossier d&apos;exécution complet d&apos;un prospect sous mandat.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.14 }} className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link href="/etudes-de-cas/dossier-type" className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                Voir le dossier-type <ArrowRight className="h-4 w-4" />
              </Link>
              <ContactButton className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                Demander l&apos;analyse de mon entreprise
              </ContactButton>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
