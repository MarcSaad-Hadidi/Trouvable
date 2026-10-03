'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Blocks, Component, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

function AnimatedBlock({ children, delay, className }) {
    return (<motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ delay, type: 'spring', stiffness: 200 }} className={className}>{children}</motion.div>);
}

export default function StructurerSiteMoteursIaPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(132,204,22,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(101,163,13,0.03),transparent_50%),#080a06]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                {/* Layered blocks animation in hero */}
                <div className="pointer-events-none absolute right-[10%] top-[80px] hidden lg:block">
                    {[0,1,2,3].map(i => <motion.div key={i} initial={{ opacity: 0, y: 60 - i * 10, x: i * 8 }} animate={{ opacity: 0.1 + i * 0.03, y: i * 10 }} transition={{ delay: 0.5 + i * 0.15, type: 'spring' }} className="absolute rounded-lg border border-lime-400/15 bg-lime-400/[0.03]" style={{ width: 200 - i * 10, height: 50, right: i * 10, top: i * 55 }} />)}
                </div>
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-lg border border-lime-400/20 bg-lime-400/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-lime-300"><Blocks className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em]"><span className="bg-gradient-to-r from-lime-200 via-white to-lime-200/60 bg-clip-text text-transparent">{page.h1}</span></motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-6 py-3.5 text-sm font-semibold text-black hover:-translate-y-px hover:bg-lime-400 hover:shadow-[0_0_30px_rgba(132,204,22,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-lime-400/20 px-6 py-3.5 text-sm font-medium text-lime-300/70 hover:border-lime-400/40 hover:text-lime-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-lime-400/[0.06] bg-[#060a06] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-lime-400/12 bg-lime-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><Component className="h-5 w-5 text-lime-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-lime-400/70">Architecture de site IA</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-lime-400/8 bg-[#080a06] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            {/* Layered building blocks - stacking up */}
            <section className="border-t border-lime-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px]">
                    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-10"><h2 className="text-[clamp(24px,3vw,36px)] font-bold tracking-[-0.035em]">Architecture en couches</h2><div className="mt-2 h-px bg-gradient-to-r from-lime-400/30 to-transparent" /></motion.div>
                    {/* Layer 1: Foundation (problems) */}
                    <AnimatedBlock delay={0} className="mb-4">
                        <div className="rounded-2xl border-2 border-red-400/15 bg-[#0a0a0a] p-6">
                            <div className="mb-4 flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-red-400" /><h3 className="text-[15px] font-bold">Couche 1 : Failles structurelles</h3><span className="ml-auto rounded-md bg-red-400/10 px-2 py-0.5 font-mono text-[9px] text-red-400">FONDATION</span></div>
                            <div className="grid gap-2 sm:grid-cols-2">{page.problems.map((p, i) => <div key={p} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{p}</div>)}</div>
                        </div>
                    </AnimatedBlock>
                    {/* Layer 2: Construction (corrections) */}
                    <AnimatedBlock delay={0.15} className="mb-4 ml-4 lg:ml-8">
                        <div className="rounded-2xl border-2 border-lime-400/15 bg-[#0a0a0a] p-6">
                            <div className="mb-4 flex items-center gap-3"><Wrench className="h-5 w-5 text-lime-400" /><h3 className="text-[15px] font-bold">Couche 2 : Construction</h3><span className="ml-auto rounded-md bg-lime-400/10 px-2 py-0.5 font-mono text-[9px] text-lime-400">STRUCTURE</span></div>
                            <div className="grid gap-2 sm:grid-cols-2">{page.corrections.map((c, i) => <div key={c} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-400" />{c}</div>)}</div>
                        </div>
                    </AnimatedBlock>
                    {/* Layer 3: Output (deliverables) */}
                    <AnimatedBlock delay={0.3} className="ml-8 lg:ml-16">
                        <div className="rounded-2xl border-2 border-emerald-400/15 bg-[#0a0a0a] p-6">
                            <div className="mb-4 flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-400" /><h3 className="text-[15px] font-bold">Couche 3 : Livrables</h3><span className="ml-auto rounded-md bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] text-emerald-400">SORTIE</span></div>
                            <div className="grid gap-2 sm:grid-cols-2">{page.deliverables.map((d, i) => <div key={d} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#a8a8a8]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />{d}</div>)}</div>
                        </div>
                    </AnimatedBlock>
                </div>
            </section>
            <section className="border-t border-lime-400/[0.06] bg-[#060a06] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="lime" heading="Questions sur l'architecture" /></section>
            <section className="border-t border-lime-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="lime" heading="Fondations connexes" /></section>

        </main>
    </>);
}

