import Link from 'next/link';

import { COMMAND_PANEL, cn, getToneMeta } from './tokens';

export default function CommandMetricCard({ label, value, detail = null, tone = 'neutral', href = null }) {
    const toneMeta = getToneMeta(tone);
    const content = (
        <div className={cn(COMMAND_PANEL, toneMeta.panel, 'flex h-full min-h-[112px] flex-col justify-between p-4')}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.38]">{label}</div>
            <div className={cn('mt-4 text-[28px] font-semibold tracking-[-0.05em]', toneMeta.text)}>{value}</div>
            {detail ? <div className="mt-3 text-[11px] leading-relaxed text-white/[0.6]">{detail}</div> : null}
        </div>
    );

    if (!href) return content;
    return (
        <Link href={href} className="block h-full rounded-[22px] text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a]">
            {content}
        </Link>
    );
}
