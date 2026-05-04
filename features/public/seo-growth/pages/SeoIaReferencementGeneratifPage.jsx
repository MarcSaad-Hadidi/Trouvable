'use client';
import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, FlaskConical, Microscope, Gauge, Beaker } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

function LabGrid() {
    return (<div className="pointer-events-none fixed inset-0 -z-10"><div className="absolute inset-0 bg-[#080a08]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]"><defs><pattern id="labg" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgb(52,211,153)" strokeWidth="0.5" /></pattern></defs><rect width="100%" height="100%" fill="url(#labg)" /></svg>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[800px] bg-[radial-gradient(ellipse,rgba(52,211,153,0.06)_0%,transparent_60%)]" /></div>);
}

function ProgressBar({ label, delay, color }) {
    return (<motion.div initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay }}>
        <div className="mb-1.5 flex items-center justify-between"><span className="text-[12px] font-medium text-white/60">{label}</span><span className="font-mono text-[10px] text-emerald-400/60">ANALYZING</span></div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5"><motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: '0%' }} whileInView={{ width: `${60 + Math.random() * 35}%` }} viewport={{ once: true }} transition={{ duration: 1.5, delay: delay + 0.3, ease: 'easeOut' }} /></div>
    </motion.div>);
}

export default function SeoIaReferencementGeneratifPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
    const [revealed, setRevealed] = useState(false);
    useEffect(() => { const t = setTimeout(() => setRevealed(true), 300); return () => clearTimeout(t); }, []);
    return (<>
        <LabGrid />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-20 pt-[82px] sm:px-10 sm:pt-[112px]">
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-300"><FlaskConical className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <h1 className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em]">
                        {revealed ? page.h1.split(' ').map((word, wi, arr) => { const charsBefore = arr.slice(0, wi).reduce((a, w) => a + w.length + 1, 0); return (<span key={wi} className="inline-block whitespace-nowrap">{word.split('').map((ch, ci) => <motion.span key={ci} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (charsBefore + ci) * 0.02, duration: 0.15 }} className="inline-block">{ch}</motion.span>)}{wi < arr.length - 1 && <span>&nbsp;</span>}</span>); }) : <span className="opacity-0">{page.h1}</span>}
                    </h1>
                    <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, delay: 0.8 }} className="mt-4 h-px origin-left bg-gradient-to-r from-emerald-400/40 via-emerald-400/20 to-transparent" />
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-8 flex flex-wrap gap-6">
                        {[{ v: String(page.problems.length), l: 'Variables' },{ v: String(page.corrections.length), l: 'Corrections' },{ v: String(page.deliverables.length), l: 'Livrables' }].map(s => <div key={s.l} className="text-center"><div className="font-mono text-2xl font-bold text-emerald-400">{s.v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/30">{s.l}</div></div>)}
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-black hover:-translate-y-px hover:bg-emerald-400 hover:shadow-[0_0_30px_rgba(52,211,153,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 px-6 py-3.5 text-sm font-medium text-emerald-300/70 hover:border-emerald-400/40 hover:text-emerald-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            {/* Analysis panel with progress bars */}
            <section className="border-t border-emerald-400/[0.08] bg-[#060a06] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px] grid gap-6 lg:grid-cols-[1fr_320px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-emerald-400/10 bg-[#0a0a0a] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><Microscope className="h-5 w-5 text-emerald-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-400/70">Analyse</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 border-t border-emerald-400/10 pt-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="rounded-2xl border border-emerald-400/10 bg-[#0a0a0a] p-6">
                        <div className="mb-5 flex items-center gap-2"><Gauge className="h-4 w-4 text-emerald-400" /><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400/60">Indicateurs</span></div>
                        <div className="space-y-4">{['Clarté des services', 'Cohérence IA', 'Maillage interne', 'Données structurées', 'Citabilité'].map((l, i) => <ProgressBar key={l} label={l} delay={i * 0.08} color={i < 2 ? '#f87171' : i < 4 ? '#fbbf24' : '#34d399'} />)}</div>
                    </motion.div>
                </div>
            </section>
            {/* Drawers */}
            <section className="border-t border-emerald-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px]">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10"><h2 className="text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.035em]">Résultats de l&apos;analyse</h2><div className="mt-2 h-px bg-gradient-to-r from-emerald-400/30 to-transparent" /></motion.div>
                    <div className="grid gap-5 lg:grid-cols-3">
                        {[{ title: 'Anomalies relevées', items: page.problems, e: 'a', bc: 'border-red-400/15', dc: 'bg-red-400' },{ title: 'Protocole correctif', items: page.corrections, e: 'a', bc: 'border-emerald-400/15', dc: 'bg-emerald-400' },{ title: 'Livrables du mandat', items: page.deliverables, e: 'S', bc: 'border-amber-400/15', dc: 'bg-amber-400' }].map((d, pi) => (
                            <motion.div key={d.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: pi * 0.1 }} className={`overflow-hidden rounded-2xl border ${d.bc} bg-[#0a0a0a] hover:shadow-[0_20px_60px_rgba(52,211,153,0.04)] transition`}>
                                <div className="border-b border-white/5 bg-white/[0.02] px-5 py-3"><div className="flex items-center gap-2"><span className="text-lg">{d.e}</span><h3 className="text-[14px] font-bold">{d.title}</h3><span className="ml-auto rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-white/30">{d.items.length}</span></div></div>
                                <div className="p-5"><ul className="space-y-3">{d.items.map((item, i) => <motion.li key={item} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: pi * 0.1 + i * 0.06 }} className="flex items-start gap-3 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${d.dc}`} />{item}</motion.li>)}</ul></div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="border-t border-emerald-400/[0.06] bg-[#060a06] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="emerald" heading="Protocole de réponse" icon={Beaker} /></section>
            <section className="border-t border-emerald-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="emerald" heading="0tudes connexes" /></section>

        </main>
    </>);
}

