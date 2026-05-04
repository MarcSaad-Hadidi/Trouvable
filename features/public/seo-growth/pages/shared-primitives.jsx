/* Reusable animation primitives — NOT shared templates.
   Each page imports only what it needs and combines them uniquely. */
'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, HelpCircle, Link2 } from 'lucide-react';
import ContactButton from '@/features/public/shared/ContactButton';

/* ── Shared FAQ accordion (same interaction, but each page styles its wrapper differently) ── */
export function AiThinking() {
    return (
        <div className="flex items-center gap-1.5 h-[24px]">
            <motion.div initial={{ opacity: 0.4, scale: 0.8 }} animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="w-2 h-2 rounded-full bg-white/40" />
            <motion.div initial={{ opacity: 0.4, scale: 0.8 }} animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-2 h-2 rounded-full bg-white/40" />
            <motion.div initial={{ opacity: 0.4, scale: 0.8 }} animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-2 h-2 rounded-full bg-white/40" />
        </div>
    );
}

export function TypewriterText({ text, delay = 0, speed = 10, onComplete }) {
    const [displayedText, setDisplayedText] = useState('');
    const [started, setStarted] = useState(false);

    useEffect(() => {
        setDisplayedText('');
        setStarted(false);
        const startTimer = setTimeout(() => setStarted(true), delay);
        return () => clearTimeout(startTimer);
    }, [text, delay]);

    useEffect(() => {
        if (!started || !text) return;
        let i = 0;
        const interval = setInterval(() => {
            setDisplayedText(text.slice(0, i + 1));
            i++;
            if (i >= text.length) {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }, speed);
        return () => clearInterval(interval);
    }, [text, started, speed, onComplete]);

    return (
        <span>
            {displayedText}
            {started && displayedText.length < (text?.length || 0) && (
                <span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-current animate-pulse" />
            )}
        </span>
    );
}

export function FaqSection({ faqs, accent = 'amber', heading = 'Questions fréquentes', icon: Icon = HelpCircle }) {
    const colors = {
        amber: { text: 'text-amber-400', border: 'border-amber-400/8', hoverBorder: 'hover:border-amber-400/20', bg: 'bg-[#0b0b0a]', divider: 'border-amber-400/5', arrow: 'text-amber-400/25 group-hover:text-amber-400 group-open:rotate-90' },
        cyan: { text: 'text-cyan-400', border: 'border-cyan-400/8', hoverBorder: 'hover:border-cyan-400/20', bg: 'bg-[#0b0b0b]', divider: 'border-cyan-400/5', arrow: 'text-cyan-400/25 group-hover:text-cyan-400 group-open:rotate-90' },
        violet: { text: 'text-violet-400', border: 'border-violet-400/8', hoverBorder: 'hover:border-violet-400/20', bg: 'bg-[#0b0b0e]', divider: 'border-violet-400/5', arrow: 'text-violet-400/25 group-hover:text-violet-400 group-open:rotate-90' },
        emerald: { text: 'text-emerald-400', border: 'border-emerald-400/8', hoverBorder: 'hover:border-emerald-400/20', bg: 'bg-[#0b0b0b]', divider: 'border-emerald-400/5', arrow: 'text-emerald-400/25 group-hover:text-emerald-400 group-open:rotate-90' },
        indigo: { text: 'text-indigo-400', border: 'border-indigo-400/8', hoverBorder: 'hover:border-indigo-400/20', bg: 'bg-[#0b0b10]', divider: 'border-indigo-400/5', arrow: 'text-indigo-400/25 group-hover:text-indigo-400 group-open:rotate-90' },
        rose: { text: 'text-rose-400', border: 'border-rose-400/8', hoverBorder: 'hover:border-rose-400/20', bg: 'bg-[#0b0a0b]', divider: 'border-rose-400/5', arrow: 'text-rose-400/25 group-hover:text-rose-400 group-open:rotate-90' },
        sky: { text: 'text-sky-400', border: 'border-sky-400/8', hoverBorder: 'hover:border-sky-400/20', bg: 'bg-[#0a0b0c]', divider: 'border-sky-400/5', arrow: 'text-sky-400/25 group-hover:text-sky-400 group-open:rotate-90' },
        teal: { text: 'text-teal-400', border: 'border-teal-400/8', hoverBorder: 'hover:border-teal-400/20', bg: 'bg-[#0a0b0b]', divider: 'border-teal-400/5', arrow: 'text-teal-400/25 group-hover:text-teal-400 group-open:rotate-90' },
        fuchsia: { text: 'text-fuchsia-400', border: 'border-fuchsia-400/8', hoverBorder: 'hover:border-fuchsia-400/20', bg: 'bg-[#0b0a0c]', divider: 'border-fuchsia-400/5', arrow: 'text-fuchsia-400/25 group-hover:text-fuchsia-400 group-open:rotate-90' },
        orange: { text: 'text-orange-400', border: 'border-orange-400/8', hoverBorder: 'hover:border-orange-400/20', bg: 'bg-[#0b0a08]', divider: 'border-orange-400/5', arrow: 'text-orange-400/25 group-hover:text-orange-400 group-open:rotate-90' },
        lime: { text: 'text-lime-400', border: 'border-lime-400/8', hoverBorder: 'hover:border-lime-400/20', bg: 'bg-[#0a0b08]', divider: 'border-lime-400/5', arrow: 'text-lime-400/25 group-hover:text-lime-400 group-open:rotate-90' },
        blue: { text: 'text-blue-400', border: 'border-blue-400/8', hoverBorder: 'hover:border-blue-400/20', bg: 'bg-[#0a0a0c]', divider: 'border-blue-400/5', arrow: 'text-blue-400/25 group-hover:text-blue-400 group-open:rotate-90' },
        purple: { text: 'text-purple-400', border: 'border-purple-400/8', hoverBorder: 'hover:border-purple-400/20', bg: 'bg-[#0b0a0e]', divider: 'border-purple-400/5', arrow: 'text-purple-400/25 group-hover:text-purple-400 group-open:rotate-90' },
        pink: { text: 'text-pink-400', border: 'border-pink-400/8', hoverBorder: 'hover:border-pink-400/20', bg: 'bg-[#0b0a0b]', divider: 'border-pink-400/5', arrow: 'text-pink-400/25 group-hover:text-pink-400 group-open:rotate-90' },
        slate: { text: 'text-slate-400', border: 'border-slate-400/8', hoverBorder: 'hover:border-slate-400/20', bg: 'bg-[#0b0b0c]', divider: 'border-slate-400/5', arrow: 'text-slate-400/25 group-hover:text-slate-400 group-open:rotate-90' },
    };
    const c = colors[accent] || colors.amber;
    return (
        <div className="mx-auto max-w-[980px]">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 flex items-center gap-3"><Icon className={`h-5 w-5 ${c.text}`} /><h2 className="text-xl font-bold">{heading}</h2></motion.div>
            <div className="space-y-3">{faqs.map((f, i) => <motion.div key={f.question} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}><details className={`group rounded-xl border ${c.border} ${c.bg} ${c.hoverBorder} transition [&_summary::-webkit-details-marker]:hidden`}><summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-[15px] font-semibold text-white">{f.question}<ArrowRight className={`h-4 w-4 shrink-0 transition ${c.arrow}`} /></summary><p className={`border-t ${c.divider} px-5 py-4 text-[14px] leading-[1.75] text-[#aaa]`}>{f.answer}</p></details></motion.div>)}</div>
        </div>
    );
}

/* ── Shared link grid ── */
export function LinksSection({ links, accent = 'amber', heading = 'Pages connexes' }) {
    const accentMap = { amber: 'text-amber-400', cyan: 'text-cyan-400', violet: 'text-violet-400', emerald: 'text-emerald-400', indigo: 'text-indigo-400', rose: 'text-rose-400', sky: 'text-sky-400', teal: 'text-teal-400', fuchsia: 'text-fuchsia-400', orange: 'text-orange-400', lime: 'text-lime-400', blue: 'text-blue-400', purple: 'text-purple-400', pink: 'text-pink-400', slate: 'text-slate-400' };
    const hoverMap = { amber: 'hover:border-amber-400/25', cyan: 'hover:border-cyan-400/25', violet: 'hover:border-violet-400/25', emerald: 'hover:border-emerald-400/25', indigo: 'hover:border-indigo-400/25', rose: 'hover:border-rose-400/25', sky: 'hover:border-sky-400/25', teal: 'hover:border-teal-400/25', fuchsia: 'hover:border-fuchsia-400/25', orange: 'hover:border-orange-400/25', lime: 'hover:border-lime-400/25', blue: 'hover:border-blue-400/25', purple: 'hover:border-purple-400/25', pink: 'hover:border-pink-400/25', slate: 'hover:border-slate-400/25' };
    const c = accentMap[accent] || accentMap.amber;
    const h = hoverMap[accent] || hoverMap.amber;
    return (
        <div className="mx-auto max-w-[1120px]">
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-8 flex items-center gap-3"><Link2 className={`h-5 w-5 ${c}`} /><h2 className="text-xl font-bold">{heading}</h2></motion.div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{links.map((l, i) => <motion.div key={l.href} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}><Link href={l.href} className={`group flex min-h-[140px] flex-col rounded-2xl border border-white/8 bg-[#0a0a0a] p-5 hover:-translate-y-1 ${h} transition`}><div className="mb-3 flex items-center justify-between gap-4"><h3 className="text-[15px] font-semibold text-white">{l.label}</h3><ArrowRight className={`h-4 w-4 shrink-0 opacity-20 group-hover:translate-x-1 ${c} group-hover:opacity-100 transition`} /></div><p className="text-[13px] leading-[1.65] text-[#9a9a9a]">{l.description}</p></Link></motion.div>)}</div>
        </div>
    );
}

/* ── Scrollbar styles & Shared CTA section ── */
export function ScrollbarStyles() {
    return (
        <style dangerouslySetInnerHTML={{__html: `
            .clean-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
            .clean-scroll::-webkit-scrollbar-track { background: transparent; }
            .clean-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
            .clean-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.25); }
            .clean-scroll-light::-webkit-scrollbar { width: 6px; height: 6px; }
            .clean-scroll-light::-webkit-scrollbar-track { background: transparent; }
            .clean-scroll-light::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.15); border-radius: 10px; }
            .clean-scroll-light::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.25); }
        `}} />
    );
}

const ScrambleText = ({ text }) => {
    const [displayText, setDisplayText] = useState('');
    
    useEffect(() => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*()_+1234567890';
        let iteration = 0;
        let interval = null;
        
        setDisplayText(text.replace(/./g, (char) => char === ' ' ? ' ' : letters[Math.floor(Math.random() * letters.length)]));
        
        const timeout = setTimeout(() => {
            interval = setInterval(() => {
                setDisplayText(text.split('').map((letter, index) => {
                    if (index < iteration) {
                        return text[index];
                    }
                    if (letter === ' ') return ' ';
                    return letters[Math.floor(Math.random() * letters.length)];
                }).join(''));
                
                if (iteration >= text.length) {
                    clearInterval(interval);
                }
                
                iteration += 1 / 3;
            }, 30);
        }, 400);
        
        return () => {
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [text]);

    return <span className="inline-block">{displayText || ' '}</span>;
};

export function CtaSection({ page, accent = 'amber', headline, icon: Icon }) {
    const hexMap = { amber: '#f59e0b', cyan: '#06b6d4', violet: '#8b5cf6', emerald: '#10b981', indigo: '#6366f1', rose: '#f43f5e', sky: '#0ea5e9', teal: '#14b8a6', fuchsia: '#d946ef', orange: '#f97316', lime: '#84cc16', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899', slate: '#64748b' };
    const btnMap = { amber: 'bg-amber-400 text-black shadow-[0_0_40px_rgba(251,191,36,0.3)]', cyan: 'bg-cyan-400 text-black shadow-[0_0_40px_rgba(34,211,238,0.3)]', violet: 'bg-violet-500 text-white shadow-[0_0_40px_rgba(139,92,246,0.3)]', emerald: 'bg-emerald-500 text-black shadow-[0_0_40px_rgba(52,211,153,0.3)]', indigo: 'bg-indigo-500 text-white shadow-[0_0_40px_rgba(99,102,241,0.3)]', rose: 'bg-rose-500 text-white shadow-[0_0_40px_rgba(244,63,94,0.3)]', sky: 'bg-sky-500 text-white shadow-[0_0_40px_rgba(14,165,233,0.3)]', teal: 'bg-teal-500 text-black shadow-[0_0_40px_rgba(20,184,166,0.3)]', fuchsia: 'bg-fuchsia-500 text-white shadow-[0_0_40px_rgba(217,70,239,0.3)]', orange: 'bg-orange-500 text-black shadow-[0_0_40px_rgba(249,115,22,0.3)]', lime: 'bg-lime-500 text-black shadow-[0_0_40px_rgba(132,204,22,0.3)]', blue: 'bg-blue-500 text-white shadow-[0_0_40px_rgba(59,130,246,0.3)]', purple: 'bg-purple-500 text-white shadow-[0_0_40px_rgba(168,85,247,0.3)]', pink: 'bg-pink-500 text-white shadow-[0_0_40px_rgba(236,72,153,0.3)]', slate: 'bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.3)]' };
    
    const hex = hexMap[accent] || hexMap.amber;
    const b = btnMap[accent] || btnMap.amber;

    return (
        <div className="relative z-10 mx-auto w-full max-w-[100vw] overflow-hidden text-center pt-32 pb-40">
            <ScrollbarStyles />
            
            {/* --- LASER GRID & RADAR SCENE --- */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center -z-10 bg-[#000000] overflow-hidden">
                
                {/* 3D Perspective Grid */}
                <div className="absolute inset-[-100%] origin-bottom" style={{ transform: 'perspective(1000px) rotateX(75deg) translateY(300px) translateZ(-200px)' }}>
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
                </div>
                
                {/* Massive Radar Conic Sweep */}
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250vw] h-[250vw] sm:w-[150vw] sm:h-[150vw] rounded-full mix-blend-screen opacity-50"
                    style={{ background: `conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,0.05) 60deg, ${hex} 90deg, transparent 90deg)` }}
                />

                {/* Core Light Source (Pulse) */}
                <motion.div 
                    animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[60vw] h-[400px] rounded-full blur-[120px] mix-blend-screen"
                    style={{ backgroundColor: hex }}
                />
                
                {/* Horizontal Laser Line */}
                <div className="absolute top-[150px] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <motion.div 
                    animate={{ x: ['-50vw', '150vw'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[149px] left-0 w-[300px] h-[3px] bg-white blur-[2px]" 
                />
            </div>
            
            <div className="relative z-10 flex flex-col items-center px-4">
               
               {/* --- MECHANICAL 3D ICON --- */}
               {Icon && (
                   <motion.div
                       initial={{ opacity: 0, y: -100, scale: 0.2, rotateZ: -45 }}
                       whileInView={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
                       viewport={{ once: true, amount: 0.2 }}
                       transition={{ type: "spring", bounce: 0.7, duration: 2 }}
                       className="mb-16"
                   >
                       <div className="relative flex h-[120px] w-[120px] items-center justify-center rounded-2xl bg-black border border-white/20 shadow-[0_0_80px_rgba(255,255,255,0.1)] overflow-hidden group">
                           {/* Scanning line inside icon */}
                           <motion.div 
                               animate={{ top: ['-10%', '110%'] }} 
                               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                               className="absolute left-0 w-full h-[2px] bg-white/50 blur-[1px] z-20" 
                           />
                           <Icon className="h-14 w-14 text-white relative z-10" />
                           <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50" />
                           
                           {/* Glowing corners (Tech aesthetic) */}
                           <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/50" />
                           <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/50" />
                           <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/50" />
                           <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/50" />
                       </div>
                   </motion.div>
               )}

               {/* --- SCRAMBLE HEADLINE --- */}
               <motion.div 
                   initial={{ opacity: 0, scale: 0.95 }}
                   whileInView={{ opacity: 1, scale: 1 }}
                   viewport={{ once: true, amount: 0.2 }}
                   transition={{ duration: 0.5 }}
                   className="relative"
               >
                   <h2 className="text-[clamp(40px,7vw,90px)] font-black leading-[1.05] tracking-[-0.03em] max-w-[1200px] mx-auto text-white drop-shadow-2xl">
                       <ScrambleText text={headline || 'Commencer par un mandat cadré.'} />
                   </h2>
               </motion.div>

               {/* --- CRISP SUBTITLE --- */}
               <motion.p 
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: 1, duration: 1 }}
                   className="mx-auto mt-12 max-w-[700px] text-[clamp(17px,2vw,22px)] leading-[1.6] text-[#a1a1aa] font-medium"
               >
                   {page.proofNote}
               </motion.p>
               
               {/* --- GEOMETRIC BUTTONS --- */}
               <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: 1.2, duration: 1 }}
                   className="mt-16 flex flex-col items-center justify-center gap-6 sm:flex-row w-full sm:w-auto relative z-20"
               >
                   <ContactButton className={`group relative flex w-full sm:w-auto items-center justify-center gap-3 rounded-lg px-12 py-5 text-[17px] font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${b}`}>
                       <span className="relative z-10 flex items-center gap-3 uppercase tracking-wider text-[14px]">
                           {page.ctaLabel} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                       </span>
                       <div className="absolute inset-0 z-0 bg-white/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 mix-blend-overlay" />
                   </ContactButton>
                   
                   <Link href="/contact" className={`group relative flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-10 py-5 text-[14px] uppercase tracking-wider font-bold text-white transition-all duration-300 hover:bg-white/5 active:scale-[0.98]`}>
                       Contacter Trouvable
                   </Link>
               </motion.div>
            </div>
        </div>
    );
}
