'use client';

import { motion } from 'framer-motion';

function fmtDate(iso) {
    if (!iso) return 'n.d.';
    try {
        return new Date(iso).toLocaleDateString('fr-CA', { dateStyle: 'medium' });
    } catch {
        return 'n.d.';
    }
}

function PromptPositionSummary({ prompts }) {
    const observed = prompts.filter((prompt) => typeof prompt.target_found === 'boolean');
    const found = observed.filter((prompt) => prompt.target_found).length;
    const notFound = observed.length - found;
    const foundPct = observed.length ? Math.round((found / observed.length) * 100) : null;

    if (foundPct === null) {
        return <p className="mb-5 text-[11px] text-white/35">Taux de détection : Indisponible</p>;
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-5 rounded-xl border border-white/[0.04] bg-white/[0.008] p-4"
        >
            <div className="mb-3 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/20">
                    Taux de détection
                </span>
                <span className="text-[14px] font-black tabular-nums text-emerald-400/85">{foundPct}%</span>
            </div>
            <div className="flex h-[6px] overflow-hidden rounded-full bg-white/[0.03]">
                <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${foundPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                    className="rounded-l-full"
                    style={{ background: 'linear-gradient(90deg, #34d399aa, #34d39955)' }}
                />
                <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${100 - foundPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    className="rounded-r-full"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                />
            </div>
            <div className="mt-2.5 flex justify-between text-[10px] text-white/25">
                <span>
                    <span className="font-semibold text-emerald-400/60">{found}</span> détecté{found > 1 ? 's' : ''}
                </span>
                <span>
                    <span className="font-semibold text-white/35">{notFound}</span> non cité{notFound > 1 ? 's' : ''}
                </span>
            </div>
        </motion.div>
    );
}

export default function PortalSignalsPanel({ prompts = [], sources = [] }) {
    const hasPrompts = prompts.length > 0;
    const hasSources = sources.length > 0;

    if (!hasPrompts && !hasSources) return null;

    const maxCount = Math.max(...sources.map((s) => s.count), 1);
    const totalSourceMentions = sources.reduce((s, src) => s + src.count, 0);

    return (
        <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0d] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.4)] md:p-10"
        >
            <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/18">
                Profondeur du dossier
            </div>
            <h2 className="mb-9 text-[20px] font-bold tracking-[-0.03em] text-white">Signaux et sources</h2>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {hasPrompts && (
                    <div>
                        <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b8fff]/35">
                            Requêtes suivies
                        </div>

                        <PromptPositionSummary prompts={prompts} />

                        <div className="space-y-2">
                            {prompts.map((prompt, i) => (
                                <motion.div
                                    key={prompt.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.04, duration: 0.4, ease: 'easeOut' }}
                                    className="group flex items-start justify-between gap-3 rounded-xl border border-white/[0.03] bg-white/[0.008] px-5 py-4 transition-all duration-300 hover:border-white/[0.07] hover:bg-white/[0.015]"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-[13px] font-semibold text-white/80">
                                            {prompt.query_text}
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/22">
                                            <span className="uppercase tracking-[0.08em]">{prompt.category}</span>
                                            <span className="text-white/8">·</span>
                                            <span>{fmtDate(prompt.last_run_at)}</span>
                                        </div>
                                    </div>
                                    <div
                                        className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                            prompt.target_found
                                                ? 'border border-emerald-400/15 bg-emerald-400/[0.06] text-emerald-300/80'
                                                : 'border border-white/[0.04] bg-white/[0.02] text-white/22'
                                        }`}
                                    >
                                        {prompt.target_found
                                            ? prompt.target_position != null
                                                ? `#${prompt.target_position}`
                                                : 'Cité'
                                            : prompt.target_found === false
                                              ? 'Non cité'
                                              : 'Indisponible'}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {hasSources && (
                    <div>
                        <div className="mb-3 flex items-end justify-between">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7b8fff]/35">
                                Sources citées
                            </div>
                            <div className="text-[11px] tabular-nums text-white/20">
                                {totalSourceMentions} mention{totalSourceMentions > 1 ? 's' : ''}
                            </div>
                        </div>

                        {/* Source distribution mini bar chart */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                            className="mb-5 flex h-[8px] overflow-hidden rounded-full bg-white/[0.02]"
                        >
                            {sources.map((source, i) => {
                                const pct = (source.count / totalSourceMentions) * 100;
                                const colors = ['#5b73ff', '#a78bfa', '#34d399', '#f59e0b', '#ec4899', '#7b8fff'];
                                const c = colors[i % colors.length];
                                return (
                                    <motion.div
                                        key={`bar-${source.host}`}
                                        initial={{ width: 0 }}
                                        whileInView={{ width: `${pct}%` }}
                                        viewport={{ once: true }}
                                        transition={{
                                            delay: 0.2 + i * 0.05,
                                            duration: 0.8,
                                            ease: [0.16, 1, 0.3, 1],
                                        }}
                                        className="h-full"
                                        style={{
                                            background: c,
                                            opacity: 0.55,
                                            marginRight: i < sources.length - 1 ? 1 : 0,
                                        }}
                                    />
                                );
                            })}
                        </motion.div>

                        <div className="space-y-2">
                            {sources.map((source, i) => {
                                const pct = Math.round((source.count / maxCount) * 100);
                                const colors = ['#5b73ff', '#a78bfa', '#34d399', '#f59e0b', '#ec4899', '#7b8fff'];
                                const dotColor = colors[i % colors.length];
                                return (
                                    <motion.div
                                        key={`${source.host}-${source.count}`}
                                        initial={{ opacity: 0, x: -8 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.04, duration: 0.35, ease: 'easeOut' }}
                                        className="group relative overflow-hidden rounded-xl border border-white/[0.03] bg-white/[0.008] px-5 py-4 transition-all duration-300 hover:border-white/[0.07] hover:bg-white/[0.015]"
                                    >
                                        <motion.div
                                            initial={{ width: 0 }}
                                            whileInView={{ width: `${pct}%` }}
                                            viewport={{ once: true }}
                                            transition={{
                                                delay: 0.3 + i * 0.06,
                                                duration: 0.8,
                                                ease: [0.16, 1, 0.3, 1],
                                            }}
                                            className="absolute inset-y-0 left-0"
                                            style={{ background: `${dotColor}08` }}
                                        />
                                        <div className="relative flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <span
                                                    className="h-2 w-2 shrink-0 rounded-full"
                                                    style={{ background: dotColor, opacity: 0.55 }}
                                                />
                                                <span className="text-[13px] font-medium text-white/65">
                                                    {source.host}
                                                </span>
                                            </div>
                                            <span className="text-[12px] font-semibold tabular-nums text-white/30">
                                                {source.count}×
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </motion.section>
    );
}
