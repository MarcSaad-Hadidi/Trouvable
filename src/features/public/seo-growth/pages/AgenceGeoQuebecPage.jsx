'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Crown, Landmark, CheckCircle2, Shield, Swords } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

export default function AgenceGeoQuebecPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(251,191,36,0.03),transparent_50%),#080810]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                {/* Regal pattern */}
                <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'repeating-conic-gradient(rgba(251,191,36,0.3) 0% 25%, transparent 0% 50%)', backgroundSize: '40px 40px' }} />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080810]/80 via-transparent to-[#080810]" />
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring' }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300"><Crown className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="max-w-[860px] text-[clamp(40px,7vw,80px)] font-bold leading-[1.02] tracking-[-0.05em]"><span className="bg-gradient-to-r from-amber-200/80 via-white to-indigo-200/60 bg-clip-text text-transparent">{page.h1}</span></motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-7 max-w-[640px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-amber-500/80 px-6 py-3.5 text-sm font-semibold text-white hover:-translate-y-px hover:shadow-[0_0_30px_rgba(99,102,241,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-indigo-400/20 px-6 py-3.5 text-sm font-medium text-indigo-300/70 hover:border-indigo-400/40 hover:text-indigo-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-indigo-400/[0.06] bg-[#060610] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-indigo-400/12 bg-indigo-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><Landmark className="h-5 w-5 text-indigo-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-400/70">Marché de Québec</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-indigo-400/8 bg-[#0a0a10] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            {/* Fortress-wall layout: stacked fortified blocks */}
            <section className="border-t border-indigo-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px]">
                    {[{ t: 'Menaces sur le territoire', items: page.problems, icon: Swords, c: 'text-red-400', ac: 'border-l-red-400/30', dc: 'bg-red-400' },
                      { t: 'Fortification des positions', items: page.corrections, icon: Shield, c: 'text-indigo-400', ac: 'border-l-indigo-400/30', dc: 'bg-indigo-400' },
                      { t: 'Livrables du mandat', items: page.deliverables, icon: CheckCircle2, c: 'text-emerald-400', ac: 'border-l-emerald-400/30', dc: 'bg-emerald-400' }
                    ].map((s, si) => (
                        <motion.div key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.1 }} className={`mb-6 last:mb-0 rounded-2xl border border-white/8 border-l-2 ${s.ac} bg-[#0a0a0a] p-6`}>
                            <div className="mb-5 flex items-center gap-3"><s.icon className={`h-5 w-5 ${s.c}`} /><h3 className="text-[16px] font-bold">{s.t}</h3></div>
                            <div className="grid gap-3 sm:grid-cols-2">{s.items.map((item, i) => <motion.div key={item} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: si * 0.1 + i * 0.05 }} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dc}`} />{item}</motion.div>)}</div>
                        </motion.div>
                    ))}
                </div>
            </section>
            <section className="border-t border-indigo-400/[0.06] bg-[#060610] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="indigo" heading="Questions sur Québec" /></section>
            <section className="border-t border-indigo-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="indigo" heading="Territoires adjacents" /></section>

        </main>
    </>);
}

