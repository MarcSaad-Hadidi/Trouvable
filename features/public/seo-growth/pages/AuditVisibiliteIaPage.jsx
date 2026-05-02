'use client';
import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Crosshair, ScanLine, Shield, Radio, CheckCircle2 } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

function RadarScanner() {
    return (
        <div className="pointer-events-none absolute right-[-80px] top-[-40px] h-[420px] w-[420px] opacity-[0.15] lg:opacity-[0.2]">
            <div className="absolute inset-0 rounded-full border border-cyan-400/20" />
            <div className="absolute inset-[30px] rounded-full border border-cyan-400/15" />
            <div className="absolute inset-[60px] rounded-full border border-cyan-400/10" />
            <motion.div className="absolute left-1/2 top-1/2 h-[210px] w-px origin-bottom -translate-x-1/2 -translate-y-full" style={{ background: 'linear-gradient(to top, transparent, rgba(34,211,238,0.6))' }} animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} />
            <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]" />
            {[{ x: '30%', y: '25%', d: 0.5 },{ x: '65%', y: '35%', d: 1.2 },{ x: '45%', y: '70%', d: 2.0 },{ x: '75%', y: '60%', d: 3.1 }].map((b, i) => (
                <motion.div key={i} className="absolute h-1.5 w-1.5 rounded-full bg-cyan-300" style={{ left: b.x, top: b.y }} animate={{ opacity: [0,1,1,0], scale: [0,1,1,0] }} transition={{ duration: 4, repeat: Infinity, delay: b.d }} />
            ))}
        </div>
    );
}

function TypewriterTitle({ text }) {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);
    useEffect(() => { let i = 0; const id = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) { clearInterval(id); setDone(true); } }, 30); return () => clearInterval(id); }, [text]);
    return <span>{displayed}{!done && <span className="animate-pulse text-cyan-400">|</span>}</span>;
}

function HudCard({ children, delay = 0 }) {
    return (
        <motion.div initial={{ opacity: 0, y: 20, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay }} className="group relative overflow-hidden rounded-xl border border-cyan-400/10 bg-[#0a0a0a] transition-all hover:border-cyan-400/25">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute top-0 left-0 h-4 w-px bg-cyan-400/30" /><div className="absolute top-0 left-0 h-px w-4 bg-cyan-400/30" />
            <div className="absolute top-0 right-0 h-4 w-px bg-cyan-400/30" /><div className="absolute top-0 right-0 h-px w-4 bg-cyan-400/30" />
            {children}
        </motion.div>
    );
}

export default function AuditVisibiliteIaPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.06),transparent_55%),#080808]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(34,211,238,0.08)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,black_20%,transparent_100%)]" />
            <motion.div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" animate={{ top: ['0%', '100%'] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} />
        </div>
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-20 pt-[82px] sm:px-10 sm:pt-[112px]">
                <RadarScanner />
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300"><Crosshair className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <h1 className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em] text-white"><TypewriterTitle text={page.h1} /></h1>
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-black hover:-translate-y-px hover:bg-cyan-300 hover:shadow-[0_0_30px_rgba(34,211,238,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 px-6 py-3.5 text-sm font-medium text-cyan-300/70 hover:border-cyan-400/40 hover:text-cyan-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-cyan-400/[0.08] bg-[#060608] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]"><HudCard><div className="p-6 sm:p-8">
                    <div className="mb-4 flex items-center gap-3"><ScanLine className="h-5 w-5 text-cyan-400" /><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-400/70">Briefing</div></div>
                    <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                    <div className="mt-6 rounded-lg border border-cyan-400/10 bg-cyan-400/[0.03] p-5"><div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-400/50">Signal intercepté</div><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                </div></HudCard></div>
            </section>
            <section className="border-t border-cyan-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-3">
                    {[{ title: 'Menaces détectées', items: page.problems, icon: Radio, dot: 'bg-red-400', border: 'border-red-400/15', bg: 'bg-red-400/5', color: 'text-red-400' },
                      { title: 'Contre-mesures', items: page.corrections, icon: Shield, dot: 'bg-cyan-400', border: 'border-cyan-400/15', bg: 'bg-cyan-400/5', color: 'text-cyan-400' },
                      { title: 'Livrables opérationnels', items: page.deliverables, icon: CheckCircle2, dot: 'bg-emerald-400', border: 'border-emerald-400/15', bg: 'bg-emerald-400/5', color: 'text-emerald-400' }
                    ].map((panel, pi) => (
                        <HudCard key={panel.title} delay={pi * 0.1}><div className="p-6">
                            <div className="mb-5 flex items-center gap-3"><div className={`grid h-10 w-10 place-items-center rounded-lg border ${panel.border} ${panel.bg}`}><panel.icon className={`h-5 w-5 ${panel.color}`} /></div><h3 className="text-[15px] font-bold">{panel.title}</h3></div>
                            <ul className="space-y-3">{panel.items.map((item, i) => <motion.li key={item} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: pi * 0.1 + i * 0.06 }} className="flex gap-3 text-[13px] leading-[1.65] text-[#a8a8a8]"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${panel.dot}`} /><span>{item}</span></motion.li>)}</ul>
                        </div></HudCard>
                    ))}
                </div>
            </section>
            <section className="border-t border-cyan-400/[0.06] bg-[#060608] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="cyan" heading="Interrogations fréquentes" /></section>
            <section className="border-t border-cyan-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="cyan" heading="Cibles adjacentes" /></section>

        </main>
    </>);
}

