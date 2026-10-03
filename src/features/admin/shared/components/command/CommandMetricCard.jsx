import Link from 'next/link';

import { COMMAND_PANEL, cn, getToneMeta } from './tokens';

export default function CommandMetricCard({ label, value, detail = null, tone = 'neutral', href = null }) {
    const toneMeta = getToneMeta(tone);
    const content = (
        <div className={cn(COMMAND_PANEL, toneMeta.panel, 'flex h-full min-h-[112px] flex-col justify-between p-5 transition-all hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.02)]')}>
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">{label}</div>
            <div className={cn('mt-4 text-[32px] font-black tracking-[-0.05em]', toneMeta.text)}>{value}</div>
            {detail ? <div className="mt-3 text-[12px] font-medium leading-relaxed text-white/70">{detail}</div> : null}
        </div>
    );

    if (!href) return content;
    return (
        <Link href={href} className="block h-full rounded-[22px] text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a]">
            {content}
        </Link>
    );
}
