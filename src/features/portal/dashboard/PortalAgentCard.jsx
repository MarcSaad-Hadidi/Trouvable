const VERDICT_META = {
    bon: { label: 'Bon', tone: 'emerald', copy: 'Base solide pour être recommandé par les moteurs IA.' },
    a_consolider: {
        label: 'À consolider',
        tone: 'amber',
        copy: 'Certaines dimensions sont partielles — des ajustements ciblés augmenteront la recommandation.',
    },
    a_reprendre: {
        label: 'À reprendre',
        tone: 'red',
        copy: 'La base actuelle ne permet pas encore une visibilité IA fiable. Priorité aux correctifs en cours.',
    },
    unavailable: {
        label: 'Indisponible',
        tone: 'slate',
        copy: 'Pas encore assez de données observées pour conclure sur la visibilité IA.',
    },
};

const CONFIDENCE_LABEL = {
    high: 'Confiance haute',
    medium: 'Confiance moyenne',
    low: 'Confiance basse',
    unavailable: 'Confiance indisponible',
};

const TONE_CLASS = {
    emerald: {
        ring: 'border-emerald-400/25 bg-emerald-400/[0.05]',
        accent: 'text-emerald-300',
        stroke: '#34d399',
    },
    amber: {
        ring: 'border-amber-400/25 bg-amber-400/[0.05]',
        accent: 'text-amber-300',
        stroke: '#fbbf24',
    },
    red: {
        ring: 'border-red-400/25 bg-red-400/[0.05]',
        accent: 'text-red-300',
        stroke: '#f87171',
    },
    slate: {
        ring: 'border-white/[0.08] bg-white/[0.02]',
        accent: 'text-white/70',
        stroke: '#a1a1aa',
    },
};

function RingGauge({ score, stroke }) {
    const value = typeof score === 'number' ? Math.max(0, Math.min(100, score)) : 0;
    const circumference = 2 * Math.PI * 42;
    const dash = (value / 100) * circumference;
    return (
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={stroke}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
            />
        </svg>
    );
}

function SubscorePill({ label, score }) {
    const missing = typeof score !== 'number';
    return (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40">{label}</div>
            <div className={`mt-1 text-[18px] font-bold tabular-nums ${missing ? 'text-white/40' : 'text-white/90'}`}>
                {missing ? '—' : score}
                {!missing && <span className="ml-1 text-[11px] font-semibold text-white/35">/100</span>}
            </div>
        </div>
    );
}

export default function PortalAgentCard({ agent }) {
    if (!agent) return null;

    const verdict = agent.verdict || 'unavailable';
    const meta = VERDICT_META[verdict] || VERDICT_META.unavailable;
    const tone = TONE_CLASS[meta.tone] || TONE_CLASS.slate;
    const score = typeof agent.score === 'number' ? agent.score : null;

    return (
        <section className={`rounded-2xl border p-5 ${tone.ring}`}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-5">
                    <div className="relative flex items-center justify-center">
                        <RingGauge score={score} stroke={tone.stroke} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[24px] font-bold leading-none text-white tabular-nums">
                                {score === null ? '—' : score}
                            </span>
                            <span className="text-[10px] font-semibold text-white/40 tracking-wide">/100</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                            Score AGENT
                        </div>
                        <div className={`mt-1 text-[18px] font-bold leading-tight ${tone.accent}`}>{meta.label}</div>
                        <p className="mt-1 max-w-md text-[12px] leading-snug text-white/55">{meta.copy}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/60">
                        {CONFIDENCE_LABEL[agent.confidence] || CONFIDENCE_LABEL.unavailable}
                    </span>
                    {agent.provisional && (
                        <span className="inline-flex items-center rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-200">
                            Score provisoire
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <SubscorePill label="Visibilité" score={agent.subscores?.visibility} />
                <SubscorePill label="Préparation" score={agent.subscores?.readiness} />
                <SubscorePill label="Actionnabilité" score={agent.subscores?.actionability} />
                <SubscorePill label="Protocoles" score={agent.subscores?.advancedProtocols} />
            </div>

            <p className="mt-4 text-[11px] leading-relaxed text-white/45">
                Score calculé chaque fois que vous ouvrez ce tableau. Les 4 dimensions sont désormais actives.
            </p>
        </section>
    );
}
