'use client';

/**
 * Composable “scènes” opérateur — accents visuels partagés, compositions laissées aux vues.
 */

const ACCENT = {
    cyan: {
        border: 'border-cyan-400/18',
        wash: 'from-cyan-400/14 via-sky-500/6 to-transparent',
        dot: 'bg-cyan-400',
        line: 'via-cyan-400/25',
    },
    violet: {
        border: 'border-violet-400/18',
        wash: 'from-violet-500/14 via-fuchsia-500/5 to-transparent',
        dot: 'bg-violet-400',
        line: 'via-violet-400/25',
    },
    sky: {
        border: 'border-sky-400/18',
        wash: 'from-sky-400/12 via-blue-500/5 to-transparent',
        dot: 'bg-sky-400',
        line: 'via-sky-400/28',
    },
    amber: {
        border: 'border-amber-400/20',
        wash: 'from-amber-400/12 via-orange-500/6 to-transparent',
        dot: 'bg-amber-400',
        line: 'via-amber-400/25',
    },
    emerald: {
        border: 'border-emerald-400/18',
        wash: 'from-emerald-400/12 via-teal-500/5 to-transparent',
        dot: 'bg-emerald-400',
        line: 'via-emerald-400/25',
    },
};

export function OperatorNarrativeHeader({
    accent = 'sky',
    eyebrow,
    title,
    description,
    footer = null,
    className = '',
}) {
    const a = ACCENT[accent] || ACCENT.sky;

    return (
        <div
            className={`relative overflow-hidden rounded-[22px] border ${a.border} bg-[linear-gradient(165deg,rgba(12,14,18,0.96)_0%,rgba(8,9,11,0.92)_100%)] px-5 py-6 sm:px-7 sm:py-7 shadow-[0_24px_56px_rgba(0,0,0,0.35)] ${className}`}
        >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${a.wash}`} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-90" style={{ background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)` }} />

            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0 max-w-3xl">
                    {eyebrow ? (
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
                            <span className={`h-1.5 w-1.5 rounded-full ${a.dot} shadow-[0_0_12px_currentColor]`} />
                            {eyebrow}
                        </div>
                    ) : null}
                    <h2 className="mt-2 text-[20px] font-bold tracking-[-0.03em] text-white sm:text-[24px]">{title}</h2>
                    {description ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-white/58">{description}</p>
                    ) : null}
                </div>
                {footer ? <div className="shrink-0">{footer}</div> : null}
            </div>
        </div>
    );
}

export function OperatorStickyAside({ children, className = '' }) {
    return (
        <aside className={`lg:sticky lg:top-20 lg:self-start ${className}`}>
            <div className="rounded-[20px] border border-white/[0.08] bg-[#0b0d11]/88 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-md">
                {children}
            </div>
        </aside>
    );
}

export function OperatorAsideNav({ items = [] }) {
    if (!items.length) return null;

    return (
        <nav className="space-y-1.5" aria-label="Sections de la page">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">Sur cette page</div>
            <ul className="space-y-1">
                {items.map((item) => (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            className="flex items-center gap-2 rounded-lg border border-transparent px-2.5 py-2 text-[12px] font-medium text-white/55 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-white/88"
                        >
                            <span className="h-1 w-1 rounded-full bg-white/25" />
                            {item.label}
                        </a>
                    </li>
                ))}
            </ul>
        </nav>
    );
}

export function OperatorWorkbenchFrame({ left, center, right, className = '' }) {
    return (
        <div className={`grid gap-4 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)_minmax(260px,300px)] ${className}`}>
            <div className="min-w-0">{left}</div>
            <div className="min-w-0 xl:order-none">{center}</div>
            <div className="min-w-0">{right}</div>
        </div>
    );
}
