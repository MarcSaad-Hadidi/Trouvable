import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { COMMAND_MUTED_PANEL, cn, getToneLabel, getToneMeta } from '../tokens';

export default function CommandHealthMap({ items = [] }) {
    return (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {items.map((item) => {
                const tone = getToneMeta(item.status);
                const content = (
                    <div className={cn(COMMAND_MUTED_PANEL, tone.panel, 'group relative flex h-full min-h-[168px] flex-col overflow-hidden p-4')}>
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-35" />
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.38]">{item.label}</div>
                                <div className={cn('mt-3 text-[26px] font-semibold tracking-[-0.04em]', tone.text)}>{item.metric || 'n.d.'}</div>
                            </div>
                            <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', tone.pill)}>
                                {item.statusLabel || getToneLabel(item.status)}
                            </span>
                        </div>
                        <div className="mt-4 text-[12px] leading-relaxed text-white/[0.58]">{item.detail}</div>
                        <div className="mt-auto flex items-center justify-between pt-5">
                            <span className={cn('inline-flex h-2.5 w-2.5 rounded-full shadow-[0_0_18px_currentColor]', tone.dot, tone.softText)} />
                            {item.href ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/[0.62] transition-colors group-hover:text-white">
                                    Voir
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </span>
                            ) : null}
                        </div>
                    </div>
                );

                if (!item.href) return <div key={item.id}>{content}</div>;

                return (
                    <Link key={item.id} href={item.href} className="block rounded-[20px] text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a]">
                        {content}
                    </Link>
                );
            })}
        </div>
    );
}
