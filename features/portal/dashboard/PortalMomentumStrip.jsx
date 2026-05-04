'use client';

import { motion } from 'framer-motion';
import CoverageMeter from '@/components/shared/metrics/CoverageMeter';
import PremiumSparkline from '@/components/shared/metrics/PremiumSparkline';

export default function PortalMomentumStrip({ visibility, openOpportunitiesCount = 0, sparklines = {} }) {
    const visProxy = visibility?.visibility_proxy_percent;
    const citCoverage = visibility?.citation_coverage_percent;
    const mentionRate = visibility?.tracked_prompt_mention_rate_percent;
    const totalRuns = visibility?.total_query_runs ?? 0;

    const hasAnyMetric = visProxy != null || citCoverage != null || mentionRate != null || totalRuns > 0;
    if (!hasAnyMetric) return null;

    const visSparkline = sparklines?.visibility_proxy_percent || [];
    const citSparkline = sparklines?.citation_coverage_percent || [];

    return (
        <motion.section
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[28px] border border-white/[0.05] bg-[#0a0a0d] shadow-[0_24px_70px_rgba(0,0,0,0.4)]"
        >
            <div className="absolute left-8 right-8 top-0 h-px bg-gradient-to-r from-transparent via-[#a78bfa]/12 to-transparent" />

            <div className="px-8 pb-8 pt-8 md:px-10 md:pb-9 md:pt-9">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7b8fff]/45">
                    Couverture du mandat
                </div>
                <h2 className="mb-8 text-[20px] font-bold tracking-[-0.03em] text-white">
                    Profondeur de signal
                </h2>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {visProxy != null && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1, duration: 0.45, ease: 'easeOut' }}
                            className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5"
                        >
                            <div className="mb-3 flex items-end justify-between">
                                <CoverageMeter
                                    label="Visibilité proxy"
                                    value={visProxy}
                                    color="#5b73ff"
                                    className="flex-1"
                                />
                            </div>
                            {visSparkline.length > 2 && (
                                <div className="mt-3 flex justify-end">
                                    <PremiumSparkline
                                        data={visSparkline}
                                        color="#5b73ff"
                                        width={100}
                                        height={28}
                                        strokeWidth={1.5}
                                    />
                                </div>
                            )}
                        </motion.div>
                    )}

                    {citCoverage != null && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.18, duration: 0.45, ease: 'easeOut' }}
                            className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5"
                        >
                            <div className="mb-3 flex items-end justify-between">
                                <CoverageMeter
                                    label="Couverture citations"
                                    value={citCoverage}
                                    color="#a78bfa"
                                    className="flex-1"
                                />
                            </div>
                            {citSparkline.length > 2 && (
                                <div className="mt-3 flex justify-end">
                                    <PremiumSparkline
                                        data={citSparkline}
                                        color="#a78bfa"
                                        width={100}
                                        height={28}
                                        strokeWidth={1.5}
                                    />
                                </div>
                            )}
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.26, duration: 0.45, ease: 'easeOut' }}
                        className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-5"
                    >
                        {mentionRate != null && (
                            <CoverageMeter
                                label="Taux de mention"
                                value={mentionRate}
                                color="#34d399"
                            />
                        )}
                        <div className="mt-4 flex items-end justify-between gap-6 border-t border-white/[0.03] pt-4">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/20">
                                    Runs exécutés
                                </div>
                                <div className="mt-1 text-[22px] font-black tabular-nums tracking-[-0.03em] text-white/85">
                                    {totalRuns}
                                </div>
                            </div>
                            {openOpportunitiesCount > 0 && (
                                <div className="text-right">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/20">
                                        Opportunités
                                    </div>
                                    <div className="mt-1 text-[22px] font-black tabular-nums tracking-[-0.03em] text-amber-300/80">
                                        {openOpportunitiesCount}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.section>
    );
}
