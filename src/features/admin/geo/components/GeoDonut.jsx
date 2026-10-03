'use client';

/**
 * Anneau de progression (donut) — pour pourcentages réels uniquement.
 */
export default function GeoDonut({
    percent,
    size = 132,
    stroke = 10,
    color = '#a78bfa',
    trackColor = 'rgba(255,255,255,0.07)',
    children,
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const p = percent != null && Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : null;
    const offset = p != null ? c - (p / 100) * c : c;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
                {p != null && (
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        fill="none"
                        stroke={color}
                        strokeWidth={stroke}
                        strokeLinecap="round"
                        strokeDasharray={c}
                        strokeDashoffset={offset}
                        className="transition-[stroke-dashoffset] duration-700 ease-out"
                        style={{ filter: `drop-shadow(0 0 8px ${color}66)` }}
                    />
                )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">{children}</div>
        </div>
    );
}
