import Link from 'next/link';
import { ArrowUpRight, Dot } from 'lucide-react';

import { COMMAND_SURFACE_SOFT, cn, getToneMeta } from './tokens';

export default function CommandTimeline({
    title,
    description = null,
    items = [],
    emptyTitle,
    emptyDescription,
}) {
    return (
        <section className={cn(COMMAND_SURFACE_SOFT, 'p-5 sm:p-6')}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/[0.38]">Récence</div>
                    <div className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-white">{title}</div>
                    {description ? <p className="mt-2 text-[13px] leading-relaxed text-white/[0.62]">{description}</p> : null}
                </div>
            </div>

            {!items.length ? (
                <div className="mt-6 rounded-[22px] border border-dashed border-white/[0.10] bg-white/[0.02] p-6 text-center">
                    <div className="text-[15px] font-semibold text-white/[0.86]">{emptyTitle}</div>
                    <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-white/[0.56]">{emptyDescription}</p>
                </div>
            ) : (
                <div className="mt-6 space-y-4">
                    {items.map((item, index) => {
                        const toneMeta = getToneMeta(item.tone === 'info' ? 'info' : 'neutral');
                        return (
                            <div key={item.id} className="grid gap-3 md:grid-cols-[24px_minmax(0,1fr)]">
                                <div className="relative flex justify-center">
                                    <span className={cn('relative z-10 mt-1.5 h-3 w-3 rounded-full border border-black/30', toneMeta.dot)} />
                                    {index < items.length - 1 ? <span className="absolute top-4 h-full w-px bg-gradient-to-b from-white/25 to-transparent" /> : null}
                                </div>
                                <div className="rounded-[20px] border border-white/[0.08] bg-white/[0.03] p-4">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="text-[15px] font-semibold tracking-[-0.02em] text-white">{item.title}</div>
                                            <div className="mt-1 text-[13px] leading-relaxed text-white/[0.68]">{item.description}</div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/[0.54]">
                                            <span className="inline-flex items-center gap-1">
                                                <Dot className="h-4 w-4" />
                                                {item.provenanceLabel}
                                            </span>
                                            <span>{item.relativeTime || item.timestamp}</span>
                                        </div>
                                    </div>
                                    {item.href ? (
                                        <div className="mt-4">
                                            <Link href={item.href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/[0.78] transition-colors hover:text-white">
                                                Ouvrir
                                                <ArrowUpRight className="h-4 w-4" />
                                            </Link>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
