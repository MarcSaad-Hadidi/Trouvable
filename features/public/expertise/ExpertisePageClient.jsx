"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import ContactButton from "@/features/public/shared/ContactButton";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import GeoSeoInjector from "@/features/public/shared/GeoSeoInjector";
import { SITE_URL } from "@/lib/site-config";
import { ArrowRight, Briefcase, Search, Layers, BookOpen, HelpCircle, ChevronDown, Zap, Globe, Shield, TrendingUp, MapPin } from "lucide-react";

function KeyTakeawaysSection({ expertise, composition, sectorNarrative }) {
    const takeaways = [
        expertise.description,
        sectorNarrative,
        composition.ctaDescription || 'Trouvable documente les signaux contrôlables et ne promet pas de rang ni de citation IA garantie.',
    ].filter(Boolean).slice(0, 3);

    return (
        <section className="border-t border-white/[0.05] px-6 py-10 sm:px-10">
            <div className="mx-auto max-w-[960px]">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">À retenir</div>
                <ul className="grid gap-3 md:grid-cols-3">
                    {takeaways.map((item) => (
                        <li key={item} className="border-l border-violet-400/20 pl-4 text-[13.5px] leading-[1.65] text-white/62">
                            {item}
                        </li>
                    ))}
                </ul>
                <div className="mt-5 text-[12px] uppercase tracking-[0.08em] text-white/35">Par Trouvable</div>
            </div>
        </section>
    );
}

export default function ExpertisePageClient({ expertise, composition, linkedVilles }) {
    const heroHeadline = expertise.heroHeadline || expertise.name;
    const heroSubheadline = expertise.heroSubheadline || expertise.description;
    const sectorNarrative = expertise.sectorNarrative || composition.marketContext;
    const ctaLabel = expertise.ctaLabel || `Diagnostic ${expertise.name}`;
    const pageUrl = `${SITE_URL}/expertises/${expertise.slug}`;

    return (
        <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
            <Navbar />
            <GeoSeoInjector
                service={expertise}
                faqs={expertise.faqs}
                breadcrumbs={[{ name: "Accueil", url: "/" }, { name: "Expertises", url: null }, { name: expertise.name, url: "/expertises/" + expertise.slug }]}
                article={{
                    url: pageUrl,
                    headline: `${expertise.name} et visibilité IA`,
                    description: expertise.description,
                    about: ['visibilité IA sectorielle', expertise.name, 'SEO local'],
                    mentions: linkedVilles.map((ville) => `${SITE_URL}/villes/${ville.slug}`),
                }}
                itemList={{
                    id: `${pageUrl}#expertise-list`,
                    name: `Axes d'execution ${expertise.name}`,
                    pageUrl,
                    items: expertise.contentAngles?.slice(0, 6) || [],
                }}
                baseUrl={SITE_URL}
            />
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,#080808,#080808)]" />

            <main>
                {/* HERO */}
                <section className="relative mt-[58px] overflow-hidden px-6 pt-[80px] pb-10 sm:pt-[110px] sm:pb-16">
                    <div className="pointer-events-none absolute left-[-200px] top-[60px] h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(147,51,234,0.06),transparent_70%)]" />
                    <div className="relative z-[1] mx-auto max-w-[1100px] grid gap-12 lg:grid-cols-[1fr_380px] items-start">
                        <div>
                            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-violet-300">
                                <Briefcase className="h-3.5 w-3.5" /> {composition.heroAngle}
                            </motion.div>
                            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(32px,5.5vw,56px)] font-bold leading-[1.08] tracking-[-0.04em] mb-6">
                                {heroHeadline}
                            </motion.h1>
                            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }} className="max-w-[560px] text-[16px] leading-[1.7] text-[#a0a0a0]">
                                {heroSubheadline}
                            </motion.p>
                            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22 }} className="mt-8 flex flex-wrap gap-3">
                                <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                                    {ctaLabel} <ArrowRight className="h-4 w-4" />
                                </ContactButton>
                                <Link href="/offres" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-[#a0a0a0] transition hover:border-white/30 hover:text-white">
                                    Nos mandats
                                </Link>
                            </motion.div>

                            {/* Trust Dynamics - mobile compact */}
                            {expertise.trustDynamics && (
                                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="mt-8 flex flex-wrap gap-2 lg:hidden">
                                    {expertise.trustDynamics.map((td, i) => (
                                        <div key={i} className="flex items-center gap-2 rounded-lg border border-violet-500/15 bg-violet-500/5 px-3 py-2">
                                            <span className="text-[12px] font-bold text-violet-300">{td.value}</span>
                                            <span className="text-[11px] text-white/35">{td.label}</span>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Trust Dynamics Panel */}
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.2 }} className="hidden lg:block relative rounded-2xl border border-violet-500/15 bg-[#0a0a0a] p-7 shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-violet-500/40 to-transparent" />
                            {expertise.trustDynamics ? (
                                <>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-400/50 mb-6">Dynamiques du secteur</div>
                                    <div className="space-y-5">
                                        {expertise.trustDynamics.map((td, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet-500/20 bg-violet-500/8">
                                                    {i === 0 && <TrendingUp className="h-3.5 w-3.5 text-violet-400/70" />}
                                                    {i === 1 && <Shield className="h-3.5 w-3.5 text-violet-400/70" />}
                                                    {i === 2 && <Globe className="h-3.5 w-3.5 text-violet-400/70" />}
                                                </div>
                                                <div>
                                                    <div className="text-[13px] font-bold text-white/90 mb-0.5">{td.value}</div>
                                                    <div className="text-[11px] leading-[1.5] text-white/35">{td.label}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-400/50 mb-5">Périmètre d&apos;expertise</div>
                                    <div className="space-y-3">
                                        {expertise.contentAngles.slice(0, 4).map((angle, i) => (
                                            <div key={i} className="flex items-start gap-2.5 text-[12px] text-[#888]">
                                                <Zap className="h-3 w-3 shrink-0 mt-0.5 text-violet-400/60" />
                                                <span className="line-clamp-2">{angle}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                </section>

                {/* SECTOR STAKES */}
                {sectorNarrative && (
                    <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-16 sm:px-10 sm:py-20">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mx-auto max-w-[800px] rounded-2xl border border-white/[0.06] border-l-2 border-l-violet-500/30 bg-white/[0.015] p-8 sm:p-10">
                            <div className="mb-5 flex items-center gap-2.5">
                                <Globe className="h-5 w-5 text-violet-400/60" />
                                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-white/90">Pourquoi ce secteur, pourquoi maintenant</h2>
                            </div>
                            <p className="text-[15px] leading-[1.85] text-[#999]">{sectorNarrative}</p>
                        </motion.div>
                    </section>
                )}

                {/* SEARCH INTENTS */}
                <section className="border-t border-white/[0.05] px-6 py-16 sm:px-10 sm:py-20">
                    <div className="mx-auto max-w-[960px]">
                        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
                            <div className="mb-3 flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-500/20 bg-violet-500/10">
                                    <Search className="h-5 w-5 text-violet-400" />
                                </div>
                                <h2 className="text-xl font-bold tracking-[-0.02em]">
                                    {composition.intentsHeading || 'Comment vos clients vous cherchent'}
                                </h2>
                            </div>
                            <p className="mb-8 ml-[52px] text-[14px] leading-[1.65] text-[#a0a0a0]">
                                Les requêtes posées quotidiennement aux assistants IA dans votre secteur :
                            </p>
                        </motion.div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {expertise.searchIntents.map((intent, i) => (
                                <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.3 }} className="group flex items-start gap-3 rounded-xl border border-white/6 bg-white/[0.02] p-4 transition-all hover:border-violet-500/20 hover:bg-violet-500/[0.02]">
                                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-violet-400/50 group-hover:text-violet-400 transition-colors" />
                                    <span className="text-[13px] leading-[1.6] text-[#a0a0a0] italic group-hover:text-white/70 transition-colors">{intent}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* MANDATE EXECUTION */}
                <section className="border-t border-white/[0.05] px-6 py-16 sm:px-10 sm:py-20">
                    <div className="mx-auto max-w-[960px]">
                        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
                            <div className="mb-3 flex items-center gap-3">
                                <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#5b73ff]/20 bg-[#5b73ff]/10">
                                    <Layers className="h-5 w-5 text-[#7b8fff]" />
                                </div>
                                <h2 className="text-xl font-bold tracking-[-0.02em]">
                                    {composition.architectureHeading || 'Ce que nous exécutons pour votre secteur'}
                                </h2>
                            </div>
                            <p className="mb-10 ml-[52px] text-[14px] leading-[1.65] text-[#a0a0a0]">
                                Chaque axe de notre mandat se traduit par des livrables concrets, mesurables et orientés résultat.
                            </p>
                        </motion.div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {expertise.contentAngles.map((angle, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.35 }} className="group rounded-xl border border-white/6 bg-white/[0.015] p-6 transition-all hover:border-[#5b73ff]/20 hover:bg-[#5b73ff]/[0.02]">
                                    <div className="flex items-start gap-3 mb-3">
                                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#5b73ff]/20 bg-[#5b73ff]/8 text-[10px] font-bold text-[#7b8fff]">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <span className="text-[14px] font-semibold leading-[1.5] text-white/85 group-hover:text-white transition-colors pt-0.5">{angle}</span>
                                    </div>
                                    {expertise.useCases[i] && (
                                        <div className="ml-10 flex items-start gap-2 rounded-lg border border-emerald-400/10 bg-emerald-400/[0.03] px-4 py-3">
                                            <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/50" />
                                            <span className="text-[12px] leading-[1.6] text-emerald-200/50 group-hover:text-emerald-200/70 transition-colors">{expertise.useCases[i]}</span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* PROOF LINKS */}
                <section className="border-t border-white/[0.05] px-6 py-12 sm:px-10">
                    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="mx-auto max-w-[960px] flex flex-col gap-3 sm:flex-row sm:gap-6">
                        <Link href="/methodologie" className="group flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.015] px-5 py-4 transition-all hover:border-violet-500/20 hover:bg-violet-500/[0.02] flex-1">
                            <Layers className="h-4 w-4 text-violet-400/50 group-hover:text-violet-400 transition-colors" />
                            <div>
                                <div className="text-[13px] font-semibold text-white/80 group-hover:text-white transition-colors">Notre méthodologie</div>
                                <div className="text-[11px] text-white/30">Comment nous structurons la visibilité IA</div>
                            </div>
                            <ArrowRight className="ml-auto h-3.5 w-3.5 text-white/15 group-hover:text-violet-400/60 transition-all group-hover:translate-x-0.5" />
                        </Link>
                        <Link href="/etudes-de-cas/dossier-type" className="group flex items-center gap-3 rounded-xl border border-white/7 bg-white/[0.015] px-5 py-4 transition-all hover:border-violet-500/20 hover:bg-violet-500/[0.02] flex-1">
                            <BookOpen className="h-4 w-4 text-violet-400/50 group-hover:text-violet-400 transition-colors" />
                            <div>
                                <div className="text-[13px] font-semibold text-white/80 group-hover:text-white transition-colors">Dossier-type</div>
                                <div className="text-[11px] text-white/30">Voir un mandat d&apos;exécution concret</div>
                            </div>
                            <ArrowRight className="ml-auto h-3.5 w-3.5 text-white/15 group-hover:text-violet-400/60 transition-all group-hover:translate-x-0.5" />
                        </Link>
                    </motion.div>
                </section>

                {/* FAQ */}
                <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-16 sm:px-10 sm:py-20">
                    <div className="mx-auto max-w-[800px]">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-10">
                            <div className="mb-3 flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-amber-400" />
                                <h2 className="text-xl font-bold tracking-[-0.02em]">Questions fréquentes sur {expertise.name}</h2>
                            </div>
                        </motion.div>
                        <div className="space-y-2">
                            {expertise.faqs.map((faq, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}>
                                    <details className="group rounded-xl border border-white/7 bg-white/[0.02] transition hover:border-amber-400/15 [&_summary::-webkit-details-marker]:hidden">
                                        <summary className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium text-white/90 outline-none">
                                            <span>{faq.question}</span>
                                            <ChevronDown className="h-4 w-4 shrink-0 text-white/30 transition-transform group-open:rotate-180" />
                                        </summary>
                                        <div className="px-5 pb-5 text-[14px] leading-[1.65] text-[#a0a0a0]">
                                            <span>{faq.answer}</span>
                                        </div>
                                    </details>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CITY LINKS */}
                {linkedVilles.length > 0 && (
                    <section className="border-t border-white/[0.05] px-6 py-16 sm:px-10 sm:py-20">
                        <div className="mx-auto max-w-[960px]">
                            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-8">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="h-5 w-5 text-violet-400/60" />
                                    <h2 className="text-xl font-bold tracking-[-0.02em]">{expertise.name} : nos marchés locaux</h2>
                                </div>
                            </motion.div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {linkedVilles.map((v, i) => {
                                    const cityContext = expertise.cityContexts?.[v.slug];
                                    return (
                                        <motion.div key={v.slug} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }}>
                                            <Link href={"/villes/" + v.slug} className="group flex flex-col justify-between rounded-xl border border-white/7 bg-[#0a0a0a] p-6 transition-all hover:-translate-y-0.5 hover:border-violet-500/25 hover:bg-violet-500/[0.02] min-h-[120px]">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-3.5 w-3.5 text-violet-400/40 group-hover:text-violet-400/70 transition-colors" />
                                                        <h3 className="text-[15px] font-bold text-white group-hover:text-violet-300 transition-colors">{v.name}</h3>
                                                    </div>
                                                    <ArrowRight className="h-4 w-4 text-white/15 transition-all group-hover:translate-x-1 group-hover:text-violet-400" />
                                                </div>
                                                <p className="text-[13px] leading-[1.55] text-white/40 group-hover:text-white/55 transition-colors">
                                                    {cityContext || `Visibilité IA ${expertise.name.toLowerCase()}`}
                                                </p>
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>
                )}

                <KeyTakeawaysSection expertise={expertise} composition={composition} sectorNarrative={sectorNarrative} />

                {/* CTA */}
                <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#060606] px-6 py-24 sm:px-10 sm:py-28">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(147,51,234,0.04),transparent_60%)]" />
                    <div className="relative z-10 mx-auto max-w-[660px] text-center">
                        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-5 text-[clamp(24px,3.5vw,36px)] font-bold tracking-[-0.03em]">
                            {composition.ctaHeadline}
                        </motion.h2>
                        <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.08 }} className="mx-auto mb-10 max-w-md text-[15px] leading-[1.65] text-[#a0a0a0]">
                            {composition.ctaDescription}
                        </motion.p>
                        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.14 }} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                            <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8] hover:shadow-[0_20px_60px_rgba(255,255,255,0.06)]">
                                {ctaLabel} <ArrowRight className="h-4 w-4" />
                            </ContactButton>
                            <Link href={composition.ctaSecondaryHref} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-7 py-3.5 text-sm font-medium text-[#a0a0a0] transition hover:border-white/30 hover:text-white">
                                {composition.ctaSecondaryLabel}
                            </Link>
                        </motion.div>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
}
