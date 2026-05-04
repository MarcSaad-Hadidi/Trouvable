import Link from 'next/link';
import { ArrowUpRight, ScanSearch } from 'lucide-react';

import { COMMAND_BUTTONS, COMMAND_PANEL, cn, getToneMeta } from './tokens';

export default function CommandEvidenceCard({ title, summary, detail = null, meta = null, href = null, tone = 'neutral', onOpen = null }) {
    const toneMeta = getToneMeta(tone);

    return (
        <article className={cn(COMMAND_PANEL, toneMeta.panel, 'flex h-full flex-col gap-4 p-4')}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.4]">Preuve</div>
                    <div className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-white">{title}</div>
                </div>
                {meta ? <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', toneMeta.pill)}>{meta}</span> : null}
            </div>
            <p className="text-[13px] leading-relaxed text-white/[0.72]">{summary}</p>
            {detail ? <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3 text-[12px] leading-relaxed text-white/[0.68]">{detail}</div> : null}
            <div className="mt-auto flex flex-wrap items-center gap-2">
                {onOpen ? (
                    <button type="button" onClick={onOpen} className={COMMAND_BUTTONS.secondary}>
                        <ScanSearch className="h-4 w-4" />
                        Ouvrir le détail
                    </button>
                ) : null}
                {href ? (
                    <Link href={href} className={COMMAND_BUTTONS.subtle}>
                        Aller à la page
                        <ArrowUpRight className="h-4 w-4" />
                    </Link>
                ) : null}
            </div>
        </article>
    );
}
