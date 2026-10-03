'use client';
import { useRef, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight, MapPin, Building2, CheckCircle2, Wifi } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';
import { FaqSection, LinksSection } from './shared-primitives';

function CityNodes() {
    const ref = useRef(null), anim = useRef(null);
    useEffect(() => {
        const c = ref.current; if (!c) return;
        const ctx = c.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
        const resize = () => { c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr; ctx.scale(dpr, dpr); };
        resize(); window.addEventListener('resize', resize);
        const nodes = Array.from({ length: 18 }, () => ({ x: Math.random() * c.offsetWidth, y: Math.random() * c.offsetHeight, r: 2 + Math.random() * 3, p: Math.random() * Math.PI * 2 }));
        const draw = () => {
            ctx.clearRect(0, 0, c.offsetWidth, c.offsetHeight);
            const t = performance.now() / 1000;
            nodes.forEach((n, i) => {
                const g = 0.4 + 0.3 * Math.sin(t * 2 + n.p);
                nodes.slice(i + 1).forEach(m => { const d = Math.hypot(n.x - m.x, n.y - m.y); if (d < 180) { ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y); ctx.strokeStyle = `rgba(251,191,36,${0.08 * (1 - d / 180)})`; ctx.lineWidth = 0.6; ctx.stroke(); } });
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (0.8 + 0.2 * Math.sin(t + n.p)), 0, Math.PI * 2); ctx.fillStyle = `rgba(251,191,36,${g})`; ctx.fill();
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2); ctx.fillStyle = `rgba(251,191,36,${g * 0.08})`; ctx.fill();
            });
            anim.current = requestAnimationFrame(draw);
        }; draw();
        return () => { cancelAnimationFrame(anim.current); window.removeEventListener('resize', resize); };
    }, []);
    return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />;
}

export default function AgenceGeoMontrealPage({ page, trustBrief }) {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const op = useTransform(scrollYProgress, [0, 1], [1, 0]);
    return (<>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.06),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(245,158,11,0.04),transparent_50%),#080805]" />
        <main>
            <motion.section ref={heroRef} style={{ opacity: op }} className="relative mt-[58px] overflow-hidden px-6 pb-28 pt-[82px] sm:px-10 sm:pt-[112px]">
                <CityNodes />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080805]/70 via-transparent to-[#080805]" />
                <div className="relative z-[1] mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, type: 'spring' }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-5 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-300"><MapPin className="h-3.5 w-3.5" /> {page.eyebrow}</motion.div>
                    <h1 className="max-w-[860px] text-[clamp(40px,7vw,80px)] font-bold leading-[1.02] tracking-[-0.05em] text-amber-50">{page.h1}</h1>
                    <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-7 max-w-[640px] text-[17px] leading-[1.7] text-[#aaa]">{page.summary}</motion.p>
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-6 py-3.5 text-sm font-semibold text-black hover:-translate-y-px hover:bg-amber-300 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] transition">{page.ctaLabel} <ArrowRight className="h-4 w-4" /></ContactButton>
                        {page.secondaryCta && <Link href={page.secondaryCta.href} className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 px-6 py-3.5 text-sm font-medium text-amber-300/70 hover:border-amber-400/40 hover:text-amber-200 transition">{page.secondaryCta.label}</Link>}
                    </motion.div>
                </div>
            </motion.section>
            {trustBrief}

            <section className="border-t border-amber-400/[0.06] bg-[#060605] px-6 py-16 sm:px-10">
                <div className="mx-auto max-w-[960px]">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-amber-400/12 bg-amber-400/[0.02] p-6 sm:p-8">
                        <div className="mb-4 flex items-center gap-3"><Building2 className="h-5 w-5 text-amber-400" /><span className="text-[11px] font-bold uppercase tracking-[0.12em] text-amber-400/70">Positionnement local</span></div>
                        <p className="text-[16px] leading-[1.75] text-white/80">{page.definition}</p>
                        <div className="mt-6 rounded-lg border border-amber-400/8 bg-[#0a0a08] p-5"><p className="text-[15px] leading-[1.7] text-[#aaa]">{page.clientProblem}</p></div>
                    </motion.div>
                </div>
            </section>
            <section className="border-t border-amber-400/[0.06] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px] grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lg:col-span-2 rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden hover:border-amber-400/20 transition">
                        <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4"><div className="flex items-center gap-2"><Wifi className="h-4 w-4 text-red-400" /><h3 className="text-[15px] font-bold">Signaux d&apos;alerte</h3></div></div>
                        <div className="p-6 grid gap-3 sm:grid-cols-2">{page.problems.map((p, i) => <motion.div key={p} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#aaa]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />{p}</motion.div>)}</div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="lg:row-span-2 rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden hover:border-emerald-400/20 transition">
                        <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><h3 className="text-[15px] font-bold">Livrables Montréal</h3></div></div>
                        <div className="p-6"><ul className="space-y-4">{page.deliverables.map((d, i) => <motion.li key={d} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/50" /><span className="text-[13px] leading-[1.65] text-[#aaa]">{d}</span></motion.li>)}</ul></div>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="lg:col-span-2 rounded-2xl border border-white/8 bg-[#0a0a0a] overflow-hidden hover:border-amber-400/20 transition">
                        <div className="border-b border-white/5 bg-white/[0.02] px-6 py-4"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-amber-400" /><h3 className="text-[15px] font-bold">Stratégie locale</h3></div></div>
                        <div className="p-6 grid gap-3 sm:grid-cols-2">{page.corrections.map((c, i) => <motion.div key={c} initial={{ opacity: 0, x: -6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex items-start gap-2.5 text-[13px] leading-[1.65] text-[#aaa]"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />{c}</motion.div>)}</div>
                    </motion.div>
                </div>
            </section>

            <section className="border-t border-amber-400/[0.06] bg-[#060605] px-6 py-20 sm:px-10">
                <div className="mx-auto max-w-[1120px] space-y-14">
                    {[
                        { h: page.montrealForHeading, items: page.montrealForSegments },
                        { h: page.whatGeoAgencyDoesHeading, items: page.whatGeoAgencyDoesBullets },
                        { h: page.localQueryExamplesHeading, items: page.localQueryExamples },
                        { h: page.seoGeoConsultantHeading, items: page.seoGeoConsultantBullets },
                        { h: page.mandateTrouvableHeading, items: page.mandateTrouvableBullets },
                        { h: page.montrealSignalsHeading, items: page.montrealSignalsBullets },
                    ].map((block) => (
                        <motion.div key={block.h} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl border border-amber-400/12 bg-[#0a0a08] p-6 sm:p-8">
                            <h2 className="text-[clamp(20px,2.5vw,26px)] font-bold tracking-[-0.03em] text-amber-50">{block.h}</h2>
                            <ul className="mt-5 space-y-3">
                                {block.items.map((item) => (
                                    <li key={item} className="flex items-start gap-3 text-[14px] leading-[1.65] text-[#b8b8b8]">
                                        <span className="mt-1.5 inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
            </section>

            <section className="border-t border-amber-400/[0.06] bg-[#060605] px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="amber" heading="Questions sur Montréal" /></section>
            <section className="border-t border-amber-400/[0.06] px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="amber" heading="Pages connectées" /></section>

        </main>
    </>);
}

