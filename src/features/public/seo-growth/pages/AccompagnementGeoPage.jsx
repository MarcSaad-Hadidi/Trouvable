'use client';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Handshake, Route, CheckCircle2, AlertTriangle, Milestone } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

export default function AccompagnementGeoPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(251,113,133,0.03),transparent_50%),#0a0808]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                {/* Journey path SVG */}
                <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"><motion.path d="M 0 200 Q 200 100 400 250 T 800 180 T 1200 300 T 1600 200 T 2000 280" fill="none" stroke="rgb(244,63,94)" strokeWidth="2" strokeDasharray="8 8" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 4, ease: 'easeInOut' }} /></svg>
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-300"><Handshake className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em]"><span className="bg-gradient-to-r from-rose-200 via-white to-rose-200/60 bg-clip-text text-transparent">{page.h1}</span></motion.h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-6 py-3.5 text-sm font-semibold text-white hover:-translate-y-px hover:bg-rose-400 hover:shadow-[0_0_30px_rgba(244,63,94,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/20 px-6 py-3.5 text-sm font-medium text-rose-300/70 hover:border-rose-400/40 hover:text-rose-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-rose-400/[0.06] bg-[#0a0608] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-rose-400/12 bg-rose-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><Route className="h-5 w-5 text-rose-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-rose-400/70">L&apos;accompagnement Trouvable</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-rose-400/8 bg-[#0a0808] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            {/* Journey milestones */}
            <section className="border-t border-rose-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <div className="relative">
                        <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-rose-400/30 via-rose-400/10 to-transparent hidden sm:block" />
                        {[{ t: 'Diagnostic initial', items: page.problems, icon: AlertTriangle, c: 'text-red-400', dc: 'bg-red-400' },
                          { t: 'Plan de route', items: page.corrections, icon: Milestone, c: 'text-rose-400', dc: 'bg-rose-400' },
                          { t: 'Livrables jalonnés', items: page.deliverables, icon: CheckCircle2, c: 'text-emerald-400', dc: 'bg-emerald-400' }
                        ].map((s, si) => (
                            <motion.div key={s.t} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.12 }} className="mb-12 last:mb-0">
                                <div className="flex items-center gap-4 mb-5"><div className="relative z-10 grid h-12 w-12 place-items-center rounded-full border border-rose-400/20 bg-rose-400/[0.06]"><span className="font-mono text-[13px] font-bold text-rose-400">{String(si + 1).padStart(2, '0')}</span></div><h3 className="text-[18px] font-bold">{s.t}</h3></div>
                                <div className="ml-[64px] space-y-3">{s.items.map((item, i) => <motion.div key={item} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: si * 0.1 + i * 0.05 }} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.015] p-4 hover:border-rose-400/15 transition"><div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${s.dc}`} /><span className="text-[13px] leading-[1.65] text-[#a8a8a8]">{item}</span></motion.div>)}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="border-t border-rose-400/[0.06] bg-[#0a0608] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="rose" heading="Questions sur l'accompagnement" /></section>
            <section className="border-t border-rose-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="rose" heading="Services complémentaires" /></section>

        </main>
    </>);
}

