"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import ContactButton from "@/features/public/shared/ContactButton";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import GeoSeoInjector from "@/features/public/shared/GeoSeoInjector";
import { SITE_URL } from "@/lib/site-config";
import { ArrowRight, MapPin, AlertTriangle, Wrench, BarChart3, HelpCircle, ChevronDown, Compass, Radio, Globe } from "lucide-react";

const SECTION_CONFIG = {
    problems: {
        iconColor: "text-red-400",
        iconBorder: "border-red-400/20",
        iconBg: "bg-red-400/10",
        sectionBg: "bg-[#080808]",
    },
    methodology: {
        iconColor: "text-[#7b8fff]",
        iconBorder: "border-[#5b73ff]/20",
        iconBg: "bg-[#5b73ff]/10",
        numberBorder: "border-[#5b73ff]/20",
        numberBg: "bg-[#5b73ff]/8",
        numberColor: "text-[#7b8fff]",
        sectionBg: "bg-[#060606]",
    },
    signals: {
        iconColor: "text-emerald-400",
        iconBorder: "border-emerald-400/20",
        iconBg: "bg-emerald-400/10",
        sectionBg: "bg-[#080808]",
    },
};

function ProblemsSection({ data, heading, description, config }) {
    return (
        <section className={`border-t border-white/[0.05] ${config.sectionBg} px-6 py-20 sm:px-10`}>
            <div className="mx-auto max-w-[900px]">
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                    <div className="mb-3 flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl border ${config.iconBorder} ${config.iconBg}`}>
                            <AlertTriangle className={`h-5 w-5 ${config.iconColor}`} />
                        </div>
                        <h2 className="text-xl font-bold tracking-[-0.02em]">{heading}</h2>
                    </div>
                    <p className="mb-10 ml-[52px] text-[14px] leading-[1.65] text-[#888]">{description}</p>
                </motion.div>
                <div className="space-y-3">
                    {data.map((p, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }} className="group rounded-xl border border-white/5 border-l-2 border-l-red-400/25 bg-white/[0.015] p-5 pl-6 transition-all hover:border-l-red-400/50 hover:bg-red-400/[0.02] cursor-default">
                            <span className="text-[14px] leading-[1.75] text-[#a0a0a0] group-hover:text-white/75 transition-colors">{p}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function MethodologySection({ data, heading, description, config }) {
    return (
        <section className={`border-t border-white/[0.05] ${config.sectionBg} px-6 py-20 sm:px-10`}>
            <div className="mx-auto max-w-[1100px] grid gap-8 lg:grid-cols-[380px_1fr] lg:gap-16 items-start">
                <div className="lg:sticky lg:top-28">
                    <div className="mb-4 flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl border ${config.iconBorder} ${config.iconBg}`}>
                            <Wrench className={`h-5 w-5 ${config.iconColor}`} />
                        </div>
                        <h2 className="text-xl font-bold tracking-[-0.02em]">{heading}</h2>
                    </div>
                    <p className="text-[14px] leading-[1.65] text-[#888]">{description}</p>
                </div>
                <div className="relative">
                    <div className="absolute left-[18px] top-5 bottom-5 w-px bg-gradient-to-b from-[#5b73ff]/25 via-[#5b73ff]/8 to-transparent hidden sm:block" />
                    <div className="space-y-4">
                        {data.map((step, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: i * 0.08 }} className="group relative flex items-start gap-5 rounded-xl border border-white/5 bg-white/[0.015] p-5 transition-all hover:border-[#5b73ff]/20 hover:bg-[#5b73ff]/[0.015] cursor-default">
                                <span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full border ${config.numberBorder} ${config.numberBg} text-[12px] font-bold ${config.numberColor}`}>{String(i + 1).padStart(2, '0')}</span>
                                <span className="text-[14px] leading-[1.7] text-[#a0a0a0] group-hover:text-white/75 transition-colors pt-1.5">{step}</span>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function SignalsSection({ data, heading, description, config }) {
    return (
        <section className={`relative border-t border-white/[0.05] ${config.sectionBg} px-6 py-20 sm:px-10`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(52,211,153,0.03),transparent_60%)]" />
            <div className="relative mx-auto max-w-[900px]">
                <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                    <div className="mb-3 flex items-center gap-3">
                        <div className={`grid h-10 w-10 place-items-center rounded-xl border ${config.iconBorder} ${config.iconBg}`}>
                            <BarChart3 className={`h-5 w-5 ${config.iconColor}`} />
                        </div>
                        <h2 className="text-xl font-bold tracking-[-0.02em]">{heading}</h2>
                    </div>
                    <p className="mb-10 ml-[52px] text-[14px] leading-[1.65] text-[#888]">{description}</p>
                </motion.div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {data.map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.05 }} className="group flex items-start gap-3.5 rounded-xl border border-white/6 bg-white/[0.02] p-4 transition-all hover:border-emerald-400/20 hover:bg-emerald-400/[0.015] cursor-default">
                            <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/40 group-hover:text-emerald-400/70 transition-colors" />
                            <span className="text-[13px] leading-[1.6] text-[#a0a0a0] group-hover:text-white/70 transition-colors">{s}</span>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function KeyTakeawaysSection({ ville, composition }) {
    const takeaways = [
        composition.heroTagline,
        composition.marketContext,
        ville.proofNote || 'Trouvable documente les corrections réalisées et ne promet pas de rang, de citation IA ou de volume de contact garanti.',
    ].filter(Boolean).slice(0, 3);

    return (
        <section className="border-t border-white/[0.05] px-6 py-10 sm:px-10">
            <div className="mx-auto max-w-[900px]">
                <div className="mb-4 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">À retenir</div>
                <ul className="grid gap-3 md:grid-cols-3">
                    {takeaways.map((item) => (
                        <li key={item} className="border-l border-emerald-400/20 pl-4 text-[13.5px] leading-[1.65] text-white/62">
                            {item}
                        </li>
                    ))}
                </ul>
                <div className="mt-5 text-[12px] uppercase tracking-[0.08em] text-white/35">Par Trouvable</div>
            </div>
        </section>
    );
}

export default function VillePageClient({ ville, composition, linkedExpertises }) {
    const pageUrl = `${SITE_URL}/villes/${ville.slug}`;

    return (
        <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
            <Navbar />
            <GeoSeoInjector
                faqs={ville.faqs}
                breadcrumbs={[{ name: "Accueil", url: "/" }, { name: "Villes", url: null }, { name: ville.name, url: "/villes/" + ville.slug }]}
                article={{
                    url: pageUrl,
                    headline: `Visibilité IA à ${ville.name}`,
                    description: ville.description,
                    datePublished: undefined,
                    about: ['visibilité IA locale', ville.name, 'SEO local'],
                    mentions: linkedExpertises.map((expertise) => `${SITE_URL}/expertises/${expertise.slug}`),
                }}
                itemList={{
                    id: `${pageUrl}#ville-items`,
                    name: `Signaux et étapes à ${ville.name}`,
                    pageUrl,
                    items: [...ville.problems, ...ville.methodology, ...ville.signals].slice(0, 12),
                }}
                baseUrl={SITE_URL}
            />
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,#080808,#080808)]" />

            <main>
                {/* HERO */}
                <section className="relative mt-[58px] overflow-hidden px-6 pt-[90px] pb-0 sm:pt-[120px]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(52,211,153,0.06),transparent_55%)]" />
                    <div className="pointer-events-none absolute left-[-100px] top-[-60px] h-[300px] w-[300px] bg-[radial-gradient(circle,rgba(91,115,255,0.04),transparent_70%)]" />
                    <div className="relative z-[1] mx-auto max-w-[1100px] text-center">
                        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-300">
                            <MapPin className="h-3.5 w-3.5" /> {composition.heroAngle}
                        </motion.div>
                        <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(44px,8vw,96px)] font-bold leading-[0.98] tracking-[-0.05em] mb-5">
                            <span className="bg-gradient-to-r from-emerald-400 to-[#5b73ff] bg-clip-text text-transparent">{ville.name}</span>
                        </motion.h1>
                        {composition.heroTagline && (
                            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.11 }} className="mx-auto max-w-[640px] text-[18px] font-medium leading-[1.5] text-white/80 mb-4 tracking-[-0.01em]">
                                {composition.heroTagline}
                            </motion.p>
                        )}
                        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.17 }} className="mx-auto max-w-[600px] text-[15px] leading-[1.65] text-[#888]">
                            {ville.description}
                        </motion.p>
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="mt-8 flex flex-wrap justify-center gap-3">
                            <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                                Diagnostic à {ville.name} <ArrowRight className="h-4 w-4" />
                            </ContactButton>
                            <Link href="/methodologie" className="inline-flex items-center gap-2 rounded-lg border border-white/12 px-6 py-3 text-sm font-medium text-[#a0a0a0] transition hover:border-white/25 hover:text-white">
                                Notre approche <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </motion.div>
                    </div>
                </section>

                <KeyTakeawaysSection ville={ville} composition={composition} />

                {/* SIGNAL BAR */}
                <section className="border-t border-white/[0.05] mt-16 px-6 py-5 sm:px-10">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mx-auto max-w-[1100px] flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-center">
                        {(composition.signalItems || [
                            { value: String(ville.signals.length), label: 'Signaux trackés' },
                            { value: String(ville.problems.length), label: 'Failles identifiées' },
                            { value: String(ville.methodology.length), label: 'Étapes de déploiement' },
                        ]).map((item) => (
                            <div key={item.label} className="text-center">
                                <div className="text-[22px] font-bold text-white tracking-[-0.02em]">{item.value}</div>
                                <div className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-white/30">{item.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </section>

                {/* MARKET CONTEXT */}
                {composition.marketContext && (
                    <section className="border-t border-white/[0.05] px-6 py-14 sm:px-10">
                        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mx-auto max-w-[800px] flex items-start gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-8">
                            <Globe className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400/60" />
                            <div>
                                <h2 className="mb-2 text-[15px] font-bold tracking-[-0.01em] text-white/90">{composition.marketContextHeading || 'Contexte de marché'}</h2>
                                <p className="text-[14px] leading-[1.7] text-[#a0a0a0]">{composition.marketContext}</p>
                            </div>
                        </motion.div>
                    </section>
                )}

                {/* CONTENT SECTIONS - composition-ordered, each with distinct layout */}
                {composition.sectionOrder.map((sectionId) => {
                    const config = SECTION_CONFIG[sectionId];
                    const heading = composition[`${sectionId}Heading`];
                    const description = composition[`${sectionId}Description`];
                    const data = ville[sectionId];
                    if (sectionId === 'problems') return <ProblemsSection key={sectionId} data={data} heading={heading} description={description} config={config} />;
                    if (sectionId === 'methodology') return <MethodologySection key={sectionId} data={data} heading={heading} description={description} config={config} />;
                    if (sectionId === 'signals') return <SignalsSection key={sectionId} data={data} heading={heading} description={description} config={config} />;
                    return null;
                })}

                {/* FAQ */}
                <section className="border-t border-white/[0.05] bg-[#060606] px-6 py-20 sm:px-10">
                    <div className="mx-auto max-w-[800px]">
                        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-10">
                            <div className="mb-3 flex items-center gap-2">
                                <HelpCircle className="h-5 w-5 text-amber-400" />
                                <h2 className="text-xl font-bold tracking-[-0.02em]">Questions fréquentes à {ville.name}</h2>
                            </div>
                            <p className="text-[13px] text-[#666] mt-1">Les questions que posent les entreprises de {ville.name} avant de démarrer.</p>
                        </motion.div>
                        <div className="space-y-2">
                            {ville.faqs.map((faq, i) => (
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

                {/* INTERNAL LINKS */}
                {linkedExpertises.length > 0 && (
                    <section className="border-t border-white/[0.05] px-6 py-20 sm:px-10">
                        <div className="mx-auto max-w-[960px]">
                            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-8">
                                <h2 className="text-xl font-bold tracking-[-0.02em]">Nos expertises à {ville.name}</h2>
                            </motion.div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {linkedExpertises.map((exp, i) => (
                                    <motion.div key={exp.slug} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.06 }}>
                                        <Link href={"/expertises/" + exp.slug} className="group flex flex-col rounded-xl border border-white/7 bg-[#0a0a0a] p-6 transition-all hover:-translate-y-0.5 hover:border-emerald-400/25 hover:bg-emerald-400/[0.02] min-h-[110px]">
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-[15px] font-bold text-white group-hover:text-emerald-300 transition-colors">{exp.name}</h3>
                                                <ArrowRight className="h-4 w-4 text-white/15 transition-all group-hover:translate-x-1 group-hover:text-emerald-400" />
                                            </div>
                                            <p className="text-[13px] leading-[1.55] text-white/40 group-hover:text-emerald-300/50 transition-colors">
                                                {(composition.expertiseContext && composition.expertiseContext[exp.slug]) || 'Expertise sectorielle'}
                                            </p>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* CTA - composition-driven */}
                <section className="relative overflow-hidden border-t border-white/[0.05] bg-[#060606] px-6 py-28 sm:px-10">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.04),transparent_55%)]" />
                    <div className="relative z-10 mx-auto max-w-[700px] text-center">
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                            <Compass className="mx-auto mb-6 h-10 w-10 text-emerald-400/70" />
                        </motion.div>
                        <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.06 }} className="mb-5 text-[clamp(24px,3.5vw,36px)] font-bold tracking-[-0.03em]">
                            {composition.ctaHeadline}
                        </motion.h2>
                        <motion.p initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.12 }} className="mx-auto mb-10 max-w-lg text-[15px] leading-[1.65] text-[#a0a0a0]">
                            {composition.ctaDescription}
                        </motion.p>
                        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.18 }} className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
                            <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8] hover:shadow-[0_20px_60px_rgba(255,255,255,0.06)]">
                                Diagnostic personnalisé à {ville.name} <ArrowRight className="h-4 w-4" />
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
