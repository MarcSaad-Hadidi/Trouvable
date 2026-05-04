'use client';

import Link from 'next/link';
import { ArrowRight, Clock3, Sparkles, TriangleAlert } from 'lucide-react';
import { motion } from 'framer-motion';

import CommandMetricCard from './CommandMetricCard';
import CommandScoreRing from './charts/CommandScoreRing';
import { commandFadeUp } from './motion';
import { COMMAND_BUTTONS, COMMAND_SURFACE, COMMAND_TEXT, cn, getToneMeta } from './tokens';

function StatusPill({ tone, label }) {
    const toneMeta = getToneMeta(tone);
    return (
        <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]', toneMeta.pill)}>
            <span className={cn('h-2 w-2 rounded-full', toneMeta.dot)} />
            {label}
        </span>
    );
}

export default function CommandHero({
    eyebrow = null,
    title,
    subtitle = null,
    websiteLabel = null,
    status,
    score,
    freshness,
    priorityAction,
    supportingMetrics = [],
    secondaryActions = null,
}) {
    const statusTone = getToneMeta(status?.tone);
    const actionTone = getToneMeta(priorityAction?.tone);
    const scoreCaption = score?.captionFinal || score?.caption;

    return (
        <motion.section variants={commandFadeUp} className={cn(COMMAND_SURFACE, 'relative overflow-hidden p-5 sm:p-6 lg:p-8')}>
            <div className="absolute inset-y-0 right-0 w-[38%] bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_58%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-40" />

            <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                <div className="space-y-5">
                    {eyebrow ? <div className={COMMAND_TEXT.eyebrow}>{eyebrow}</div> : null}

                    <div>
                        <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-semibold tracking-[-0.05em] text-white">{title}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-white/[0.45]">
                            {subtitle ? <span>{subtitle}</span> : null}
                            {websiteLabel ? (
                                <>
                                    <span className="text-white/[0.12]">â€¢</span>
                                    <span className="truncate">{websiteLabel}</span>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={status?.tone} label={status?.label} />
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.65]">
                            <Clock3 className="h-3.5 w-3.5" />
                            {freshness?.label}
                        </span>
                    </div>

                    <p className="max-w-3xl text-[14px] leading-relaxed text-white/[0.62] sm:text-[15px]">{status?.summary}</p>

                    <div className={cn('rounded-[24px] border p-4 sm:p-5', actionTone.panel)}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div className="max-w-2xl">
                                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/[0.42]">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Action prioritaire
                                </div>
                                <div className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-white">{priorityAction?.title}</div>
                                <div className="mt-2 text-[13px] leading-relaxed text-white/[0.72]">{priorityAction?.impact}</div>
                                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[11px] text-white/[0.78]">
                                    <TriangleAlert className="h-3.5 w-3.5" />
                                    {priorityAction?.proof}
                                </div>
                            </div>

                            {priorityAction?.href ? (
                                <Link href={priorityAction.href} className={COMMAND_BUTTONS.primary}>
                                    Ouvrir la piste
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            ) : null}
                        </div>
                    </div>

                    {secondaryActions ? <div className="flex flex-wrap items-center gap-2">{secondaryActions}</div> : null}
                </div>

                <div className="grid gap-4">
                    <div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_100%)] p-5">
                        <div className="grid items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                            <CommandScoreRing
                                value={score?.value}
                                label={score?.label}
                                caption={scoreCaption}
                                tone={score?.tone || (status?.tone === 'critical' ? 'critical' : 'info')}
                            />
                            <div className="space-y-3">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/[0.38]">Lecture stratÃ©gique</div>
                                    <div className={cn('mt-3 text-[24px] font-semibold tracking-[-0.04em]', statusTone.text)}>{status?.label}</div>
                                    <div className="mt-2 text-[13px] leading-relaxed text-white/[0.68]">{scoreCaption}</div>
                                </div>
                                <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/[0.38]">FraÃ®cheur</div>
                                    <div className="mt-2 text-[15px] font-semibold text-white/[0.88]">{freshness?.detail}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        {supportingMetrics.map((item) => (
                            <CommandMetricCard
                                key={item.id}
                                label={item.label}
                                value={item.value}
                                tone={item.tone}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </motion.section>
    );
}
