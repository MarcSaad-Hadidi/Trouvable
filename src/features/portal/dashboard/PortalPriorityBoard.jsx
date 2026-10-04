'use client';

import { motion } from 'framer-motion';

const ACCENTS = ['#5b73ff', '#a78bfa', '#34d399'];

function EmptyState() {
    return (
        <div className="rounded-2xl border border-dashed border-white/[0.05] bg-white/[0.01] px-8 py-14 text-center">
            <div className="text-[14px] text-white/25">
                Les priorités seront définies lors du prochain cycle d&#39;analyse.
            </div>
        </div>
    );
}

export default function PortalPriorityBoard({ priorities = [] }) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0d] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.4)] md:p-10"
        >
            <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/12 to-transparent" />

            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]/45">
                Plan d&#39;action
            </div>
            <h2 className="mb-9 text-[20px] font-bold tracking-[-0.03em] text-white">Priorités actuelles</h2>

            {priorities.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="space-y-4">
                    {priorities.map((priority, i) => {
                        const accent = ACCENTS[i % ACCENTS.length];
                        return (
                            <motion.div
                                key={`${priority.title}-${i}`}
                                initial={{ opacity: 0, y: 14 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-30px' }}
                                transition={{ delay: 0.06 + i * 0.08, duration: 0.45, ease: 'easeOut' }}
                                className="group relative flex gap-5 rounded-xl border border-white/[0.04] bg-white/[0.01] p-6 transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.018]"
                            >
                                {/* Left accent bar */}
                                <div
                                    className="absolute bottom-4 left-0 top-4 w-[3px] rounded-full transition-opacity duration-300 group-hover:opacity-100"
                                    style={{
                                        background: `linear-gradient(180deg, ${accent}, ${accent}25)`,
                                        opacity: 0.5,
                                    }}
                                />

                                <div className="flex w-10 shrink-0 items-start justify-center pt-0.5">
                                    <span
                                        className="font-mono text-[24px] font-black tracking-[-0.04em]"
                                        style={{ color: accent, opacity: 0.15 }}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="mb-1.5 text-[14px] font-bold tracking-[-0.01em] text-white/90">
                                        {priority.title}
                                    </div>
                                    <p className="text-[13px] leading-[1.65] text-white/35">{priority.description}</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </motion.section>
    );
}
