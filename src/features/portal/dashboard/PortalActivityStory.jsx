'use client';

import { motion } from 'framer-motion';

function fmtDate(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '';
    }
}

function activityMeta(title) {
    const t = (title || '').toLowerCase();
    if (t.includes('audit'))
        return { label: 'Audit', color: '#5b73ff', bg: 'bg-[#5b73ff]/[0.08]', border: 'border-[#5b73ff]/20' };
    if (t.includes('prompt') || t.includes('requete') || t.includes('analyse'))
        return { label: 'Analyse', color: '#a78bfa', bg: 'bg-[#a78bfa]/[0.08]', border: 'border-[#a78bfa]/20' };
    if (t.includes('publi') || t.includes('profil'))
        return { label: 'Publication', color: '#34d399', bg: 'bg-[#34d399]/[0.08]', border: 'border-[#34d399]/20' };
    return { label: 'Action', color: '#7b8fff', bg: 'bg-[#7b8fff]/[0.06]', border: 'border-white/[0.06]' };
}

function EmptyState() {
    return (
        <div className="rounded-2xl border border-dashed border-white/[0.05] bg-white/[0.01] px-8 py-14 text-center">
            <div className="text-[14px] text-white/25">
                Les premières interventions apparaîtront ici dès qu&#39;elles seront enregistrées.
            </div>
        </div>
    );
}

export default function PortalActivityStory({ items = [] }) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0d] p-8 shadow-[0_24px_70px_rgba(0,0,0,0.4)] md:p-10"
        >
            <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[#5b73ff]/12 to-transparent" />

            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]/45">
                Journal de mandat
            </div>
            <h2 className="mb-9 text-[20px] font-bold tracking-[-0.03em] text-white">Travaux réalisés</h2>

            {items.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="relative">
                    <div className="absolute bottom-4 left-[13px] top-4 w-px bg-gradient-to-b from-[#5b73ff]/20 via-white/[0.04] to-transparent" />

                    <div className="space-y-1">
                        {items.map((item, i) => {
                            const meta = activityMeta(item.title);
                            return (
                                <motion.div
                                    key={item.id}
                                    initial={{ opacity: 0, x: -12 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true, margin: '-30px' }}
                                    transition={{ delay: i * 0.06, duration: 0.45, ease: 'easeOut' }}
                                    className="group relative pl-10"
                                >
                                    {/* Dot */}
                                    <div className="absolute left-0 top-[22px] flex h-[27px] w-[27px] items-center justify-center">
                                        <div
                                            className="h-[9px] w-[9px] rounded-full border-2 transition-all duration-300 group-hover:scale-125"
                                            style={{ borderColor: `${meta.color}50`, backgroundColor: `${meta.color}10` }}
                                        />
                                    </div>

                                    <div className="rounded-xl border border-white/[0.035] bg-white/[0.01] px-5 py-4 transition-all duration-300 hover:border-white/[0.08] hover:bg-white/[0.018]">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-2 flex items-center gap-2.5">
                                                    <span
                                                        className={`rounded-md border ${meta.border} ${meta.bg} px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]`}
                                                        style={{ color: meta.color }}
                                                    >
                                                        {meta.label}
                                                    </span>
                                                    <span className="text-[14px] font-semibold text-white/90">
                                                        {item.title}
                                                    </span>
                                                </div>
                                                <p className="text-[13px] leading-[1.65] text-white/35">
                                                    {item.description}
                                                </p>
                                            </div>
                                            <div className="shrink-0 pt-0.5 text-right">
                                                <div className="text-[12px] font-medium tabular-nums text-white/22">
                                                    {fmtDate(item.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.section>
    );
}
