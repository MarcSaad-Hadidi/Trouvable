'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Gauge, BarChart3, CheckCircle2, AlertTriangle, TrendingUp, Table2, ListChecks, Scale } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

function AnimatedGauge({ value, label, delay }) {
    const r = 36, c = 2 * Math.PI * r;
    return (<motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay }} className="flex flex-col items-center gap-2">
        <div className="relative h-20 w-20">
            <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80"><circle cx="40" cy="40" r={r} fill="none" stroke="rgba(249,115,22,0.1)" strokeWidth="4" /><motion.circle cx="40" cy="40" r={r} fill="none" stroke="rgb(249,115,22)" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} whileInView={{ strokeDashoffset: c * (1 - value / 100) }} viewport={{ once: true }} transition={{ duration: 1.5, delay: delay + 0.3, ease: 'easeOut' }} /></svg>
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[14px] font-bold text-orange-400">{value}</div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/30 text-center">{label}</span>
    </motion.div>);
}

export default function MesurerVisibiliteIaPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(234,88,12,0.03),transparent_50%),#0a0808]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                {/* Dashboard grid background */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.02)_1px,transparent_1px)] [background-size:80px_80px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_20%,transparent_100%)]" />
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-300"><Gauge className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <h1 className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em] text-orange-50">{page.h1}</h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    {/* Dashboard gauges */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-10 flex flex-wrap gap-6 justify-start">
                        {[{ v: 42, l: 'Visibilité IA' },{ v: 78, l: 'SEO classique' },{ v: 23, l: 'Citabilité' },{ v: 61, l: 'Cohérence' }].map((g, i) => <AnimatedGauge key={g.l} value={g.v} label={g.l} delay={0.8 + i * 0.15} />)}
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-3.5 text-sm font-semibold text-black hover:-translate-y-px hover:bg-orange-400 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-orange-400/20 px-6 py-3.5 text-sm font-medium text-orange-300/70 hover:border-orange-400/40 hover:text-orange-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-orange-400/[0.06] bg-[#0a0608] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-orange-400/12 bg-orange-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><BarChart3 className="h-5 w-5 text-orange-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-orange-400/70">Le défi de la mesure</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-orange-400/8 bg-[#0a0808] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>

            <section className="border-t border-orange-400/[0.06] bg-[#0a0608] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[1120px] grid gap-8 lg:grid-cols-2">
                    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-orange-400/12 bg-orange-400/[0.03] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-2"><ListChecks className="h-5 w-5 text-orange-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-orange-400/75">{page.measurementIndicatorsHeading}</span></div>
                        <ul className="space-y-3">{page.measurementIndicators.map((line) => (
                            <li key={line} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />{line}</li>
                        ))}</ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.06 }} className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-orange-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{page.measurementPromptExamplesHeading}</span></div>
                        <ul className="space-y-3">{page.measurementPromptExamples.map((p) => (
                            <li key={p} className="rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3 font-mono text-[12px] leading-[1.55] text-orange-100/90">{p}</li>
                        ))}</ul>
                    </motion.div>
                </div>
            </section>

            <section className="border-t border-orange-400/[0.06] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[1120px]">
                    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-6 flex items-center gap-2"><Table2 className="h-5 w-5 text-orange-400" /><h2 className="text-[clamp(20px,2.4vw,26px)] font-bold tracking-[-0.03em] text-orange-50">{page.measurementTableHeading}</h2></motion.div>
                    <div className="overflow-x-auto rounded-2xl border border-white/8 bg-[#0a0a0a]">
                        <table className="w-full min-w-[720px] border-collapse text-left text-[12px] sm:text-[13px]">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/[0.03]">
                                    {page.measurementTableColumns.map((col) => (
                                        <th key={col} className="px-4 py-3 font-semibold text-white/85">{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {page.measurementTableRows.map((row, ri) => (
                                    <tr key={ri} className="border-b border-white/6 last:border-0">
                                        {row.map((cell, ci) => (
                                            <td key={ci} className="px-4 py-3 leading-[1.55] text-[#a8a8a8]">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="border-t border-orange-400/[0.06] bg-[#0a0608] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[1120px] grid gap-8 lg:grid-cols-2">
                    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-white/8 bg-[#0a0a0a] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-2"><Scale className="h-5 w-5 text-orange-400" /><h2 className="text-[clamp(18px,2.2vw,22px)] font-bold tracking-[-0.02em] text-white">{page.competitorComparisonHeading}</h2></div>
                        <ul className="space-y-3">{page.competitorComparisonBullets.map((b) => (
                            <li key={b} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400/70" />{b}</li>
                        ))}</ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.06 }} className="rounded-2xl border border-orange-400/15 bg-orange-400/[0.04] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-orange-400" /><h2 className="text-[clamp(18px,2.2vw,22px)] font-bold tracking-[-0.02em] text-orange-50">{page.trouvableMethodHeading}</h2></div>
                        <ul className="space-y-3">{page.trouvableMethodBullets.map((b) => (
                            <li key={b} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#c8c8c8]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-400/60" />{b}</li>
                        ))}</ul>
                    </motion.div>
                </div>
            </section>

            {/* Dashboard widget layout */}
            <section className="border-t border-orange-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px] grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
                    {[{ t: 'Angles morts', items: page.problems, icon: AlertTriangle, c: 'text-red-400', dc: 'bg-red-400' },
                      { t: 'Calibrages', items: page.corrections, icon: TrendingUp, c: 'text-orange-400', dc: 'bg-orange-400' },
                      { t: 'Tableaux livrés', items: page.deliverables, icon: CheckCircle2, c: 'text-emerald-400', dc: 'bg-emerald-400' }
                    ].map((s, si) => (
                        <motion.div key={s.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.1 }} className="rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden hover:border-orange-400/20 transition">
                            <div className="border-b border-white/5 bg-white/[0.02] px-5 py-3 flex items-center gap-2"><s.icon className={`h-4 w-4 ${s.c}`} /><h3 className="text-[14px] font-bold">{s.t}</h3></div>
                            <div className="p-5"><ul className="space-y-3">{s.items.map((item, i) => <motion.li key={item} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: si * 0.1 + i * 0.05 }} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dc}`} />{item}</motion.li>)}</ul></div>
                        </motion.div>
                    ))}
                </div>
            </section>
            <section className="border-t border-orange-400/[0.06] bg-[#0a0608] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="orange" heading="Questions sur la mesure" /></section>
            <section className="border-t border-orange-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="orange" heading="Outils adjacents" /></section>

        </main>
    </>);
}

