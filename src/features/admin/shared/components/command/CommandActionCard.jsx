import Link from 'next/link';
import { ArrowRight, ScanSearch } from 'lucide-react';

import { COMMAND_BUTTONS, COMMAND_PANEL, cn, getToneMeta } from './tokens';

export default function CommandActionCard({ title, impact, proof, href = null, tone = 'neutral', onInspect = null }) {
    const toneMeta = getToneMeta(tone);

    return (
        <article className={cn(COMMAND_PANEL, toneMeta.panel, 'flex h-full flex-col gap-4 p-4 sm:p-5')}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/[0.42]">Action</div>
                    <div className="mt-3 text-[18px] font-semibold tracking-[-0.03em] text-white">{title}</div>
                </div>
                <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', toneMeta.pill)}>
                    {tone}
                </span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/[0.72]">{impact}</p>
            <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3 text-[12px] leading-relaxed text-white/[0.7]">
                {proof}
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2">
                {href ? (
                    <Link href={href} className={COMMAND_BUTTONS.primary}>
                        Ouvrir
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                ) : null}
                {onInspect ? (
                    <button type="button" onClick={onInspect} className={COMMAND_BUTTONS.secondary}>
                        <ScanSearch className="h-4 w-4" />
                        Voir la preuve
                    </button>
                ) : null}
            </div>
        </article>
    );
}
