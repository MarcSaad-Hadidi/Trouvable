"use client";

import React from "react";
import { motion } from "framer-motion";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import ContactButton from "@/features/public/shared/ContactButton";
import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle, Users, MapPin } from "lucide-react";

const OFFERINGS = [
  { num: "01", title: "Cartographie stratégique", desc: "Diagnostic croisé de votre visibilité Google et de votre crédibilité dans les réponses IA. Plan d'action priorisé, livré sur un rythme de mandat convenu." },
  { num: "02", title: "Mandat d'implémentation", desc: "Corrections et enrichissements techniques déployés sur un périmètre défini. L'équipe exécute, vous validez les points sensibles." },
  { num: "03", title: "Pilotage continu", desc: "Suivi, mesure et ajustements continus de votre visibilité organique face aux moteurs en mutation." },
];

const PRINCIPLES = [
  { title: "Exécution, pas consultation", desc: "Nous ne vous remettons pas un PDF de recommandations. Nous appliquons les changements nous-mêmes, sur votre périmètre, avec des livrables documentés." },
  { title: "Mandat cadré, pas retainer flou", desc: "Chaque engagement est défini par un périmètre, un rythme, des livrables et un interlocuteur unique. Pas de prestation ouverte sans fin." },
  { title: "Mesure honnête, pas de vanity metrics", desc: "Nous dissocions les signaux techniques, la présence et les résultats business. Nous ne confondons jamais visibilité et conversion." },
  { title: "Confidentialité absolue", desc: "Les données stratégiques et les chiffres de croissance de nos clients sont protégés et jamais diffusés sans accord explicite." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,#080808,#080808)]" />

      <main>
        <section className="relative mt-[58px] overflow-hidden px-6 pt-[90px] pb-0 sm:pt-[120px]">
          <div className="pointer-events-none absolute left-[-200px] top-[80px] h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(91,115,255,0.06),transparent_70%)]" />
          <div className="relative z-[1] mx-auto max-w-[1000px] grid gap-16 lg:grid-cols-[1fr_340px] items-end">
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6 text-[11px] font-bold uppercase tracking-[0.2em] text-[#7b8fff]">À propos de Trouvable</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(40px,6.5vw,80px)] font-bold leading-[1.02] tracking-[-0.05em] mb-8">
                Firme d&apos;exécution en<br /><span className="bg-gradient-to-b from-white/50 to-white/15 bg-clip-text text-transparent">visibilité organique.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }} className="max-w-[480px] text-[17px] leading-[1.7] text-[#a0a0a0]">
                Trouvable est une firme d&apos;exécution basée au Québec. Visibilité organique sur Google, cohérence de votre présence dans les réponses des grands modèles conversationnels, le travail est livré sur mandat, de bout en bout. Vous déléguez, l&apos;équipe exécute.
              </motion.p>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.2 }} className="hidden lg:block relative rounded-2xl border border-white/8 bg-[#0a0a0a] p-7 shadow-[0_40px_100px_rgba(0,0,0,0.4)]">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-[#5b73ff]/40 to-transparent" />
              <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/25 mb-4">Positionnement</div>
              <div className="space-y-3 text-[13px]">
                {["Firme d'exécution sur mandat", "Interlocuteur unique par dossier", "Livrables vérifiables", "Cadre de mesure transparent"].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-[#999]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/70" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10 mt-20">
          <div className="mx-auto max-w-[1100px] grid gap-8 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="relative overflow-hidden rounded-2xl border border-white/7 bg-[#0a0a0a] p-8 md:p-10">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-emerald-400/40 to-transparent" />
              <div className="flex items-center gap-3 mb-7">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold tracking-[-0.02em]">Nos mandats d&apos;exécution</h2>
              </div>
              <ul className="space-y-5">
                {OFFERINGS.map((o) => (
                  <li key={o.num} className="flex gap-3 text-[14px] text-[#a0a0a0] leading-[1.65]">
                    <span className="mt-1 font-mono text-[11px] text-white/20 shrink-0">{o.num}</span>
                    <span><span className="font-medium text-white/90">{o.title}.</span> {o.desc}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="relative overflow-hidden rounded-2xl border border-white/7 bg-[#0a0a0a] p-8 md:p-10">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-rose-400/40 to-transparent" />
              <div className="flex items-center gap-3 mb-7">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-rose-500/20 bg-rose-500/10">
                  <XCircle className="h-5 w-5 text-rose-400" />
                </div>
                <h2 className="text-xl font-bold tracking-[-0.02em]">Ce que nous ne sommes pas</h2>
              </div>
              <ul className="space-y-5">
                {[
                  "Pas une agence SEO générique. Nous sommes une firme d\u2019exécution sur mandat, pas un prestataire de recommandations.",
                  "Pas un produit SaaS à configurer vous-même. Nous opérons pour vous.",
                  "Pas une agence web ni un studio de création de sites. Notre spécialité est l\u2019ingénierie de la visibilité organique.",
                  "Pas de rapports automatisés ni de vanity metrics, uniquement des résultats vérifiables.",
                ].map((text, i) => (
                  <li key={i} className="flex gap-3 text-[14px] text-[#a0a0a0] leading-[1.65]">
                    <span className="mt-1 font-mono text-[11px] text-white/20 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[900px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-14">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]">Nos principes</div>
              <h2 className="text-[clamp(26px,3.5vw,40px)] font-bold tracking-[-0.04em]">Ce à quoi nous nous tenons</h2>
            </motion.div>
            <div className="space-y-4">
              {PRINCIPLES.map((p, i) => (
                <motion.div key={p.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.06 }} className="group flex gap-5 rounded-xl border border-white/6 bg-white/[0.02] p-6 transition-all hover:border-white/12 hover:bg-white/[0.04] cursor-default">
                  <span className="mt-0.5 font-mono text-[28px] font-bold leading-none text-white/8 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="mb-1.5 text-[15px] font-semibold text-white">{p.title}</h3>
                    <p className="text-[13px] leading-[1.65] text-[#999] group-hover:text-white/70 transition-colors">{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.05] px-6 py-28 sm:px-10">
          <div className="mx-auto max-w-[1100px] grid gap-8 md:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="group rounded-2xl border border-white/7 bg-[#0a0a0a] p-8 md:p-10 transition-all hover:border-[#5b73ff]/20">
              <Users className="mb-6 h-6 w-6 text-[#5b73ff]" />
              <h3 className="mb-3 text-xl font-bold tracking-[-0.02em]">Qui nous accompagnons</h3>
              <p className="mb-4 text-[15px] leading-[1.65] text-[#a0a0a0]">
                Dirigeants de firmes de services professionnels locales dont la réputation et la confiance sont déterminantes.
              </p>
              <p className="mb-8 text-[13px] leading-[1.65] text-[#888]">
                Secteurs : restaurants, immobilier, santé et cliniques, avocats et notaires, services résidentiels.
              </p>
              <Link href="/#expertises" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#7b8fff] transition-colors hover:text-white">
                Voir nos expertises sectorielles <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="group rounded-2xl border border-white/7 bg-[#0a0a0a] p-8 md:p-10 transition-all hover:border-emerald-400/20">
              <MapPin className="mb-6 h-6 w-6 text-emerald-400" />
              <h3 className="mb-3 text-xl font-bold tracking-[-0.02em]">Où nous intervenons</h3>
              <p className="mb-4 text-[15px] leading-[1.65] text-[#a0a0a0]">
                Visibilité locale au Québec. Nous intervenons sur le Grand Montréal et les principaux marchés de la province.
              </p>
              <p className="mb-8 text-[13px] leading-[1.65] text-[#888]">
                Marchés actifs : Montréal, Laval, Québec, Longueuil, Brossard.
              </p>
              <Link href="/#marches-locaux" className="inline-flex items-center gap-2 text-[14px] font-medium text-emerald-400 transition-colors hover:text-white">
                Découvrir nos marchés locaux <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
          <div className="pointer-events-none absolute right-[-100px] top-[50px] h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(91,115,255,0.04),transparent_70%)]" />
          <div className="relative z-10 mx-auto max-w-[660px]">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]">Entrer en relation</motion.div>
            <motion.h3 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.06 }} className="mb-5 text-[clamp(22px,3vw,32px)] font-bold tracking-[-0.03em]">Prêt à déléguer votre visibilité ?</motion.h3>
            <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.12 }} className="mb-8 max-w-md text-[15px] leading-[1.65] text-[#a0a0a0]">
              Identifions ensemble le mandat adapté à votre situation, votre marché et vos priorités.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.18 }} className="flex flex-wrap gap-3">
              <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                Planifier un appel de cadrage <ArrowRight className="h-4 w-4" />
              </ContactButton>
              <Link href="/offres" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-7 py-3.5 text-sm font-medium text-[#a0a0a0] transition hover:border-white/30 hover:text-white">
                Voir les mandats
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
