'use client';
import { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, Globe, MessageSquare, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

function FloatingBubbles() {
    const ref = useRef(null), anim = useRef(null);
    useEffect(() => {
        const c = ref.current; if (!c) return;
        const ctx = c.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
        const resize = () => { c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr; ctx.scale(dpr, dpr); };
        resize(); window.addEventListener('resize', resize);
        const bubbles = Array.from({ length: 12 }, () => ({ x: Math.random() * c.offsetWidth, y: c.offsetHeight + Math.random() * 200, w: 60 + Math.random() * 100, h: 24 + Math.random() * 16, speed: 0.3 + Math.random() * 0.4, alpha: 0.04 + Math.random() * 0.06 }));
        const draw = () => {
            ctx.clearRect(0, 0, c.offsetWidth, c.offsetHeight);
            bubbles.forEach(b => {
                b.y -= b.speed;
                if (b.y < -50) { b.y = c.offsetHeight + 50; b.x = Math.random() * c.offsetWidth; }
                ctx.beginPath();
                ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 8);
                ctx.fillStyle = `rgba(14,165,233,${b.alpha})`;
                ctx.fill();
                ctx.strokeStyle = `rgba(14,165,233,${b.alpha * 2})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
            });
            anim.current = requestAnimationFrame(draw);
        }; draw();
        return () => { cancelAnimationFrame(anim.current); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}

export default function VisibiliteGoogleReponsesIaPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(14,165,233,0.07),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(56,189,248,0.04),transparent_50%),#080810]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-24 pt-[82px] sm:px-10 sm:pt-[112px]">
                <FloatingBubbles />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080810]/60 via-transparent to-[#080810]" />
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-sky-300"><Globe className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="max-w-[860px] text-[clamp(36px,6vw,72px)] font-bold leading-[1.04] tracking-[-0.045em]"><span className="bg-gradient-to-b from-white via-sky-100 to-sky-300/40 bg-clip-text text-transparent">{page.h1}</span></motion.h1>
                    <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-7 max-w-[680px] text-[17px] leading-[1.7] text-[#a8a8a8]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-3.5 text-sm font-semibold text-white hover:-translate-y-px hover:bg-sky-400 hover:shadow-[0_0_30px_rgba(14,165,233,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 px-6 py-3.5 text-sm font-medium text-sky-300/70 hover:border-sky-400/40 hover:text-sky-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            {/* Definition */}
            <section className="border-t border-sky-400/[0.06] bg-[#060610] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-sky-400/12 bg-sky-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><MessageSquare className="h-5 w-5 text-sky-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-400/70">Le défi Google + IA</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-sky-400/8 bg-[#0a0a10] p-5"><p className="text-[15px] leading-[1.7] text-[#a8a8a8]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            {/* Timeline content */}
            <section className="border-t border-sky-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <div className="relative">
                        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-sky-400/30 via-sky-400/10 to-transparent hidden sm:block" />
                        {[{ title: 'Problèmes identifiés', items: page.problems, color: 'text-red-400', dot: 'bg-red-400', icon: AlertTriangle },
                          { title: 'Corrections appliquées', items: page.corrections, color: 'text-sky-400', dot: 'bg-sky-400', icon: Wrench },
                          { title: 'Livrables fournis', items: page.deliverables, color: 'text-emerald-400', dot: 'bg-emerald-400', icon: CheckCircle2 }
                        ].map((section, si) => (
                            <motion.div key={section.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.1 }} className="mb-12 last:mb-0">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`relative z-10 grid h-9 w-9 place-items-center rounded-full border border-sky-400/20 bg-sky-400/[0.06]`}><section.icon className={`h-4 w-4 ${section.color}`} /></div>
                                    <h3 className="text-[18px] font-bold">{section.title}</h3>
                                    <div className="h-px flex-1 bg-gradient-to-r from-sky-400/15 to-transparent" />
                                </div>
                                <div className="ml-[52px] space-y-3">
                                    {section.items.map((item, i) => (
                                        <motion.div key={item} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: si * 0.1 + i * 0.05 }} className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.015] p-4 hover:border-sky-400/15 transition">
                                            <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${section.dot}`} />
                                            <span className="text-[13px] leading-[1.65] text-[#a8a8a8]">{item}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>
            <section className="border-t border-sky-400/[0.06] bg-[#060610] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="sky" heading="Questions sur la visibilité" /></section>
            <section className="border-t border-sky-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="sky" heading="Ressources stratégiques" /></section>

        </main>
    </>);
}

