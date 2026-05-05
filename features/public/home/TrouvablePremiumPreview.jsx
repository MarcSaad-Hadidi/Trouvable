'use client';

import Link from "next/link";
import {
  Check,
  ArrowRight,
  CheckCircle2,
  Search,
  Wand2,
  MapPin,
  Target,
  ShieldCheck,
  TrendingUp,
  X
} from "lucide-react";
import { motion } from "framer-motion";
import ContactButton from "@/features/public/shared/ContactButton";
import SiteFooter from "@/features/public/shared/SiteFooter";
import Navbar from "@/features/public/shared/Navbar";
import { VILLES, EXPERTISES } from "@/lib/data/geo-architecture";
import { TESTIMONIALS } from "@/lib/data/testimonials";
import { HOME_QUICK_ANSWERS, HOME_REFERENCES } from "@/features/public/home/home-faqs";
import {
  DeferredGeoAnimationPanel,
  DeferredSeoAnimationPanel,
  PipelinePreview,
} from "@/features/public/home/HomeInteractiveIslands";
import HeroPlatformWord from "@/features/public/home/HeroPlatformWord";

/* ---------- DATA ---------- */

const MARKET_STATS = [
  {
    eyebrow: "Rupture",
    value: "-61 %",
    accent: "text-red-400",
    accentLine: "bg-red-400/80",
    title: "Le clic classique ne tient plus.",
    text: "AI Overviews absorbent la première page. Votre canal d’acquisition principal se tarit.",
    source: "Seer Interactive",
    year: 2025,
    sourceUrl: "https://www.seerinteractive.com/news/seer-interactive-research-featured-in-inc.-analysis-of-ctr-and-ai-overviews",
  },
  {
    eyebrow: "Levier",
    splitStats: [
      { value: "+35 %", label: "clics organiques", accent: "text-emerald-400" },
      { value: "+91 %", label: "clics payants", accent: "text-emerald-300" },
    ],
    accentLine: "bg-emerald-400/80",
    title: "La citation IA multiplie les clics.",
    text: "Organique et payant : les marques citées captent un surplus mesurable sur les deux canaux.",
    source: "Seer Interactive",
    year: 2025,
    sourceUrl: "https://www.seerinteractive.com/news/seer-interactive-research-featured-in-inc.-analysis-of-ctr-and-ai-overviews",
  },
  {
    eyebrow: "Contrôle",
    value: "86 %",
    accent: "text-[#7b8fff]",
    accentLine: "bg-[#7b8fff]/80",
    title: "La source, c’est vous.",
    text: "La majorité des citations IA viennent d’actifs que vous contrôlez déjà. Ce n’est pas aléatoire, c’est actionnable.",
    source: "Yext Research",
    year: 2025,
    sourceUrl: "https://www.businesswire.com/news/home/20251009106549/en/Yext-Research-86-of-AI-Citations-Come-from-Brand-Managed-Sources-Clarifying-How-Marketers-Can-Compete-in-the-AI-Search-Era",
  },
];

const MOTION_EASE = [0.16, 1, 0.3, 1];

const compareSectionMotion = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: MOTION_EASE, staggerChildren: 0.14, delayChildren: 0.04 },
  },
};

const compareCardMotion = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.82, ease: MOTION_EASE } },
};

function RadarScanner() {
  return (
    <div className="pointer-events-none absolute right-[-100px] top-[-60px] h-[500px] w-[500px] opacity-[0.08] lg:opacity-[0.12]">
      <div className="absolute inset-0 rounded-full border border-blue-400/20" />
      <div className="absolute inset-[40px] rounded-full border border-blue-400/15" />
      <div className="absolute inset-[80px] rounded-full border border-blue-400/10" />
      <motion.div 
        className="absolute left-1/2 top-1/2 h-[250px] w-px origin-bottom -translate-x-1/2 -translate-y-full" 
        style={{ background: 'linear-gradient(to top, transparent, rgba(91,115,255,0.6))' }} 
        animate={{ rotate: 360 }} 
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }} 
      />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400 shadow-[0_0_12px_rgba(91,115,255,0.6)]" />
      {[{ x: '30%', y: '25%', d: 0.5 },{ x: '65%', y: '35%', d: 1.2 },{ x: '45%', y: '70%', d: 2.0 },{ x: '75%', y: '60%', d: 3.1 }].map((b, i) => (
        <motion.div 
          key={i} 
          className="absolute h-1.5 w-1.5 rounded-full bg-blue-300" 
          style={{ left: b.x, top: b.y }} 
          animate={{ opacity: [0,1,1,0], scale: [0,1,1,0] }} 
          transition={{ duration: 4, repeat: Infinity, delay: b.d }} 
        />
      ))}
    </div>
  );
}



/* ================= MAIN COMPONENT ================= */

export default function TrouvableLandingPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-hidden bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(91,115,255,0.08),transparent_55%),linear-gradient(to_bottom,#080808,#080808)]" />

      <Navbar />

      {/* HERO */}
      <section className="relative mt-[58px] overflow-hidden px-6 pb-4 pt-[76px] text-center sm:pt-[88px]">
        {/* Background Patterns & Animations */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_90%_55%_at_50%_0%,black_30%,transparent_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[600px] w-[900px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(91,115,255,0.10)_0%,transparent_62%)]" />

        {/* ScanLine Animation */}
        <motion.div 
          className="pointer-events-none absolute left-0 right-0 z-0 h-px bg-gradient-to-r from-transparent via-blue-400/15 to-transparent" 
          animate={{ top: ['0%', '100%'] }} 
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} 
        />

        {/* Radar Visual */}
        <RadarScanner />

        <div className="relative z-[1] mx-auto flex w-full max-w-[920px] flex-col items-center">
          <h1 className="max-w-[26ch] text-[clamp(33px,6.1vw,68px)] font-bold leading-[1.02] tracking-[-0.043em] sm:max-w-[30ch]">
            <span className="block text-white">
              Nous opérons votre visibilité <span className="text-white/80">sur</span>
            </span>
            <span className="mt-3 block leading-[1.05] sm:mt-4 sm:text-[0.9em]">
              <span className="inline-flex items-baseline justify-center align-baseline">
                <HeroPlatformWord />
              </span>
            </span>
          </h1>

          <p className="mx-auto mb-8 mt-8 max-w-[650px] text-[15px] leading-[1.75] text-[#a8a8a8] sm:text-[16px]">
            Agence GEO à Montréal pour entreprises québécoises : visibilité organique locale, cohérence de votre signal face aux moteurs de recherche et aux systèmes conversationnels, livrables vérifiables. Vous déléguez, nous exécutons.
          </p>

          <div className="flex flex-wrap justify-center gap-3 sm:gap-3.5">
            <ContactButton className="rounded-lg bg-white px-6 py-3 text-sm font-medium text-black transition hover:-translate-y-px hover:bg-[#ccc]">
              Demander une cartographie
            </ContactButton>
            <Link href="/agence-geo-montreal" className="rounded-lg border border-[#5b73ff]/30 bg-[#5b73ff]/10 px-6 py-3 text-sm font-medium text-[#c8d0ff] transition hover:-translate-y-px hover:border-[#7b8fff]/45 hover:text-white">Agence GEO Montréal</Link>
            <Link href="/offres" className="rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-[#a0a0a0] transition hover:-translate-y-px hover:border-white/25 hover:text-white">Voir les mandats &rarr;</Link>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-2.5 text-[12px] font-medium text-white/55 sm:text-[12.5px]">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.02] px-3 py-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Exécution faite pour vous</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.02] px-3 py-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Interlocuteur unique</span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.02] px-3 py-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Livrables vérifiables</span>
          </div>
        </div>

        <div>
          <PipelinePreview />
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0c0c0f] px-6 py-10 sm:px-10" aria-labelledby="geo-mtl-band-title">
        <div className="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p id="geo-mtl-band-title" className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7b8fff]">
              Ancrage local
            </p>
            <p className="mt-2 text-[15px] leading-[1.65] text-white/78">
              <Link href="/agence-geo-montreal" className="font-semibold text-white underline decoration-[#5b73ff]/40 underline-offset-4 transition hover:decoration-[#7b8fff]">
                Agence GEO à Montréal
              </Link>
              {' '}pour les mandats Google, ChatGPT, Perplexity et réponses IA : même méthode et mêmes livrables que sur la page pilier, avec une lecture explicite du marché local et bilingue.
            </p>
          </div>
          <Link
            href="/agence-geo-montreal"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#5b73ff]/35 bg-[#5b73ff]/10 px-5 py-3 text-sm font-medium text-[#d6dcff] transition hover:-translate-y-px hover:border-[#7b8fff]/50 hover:text-white"
          >
            Voir le pilier Montréal <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* PREUVE STRATÉGIQUE — SIGNAL MARCHÉ */}
      <section id="marche" className="scroll-mt-20 border-y border-white/[0.06] bg-[#09090b] px-6 py-24 sm:px-10 sm:py-32" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1000px' }}>
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-4 text-center text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#aebaff]">
            Signal marché
          </div>
          <h2 className="mb-5 text-center text-[clamp(28px,3.6vw,44px)] font-bold tracking-[-0.04em]">
            L&apos;IA redistribue vos clics.
          </h2>
          <p className="mx-auto mb-16 max-w-xl text-center text-[15px] leading-[1.7] text-[#b7b7b7]">
            Pas une prédiction. Trois données mesurées.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {MARKET_STATS.map((row) => (
              <div
                key={row.source + (row.value || row.eyebrow)}
                className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] p-8 sm:p-10"
              >
                {/* Accent top line */}
                <div className={`absolute inset-x-0 top-0 h-[2px] ${row.accentLine}`} />

                {/* Eyebrow */}
                <div className="mb-6 text-[10px] font-bold uppercase tracking-[0.18em] text-[#b8b8b8]">
                  {row.eyebrow}
                </div>

                {/* Dominant stat — split layout for dual metrics */}
                {row.splitStats ? (
                  <div className="mb-4 flex gap-8">
                    {row.splitStats.map((s) => (
                      <div key={s.label}>
                        <div className={`whitespace-nowrap text-[clamp(36px,4.5vw,48px)] font-extrabold leading-[0.95] tracking-[-0.04em] ${s.accent}`}>
                          {s.value}
                        </div>
                        <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b8b8b8]">
                          {s.label}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`mb-4 text-[clamp(44px,5.5vw,60px)] font-extrabold leading-[0.95] tracking-[-0.04em] ${row.accent}`}>
                    {row.value}
                  </div>
                )}

                {/* Hard-hitting headline */}
                <h3 className="mb-3 text-[15.5px] font-semibold leading-snug tracking-[-0.01em] text-white">
                  {row.title}
                </h3>

                {/* Short consequence line */}
                <p className="mb-8 text-[13.5px] leading-[1.6] text-white/45">
                  {row.text}
                </p>

                {/* Premium source — no default link styling */}
                <a
                  href={row.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-md py-1 pr-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#b8c5ff] no-underline transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8c5ff]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090b]"
                >
                  <span>{row.source}, {row.year}</span>
                  <svg className="h-2.5 w-2.5 opacity-60" fill="none" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l4-4M3 3h4v4" /></svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PÉDAGOGIE : SEO CLASSIQUE VS VISIBILITÉ IA */}
      <section className="relative border-t border-white/7 bg-[#050505] px-6 py-32 sm:px-10 overflow-hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1200px' }}>
        {/* Abstract background glows */}
        <div className="pointer-events-none absolute left-0 top-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-[100px]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-[600px] w-[600px] translate-x-1/3 translate-y-1/3 rounded-full bg-[#5b73ff]/[0.04] blur-[120px]" />

        <div className="relative z-10 mx-auto max-w-[1120px]">
          <motion.div
            className="mb-16 text-center"
            variants={compareSectionMotion}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.35 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]">
              Double contrainte
            </div>
            <h2 className="mx-auto mb-6 max-w-3xl text-[clamp(28px,4vw,46px)] font-bold leading-[1.05] tracking-[-0.04em]">
              Pourquoi être le premier sur Google <br className="max-sm:hidden" />
              <span className="text-[#b3b3b3]">ne suffit plus aujourd&apos;hui.</span>
            </h2>
            <p className="mx-auto max-w-2xl text-[16px] leading-[1.65] text-[#a0a0a0]">
              Une entreprise peut avoir un excellent positionnement organique &ldquo;classique&rdquo;, mais être ignorée par les moteurs d&apos;intelligence artificielle car elle manque de clarté sémantique.
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 lg:grid-cols-12"
            variants={compareSectionMotion}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.22 }}
          >
            {/* Colonne 1 : SEO Classique (Bento 5 cols) */}
            <motion.div className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f0f0f] p-8 lg:col-span-5 hover:border-white/20 transition-colors shadow-none" variants={compareCardMotion}>
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none">
                <Search className="h-32 w-32 text-white" />
              </div>
              
              <div className="relative z-10 w-full mb-8">
                <DeferredSeoAnimationPanel />
              </div>

              <div className="relative z-10 mt-auto">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a0a0a0]">
                  <Search className="h-3.5 w-3.5" /> La base technique
                </div>
                <h3 className="mb-2 text-2xl font-bold tracking-[-0.03em] text-white">SEO Classique</h3>
                <p className="mb-6 text-[15px] leading-[1.6] text-[#adadad]">L&apos;optimisation historique pour le moteur de recherche traditionnel.</p>
                
                <ul className="space-y-4 text-[14px] text-[#a0a0a0]">
                  <li className="flex items-start gap-3">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                    <span className="leading-[1.6]">Se concentre sur le <strong>positionnement Google</strong> classique.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/20" />
                    <span className="leading-[1.6]">S&apos;appuie sur les mots-clés et les signaux bruts.</span>
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* Colonne 2 : Visibilité IA (Bento 7 cols) */}
            <motion.div className="group relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-[#5b73ff]/30 bg-gradient-to-br from-[#5b73ff]/[0.08] to-[#0f0f0f] p-8 lg:col-span-7 shadow-[0_0_80px_rgba(91,115,255,0.06)_inset]" variants={compareCardMotion}>
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5b73ff]/60 to-transparent opacity-50" />
              <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-[#5b73ff]/10 blur-[80px]" />
              
              <div className="relative z-10 w-full mb-8">
                <DeferredGeoAnimationPanel />
              </div>

              <div className="relative z-10 mt-auto">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#5b73ff]/20 bg-[#5b73ff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7b8fff]">
                  <Wand2 className="h-3.5 w-3.5" /> La nouvelle norme (GEO)
                </div>
                <h3 className="mb-2 text-2xl font-bold tracking-[-0.03em] text-white">Visibilité IA</h3>
                <p className="mb-6 text-[15px] leading-[1.6] text-[#a0a0a0]">La clarté attendue par les systèmes conversationnels, au-delà du seul classement Google.</p>
                
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  <ul className="space-y-4 text-[14px] text-white/80">
                    <li className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b73ff]" />
                      <span className="leading-[1.6]">Vise à être <strong>cité et recommandé</strong> comme une entité fiable.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b73ff]" />
                      <span className="leading-[1.6]">Objectif : être cité lorsque la question est précise et locale.</span>
                    </li>
                  </ul>
                  <ul className="space-y-4 text-[14px] text-white/80">
                    <li className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b73ff]" />
                      <span className="leading-[1.6]">Exige une <strong>cohérence sémantique absolue</strong>.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b73ff]" />
                      <span className="leading-[1.6]">S&apos;appuie sur des formats techniques conformes aux attentes des moteurs.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Mini exemple anonymisé (Bento Full Width) */}
          <div className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-8 lg:p-12 relative shadow-none">
             <div className="absolute top-0 right-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_right,rgba(34,197,94,0.05),transparent)] pointer-events-none" />
             
             <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between mb-10">
               <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b8b8b8]">
                    Mise en situation
                  </div>
                  <h3 className="text-[22px] font-bold text-white tracking-[-0.03em]">Exemple : Cabinet de Services </h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-[#adadad] max-w-lg">
                    Découvrez concrètement l&apos;impact d&apos;une restructuration sémantique de vos données sur les réponses des moteurs IA.
                  </p>
               </div>
               <Link href="/etudes-de-cas/dossier-type" className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-5 py-3.5 text-[14px] font-semibold text-black transition hover:bg-[#e0e0e0] shrink-0">
                 Voir le dossier de référence <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
               </Link>
             </div>

             <div className="relative z-10 grid gap-4 lg:grid-cols-2">
               {/* Avant */}
              <div className="group rounded-2xl border border-red-500/12 bg-[#1b0d0d] p-6 transition-all duration-300 hover:border-red-500/25 hover:bg-[#211010] lg:p-8">
                 <div className="mb-5 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/14 transition-colors duration-300 group-hover:bg-red-500/18">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-400/90 transition-colors duration-300 group-hover:bg-red-300" />
                   </div>
                  <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-red-300 transition-colors duration-300 group-hover:text-red-200">Avant intégration</div>
                 </div>
                <ul className="space-y-6 text-[14px] text-[#ece5df] transition-colors duration-300 group-hover:text-white">
                  <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-red-300/95" /> <span className="leading-[1.6]">L&apos;entreprise est mal identifiée par ChatGPT et Gemini.</span></li>
                  <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-red-300/95" /> <span className="leading-[1.6]">Les spécialités et zones d&apos;intervention sont floues.</span></li>
                  <li className="flex items-start gap-3"><X className="mt-1 h-4 w-4 shrink-0 text-red-300/95" /> <span className="leading-[1.6]">L&apos;IA recommande plutôt les annuaires ou vos concurrents.</span></li>
                 </ul>
               </div>

               {/* Après */}
              <div className="group rounded-2xl border border-emerald-500/12 bg-[#071510] p-6 transition-all duration-300 hover:border-emerald-500/25 hover:bg-[#0a1a14] hover:shadow-[0_0_30px_rgba(34,197,94,0.06)_inset] lg:p-8">
                 <div className="mb-5 flex items-center gap-4">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300 transition-colors duration-300 group-hover:text-emerald-200" />
                  <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-emerald-300 transition-colors duration-300 group-hover:text-emerald-200">Après l&apos;intervention Trouvable</div>
                 </div>
                <ul className="space-y-6 text-[14px] text-[#e1ece6] transition-colors duration-300 group-hover:text-white">
                  <li className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400/90" /> <span className="leading-[1.6]">L&apos;activité est lue clairement grâce à l&apos;injection de données sémantiques.</span></li>
                  <li className="flex items-start gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400/90" /> <span className="leading-[1.6]">FAQ métier et attributs locaux alignés sur les formats attendus par les moteurs.</span></li>
                  <li className="flex items-start gap-3 transition-colors duration-300 group-hover:text-white"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400/90" /> <span className="leading-[1.6]">L&apos;entreprise gagne en <strong>crédibilité</strong> lorsque les réponses résument le marché.</span></li>
                 </ul>
               </div>
             </div>
          </div>

        </div>
      </section>

      {/* TROIS MANDATS — IMMERSIVE */}
      <section className="relative border-t border-b border-white/[0.08] px-6 py-28 sm:px-10 sm:py-36 overflow-hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 1200px' }}>
        <div className="pointer-events-none absolute left-0 top-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_left,rgba(91,115,255,0.04),transparent_70%)]" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-full w-1/3 bg-[radial-gradient(ellipse_at_right,rgba(167,139,250,0.04),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-[1200px]">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7b8fff]">
            Mandats d&apos;exécution
          </div>
          <h2 className="mb-5 text-[clamp(28px,4vw,48px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Trois niveaux d&apos;engagement.<br /><span className="bg-gradient-to-r from-white/50 to-white/20 bg-clip-text text-transparent">Choisissez votre entrée.</span>
          </h2>
          <p className="mb-16 max-w-xl text-[15px] leading-relaxed text-[#888]">
            Cartographie pour décider. Implémentation pour livrer. Pilotage pour tenir la cadence.
          </p>

          <div className="space-y-0">
            {[
              { num: "01", icon: Search, accent: "#5b73ff", title: "Cartographie stratégique", tagline: "Comprendre avant d'agir", hook: "Lecture croisée de vos signaux publics, scénarios de recherche, hiérarchisation des causes. Vous recevez une synthèse direction et un plan d'action priorisé.", bullets: ["Constat direction et priorités", "Plan d'action ordonné", "Critères de preuve clairs"], href: "/offres#cartographie-strategique", cta: "Demander une cartographie" },
              { num: "02", icon: ShieldCheck, accent: "#34d399", title: "Mandat d'implémentation", tagline: "Exécuter sans compromis", hook: "Nous déployons les corrections et enrichissements sur un périmètre défini. Vous validez les points sensibles, nous livrons des changements documentés.", bullets: ["Exécution clé en main", "Livrables tangibles et traçables", "Respect de l'existant"], href: "/offres#mandat-implementation", cta: "Lancer un mandat" },
              { num: "03", icon: TrendingUp, accent: "#a78bfa", title: "Pilotage continu", tagline: "Tenir la cadence", hook: "Un interlocuteur dédié : mesure selon notre cadre, ajustements contenu et signaux, compte rendu périodique et exécution dans le périmètre convenu.", bullets: ["Compte rendu et arbitrages", "Suivi Google et réponses IA", "Itérations fondées sur les faits"], href: "/offres#pilotage-continu", cta: "Parler d'un accompagnement" },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="group relative"
                >
                  {i > 0 && <div className="mx-auto h-px max-w-[90%] bg-gradient-to-r from-transparent via-white/8 to-transparent" />}
                  <div className="grid items-center gap-6 py-10 sm:py-14 lg:grid-cols-[80px_1fr_1fr] lg:gap-12">
                    <div className="hidden lg:block">
                      <span className="font-mono text-[clamp(48px,5vw,72px)] font-bold leading-none tracking-[-0.06em]" style={{ color: m.accent }}>{m.num}</span>
                    </div>
                    <div>
                      <div className="mb-3 flex items-center gap-3">
                        <span className="font-mono text-[28px] font-bold leading-none tracking-[-0.04em] lg:hidden" style={{ color: m.accent }}>{m.num}</span>
                        <div className="grid h-10 w-10 place-items-center rounded-xl border bg-white/[0.03] transition-colors group-hover:bg-white/[0.06]" style={{ borderColor: `${m.accent}25` }}>
                          <Icon className="h-4 w-4" style={{ color: m.accent }} />
                        </div>
                        <div>
                          <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-white">{m.title}</h3>
                          <span className="text-[12px] font-semibold" style={{ color: m.accent }}>{m.tagline}</span>
                        </div>
                      </div>
                      <p className="mt-4 text-[14px] leading-[1.65] text-[#a0a0a0] max-w-md">{m.hook}</p>
                    </div>
                    <div className="flex flex-col gap-4">
                      <ul className="space-y-2.5">
                        {m.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2.5 text-[13px] text-[#999]">
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: m.accent }} />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <ContactButton className="rounded-lg bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                          {m.cta}
                        </ContactButton>
                        <Link href={m.href} className="flex items-center gap-1.5 text-[12px] font-medium transition-colors hover:text-white" style={{ color: `${m.accent}bb` }}>
                          Détails du mandat <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/offres" className="inline-flex items-center gap-2 rounded-lg bg-white/[0.06] border border-white/12 px-6 py-3 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-white/10">
              Voir tous les mandats <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/methodologie" className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-sm font-medium text-[#a0a0a0] transition hover:-translate-y-px hover:border-white/25 hover:text-white">
              Notre méthode d&apos;exécution
            </Link>
          </div>
        </div>
      </section>

      {/* TEMOIGNAGES — affiché uniquement quand des témoignages vérifiés sont disponibles */}
      {TESTIMONIALS.length > 0 && (
      <section className="border-b border-white/[0.08] bg-[#0b0b0b] px-6 py-16 sm:px-10" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 700px' }}>
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-10 text-center">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b8b8b8]">Retours de mandats</div>
            <h2 className="text-[clamp(24px,3vw,34px)] font-semibold tracking-[-0.03em] text-white">Ce que nos clients en disent</h2>
            <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-[1.7] text-white/50">
              Témoignages anonymisés, les noms et chiffres restent confidentiels par engagement contractuel.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <p className="text-[15px] leading-[1.7] text-white/80">&ldquo;{item.quote}&rdquo;</p>
                <div className="mt-5 border-t border-white/8 pt-4">
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#b8b8b8]">{item.sector}</div>
                  <div className="mt-1 text-sm text-white/65">{item.role}</div>
                  <div className="mt-2 inline-flex rounded-full border border-white/12 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
                    {item.anonymizationLevel}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      )}



      {/* EXPERTISES & VILLES */}
      <section id="expertises" className="scroll-mt-20 border-t border-white/7 bg-[#0a0a0a] px-6 py-28 sm:px-10" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 900px' }}>
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[#7b8fff]">Couverture complète</div>
          <h2 className="mb-5 text-[clamp(28px,3.5vw,42px)] font-bold leading-[1.08] tracking-[-0.04em]">Nos expertises et <span className="text-[#b3b3b3]">marchés locaux</span></h2>
          <p className="mb-14 max-w-2xl text-[15px] leading-relaxed text-[#888]">
            Des mandats adaptés à chaque secteur et chaque territoire. Nous opérons pour des firmes de services professionnels dont la confiance et la réputation locale sont déterminantes.
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/7 bg-[#0d0d0d] p-8">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-[#5b73ff]/30 to-transparent" />
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#5b73ff]/20 bg-[#5b73ff]/10 text-[#7b8fff]"><Target className="h-5 w-5" /></div>
                <h3 className="text-lg font-semibold tracking-[-0.02em]">Nos expertises</h3>
              </div>
              <ul className="space-y-1">
                {EXPERTISES.map((exp) => (
                  <li key={exp.slug}>
                    <Link href={`/expertises/${exp.slug}`} className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] text-white/55 transition-all hover:text-white hover:bg-white/[0.03]">
                      <span>{exp.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-white/15 transition-all group-hover:translate-x-1 group-hover:text-[#7b8fff]" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div id="marches-locaux" className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-white/7 bg-[#0d0d0d] p-8">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-emerald-400/30 to-transparent" />
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400"><MapPin className="h-5 w-5" /></div>
                <h3 className="text-lg font-semibold tracking-[-0.02em]">Marchés locaux &mdash; Québec</h3>
              </div>
              <ul className="space-y-1">
                {VILLES.map((ville) => (
                  <li key={ville.slug}>
                    <Link href={`/villes/${ville.slug}`} className="group flex items-center justify-between rounded-lg px-3 py-2.5 text-[14px] text-white/55 transition-all hover:text-white hover:bg-white/[0.03]">
                      <span>Visibilité Google et IA à {ville.name}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-white/15 transition-all group-hover:translate-x-1 group-hover:text-emerald-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-20 border-t border-white/7 bg-[#060606] px-6 py-20 sm:px-10" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 950px' }}>
        <div className="mx-auto max-w-[980px]">
          <div className="mb-9 max-w-[760px]">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7b8fff]/80">Réponses rapides</p>
            <h2 className="text-[clamp(24px,3.1vw,35px)] font-bold tracking-[-0.03em] text-white">Réponses rapides pour les décideurs</h2>
            <p className="mt-3 text-[14px] leading-[1.75] text-[#a6a6a6]">Des réponses directes, alignées avec les questions qui reviennent avant un mandat d’exécution.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {HOME_QUICK_ANSWERS.map((item) => (
              <article key={item.question} className="rounded-xl border border-white/10 bg-[#0d0d0d] p-5 sm:p-6">
                <h3 className="text-[16px] font-semibold leading-[1.35] tracking-[-0.01em] text-white">{item.question}</h3>
                <p className="mt-2.5 text-[13.5px] leading-[1.7] text-[#ababab]">{item.answer}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.95fr]">
            <article className="rounded-xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
              <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">Cadre d&apos;exécution en 3 étapes</h3>
              <ol className="mt-3 list-decimal space-y-2.5 pl-5 text-[13.5px] leading-[1.7] text-[#a6a6a6]">
                <li>Aligner les informations publiques critiques pour supprimer les contradictions.</li>
                <li>Structurer les pages décisionnelles avec des réponses nettes et un balisage propre.</li>
                <li>Mesurer la présence Google et IA pour ajuster les priorités sans dériver vers des métriques de façade.</li>
              </ol>
            </article>

            <aside className="rounded-xl border border-white/10 bg-[#0b0b0b] p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">Références</p>
              <h3 className="mt-2 text-[16px] font-semibold tracking-[-0.01em] text-white">Sources utilisées dans nos analyses</h3>
              <ul className="mt-3 space-y-4">
                {HOME_REFERENCES.map((ref) => (
                  <li key={ref.url}>
                    <a href={ref.url} target="_blank" rel="noopener noreferrer" className="-mx-2 flex min-h-[48px] items-center rounded-md px-4 py-2 text-[13px] leading-[1.65] text-[#c6d0ff] transition hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8c5ff]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0b]">
                      {ref.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12px] leading-[1.6] text-[#b7b7b7]">
                Présence volontaire de ces liens pour soutenir la transparence méthodologique et les signaux de confiance.
              </p>
            </aside>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#080808] px-6 py-10 sm:px-10">
        <div className="mx-auto max-w-[1120px]">
          <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b8fff]">À retenir</div>
          <ul className="grid gap-3 md:grid-cols-3">
            <li className="border-l border-white/10 pl-4 text-[13.5px] leading-[1.65] text-white/62">
              Trouvable exécute les mandats de visibilité Google, SEO local et réponses IA pour des entreprises québécoises.
            </li>
            <li className="border-l border-white/10 pl-4 text-[13.5px] leading-[1.65] text-white/62">
              Le travail part de signaux vérifiables : pages publiques, données structurées, FAQ, preuves et cohérence locale.
            </li>
            <li className="border-l border-white/10 pl-4 text-[13.5px] leading-[1.65] text-white/62">
              Les résultats ne sont pas garantis ; chaque mandat documente ce qui est corrigé, mesuré et encore à vérifier.
            </li>
          </ul>
          <div className="mt-5 text-[12px] uppercase tracking-[0.08em] text-white/35">Par Trouvable</div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden border-t border-white/7 px-6 py-28 sm:px-10" style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}>
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(91,115,255,0.06)_0%,transparent_60%)]" />
        <div className="relative z-10 mx-auto max-w-[700px] text-center">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]">Prochaine étape</div>
          <h2 className="mb-5 text-[clamp(26px,4vw,44px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Un appel de cadrage.<br /><span className="bg-gradient-to-r from-white/50 to-white/25 bg-clip-text text-transparent">Zéro engagement.</span>
          </h2>
          <p className="mx-auto mb-10 max-w-lg text-[16px] leading-[1.65] text-[#a0a0a0]">
            Nous identifions le mandat adapté, le périmètre et le rythme, avant tout engagement. Chaque mandat est unique, nous cadrons le vôtre.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-[15px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8] hover:shadow-[0_20px_60px_rgba(255,255,255,0.06)]">
              Planifier un appel de cadrage <ArrowRight className="h-4 w-4" />
            </ContactButton>
            <Link href="/offres" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-8 py-4 text-[15px] font-medium text-[#a0a0a0] transition hover:border-white/25 hover:text-white">
              Voir les mandats
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter showCta={false} />
    </main>
  );
}
