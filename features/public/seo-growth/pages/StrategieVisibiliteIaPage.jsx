'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Target, Brain, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

export default function StrategieVisibiliteIaPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(217,70,239,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(192,38,211,0.03),transparent_50%),#0a080c]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                {/* Strategy grid */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(217,70,239,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(217,70,239,0.03)_1px,transparent_1px)] [background-size:60px_60px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_20%,transparent_100%)]" />
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-fuchsia-400/20 bg-fuchsia-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-fuchsia-300"><Target className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em]"><span className="bg-gradient-to-r from-fuchsia-200 via-white to-fuchsia-200/60 bg-clip-text text-transparent">{page.h1}</span></motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-fuchsia-500 px-6 py-3.5 text-sm font-semibold text-white hover:-translate-y-px hover:bg-fuchsia-400 hover:shadow-[0_0_30px_rgba(217,70,239,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-400/20 px-6 py-3.5 text-sm font-medium text-fuchsia-300/70 hover:border-fuchsia-400/40 hover:text-fuchsia-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-fuchsia-400/[0.06] bg-[#08060c] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-fuchsia-400/12 bg-fuchsia-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><Brain className="h-5 w-5 text-fuchsia-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-fuchsia-400/70">Vision stratégique</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-fuchsia-400/8 bg-[#0a080c] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            {/* Chess-board alternating layout */}
            <section className="border-t border-fuchsia-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px] grid gap-6 lg:grid-cols-2">
                    {[{ t: 'Positions à défendre', items: page.problems, icon: AlertTriangle, c: 'text-red-400', dc: 'bg-red-400', border: 'border-red-400/10' },
                      { t: 'Mouvements stratégiques', items: page.corrections, icon: Lightbulb, c: 'text-fuchsia-400', dc: 'bg-fuchsia-400', border: 'border-fuchsia-400/10' }
                    ].map((s, si) => (
                        <motion.div key={s.t} initial={{ opacity: 0, y: 20, x: si === 0 ? -10 : 10 }} whileInView={{ opacity: 1, y: 0, x: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.1 }} className={`rounded-2xl border ${s.border} bg-[#0a0a0a] p-6`}>
                            <div className="mb-5 flex items-center gap-3"><s.icon className={`h-5 w-5 ${s.c}`} /><h3 className="text-[16px] font-bold">{s.t}</h3></div>
                            <ul className="space-y-3">{s.items.map((item, i) => <motion.li key={item} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: si * 0.1 + i * 0.05 }} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dc}`} />{item}</motion.li>)}</ul>
                        </motion.div>
                    ))}
                </div>
                <div className="mx-auto mt-6 max-w-[1120px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-emerald-400/10 bg-[#0a0a0a] p-6">
                        <div className="mb-5 flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><h3 className="text-[16px] font-bold">Livrables stratégiques</h3></div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{page.deliverables.map((d, i) => <motion.div key={d} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 rounded-lg border border-emerald-400/8 bg-emerald-400/[0.02] p-3"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/50" /><span className="text-[12px] leading-[1.6] text-[#a8a8a8]">{d}</span></motion.div>)}</div>
                    </motion.div>
                </div>
            </section>
            <section className="border-t border-fuchsia-400/[0.06] bg-[#08060c] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="fuchsia" heading="Questions stratégiques" /></section>
            <section className="border-t border-fuchsia-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="fuchsia" heading="Pièces complémentaires" /></section>

        </main>
    </>);
}

