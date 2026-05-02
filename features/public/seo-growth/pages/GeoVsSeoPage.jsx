'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Scale, GitCompareArrows, CheckCircle2, XCircle, ArrowLeftRight } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

export default function GeoVsSeoPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(168,85,247,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.04),transparent_55%),#080810]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                {/* Split-screen dual glow */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.06),transparent_70%)]" />
                    <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_center,rgba(52,211,153,0.06),transparent_70%)]" />
                    <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 1.5, delay: 0.5 }} className="absolute left-1/2 top-[10%] bottom-[10%] w-px -translate-x-1/2 origin-top bg-gradient-to-b from-purple-400/20 via-white/10 to-emerald-400/20" />
                </div>
                <div className="relative z-[1] mx-auto max-w-[960px] text-center">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-400/20 bg-purple-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-purple-300"><Scale className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="text-[clamp(40px,7vw,80px)] font-bold leading-[1.02] tracking-[-0.05em]"><span className="bg-gradient-to-r from-purple-300 via-white to-emerald-300 bg-clip-text text-transparent">{page.h1}</span></motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mx-auto mt-7 max-w-[640px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-7 py-3.5 text-sm font-semibold text-white hover:-translate-y-px hover:bg-purple-400 hover:shadow-[0_0_30px_rgba(168,85,247,0.25)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-purple-400/20 px-7 py-3.5 text-sm font-medium text-purple-300/70 hover:border-purple-400/40 hover:text-purple-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-purple-400/[0.06] bg-[#060610] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-purple-400/12 bg-purple-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><GitCompareArrows className="h-5 w-5 text-purple-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-purple-400/70">GEO vs SEO : la différence</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-purple-400/8 bg-[#0a0a10] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            {/* Side-by-side comparison layout */}
            <section className="border-t border-purple-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px] grid gap-6 lg:grid-cols-2">
                    <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-2xl border border-purple-400/15 bg-purple-400/[0.02] p-6">
                        <div className="mb-5 flex items-center gap-3"><XCircle className="h-5 w-5 text-red-400" /><h3 className="text-[16px] font-bold">Problèmes identifiés</h3></div>
                        <ul className="space-y-3">{page.problems.map((p, i) => <motion.li key={p} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{p}</motion.li>)}</ul>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.02] p-6">
                        <div className="mb-5 flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><h3 className="text-[16px] font-bold">Corrections appliquées</h3></div>
                        <ul className="space-y-3">{page.corrections.map((c, i) => <motion.li key={c} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{c}</motion.li>)}</ul>
                    </motion.div>
                </div>
                {/* Centered deliverables */}
                <div className="mx-auto mt-8 max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center gap-3 mb-6 justify-center"><ArrowLeftRight className="h-5 w-5 text-purple-400" /><h3 className="text-[16px] font-bold">Livrables du mandat</h3></motion.div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{page.deliverables.map((d, i) => <motion.div key={d} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 hover:border-purple-400/20 transition"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-purple-400/50" /><span className="text-[13px] leading-[1.65] text-[#a8a8a8]">{d}</span></motion.div>)}</div>
                </div>
            </section>
            <section className="border-t border-purple-400/[0.06] bg-[#060610] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="purple" heading="Questions sur GEO vs SEO" /></section>
            <section className="border-t border-purple-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="purple" heading="Approfondissements" /></section>

        </main>
    </>);
}

