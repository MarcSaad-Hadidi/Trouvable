'use client';

/**
 * DimensionsRadar — radar chart compact des 5 dimensions d'audit.
 *
 * Rendu SVG pour le polygone + labels HTML absolus pour éviter les
 * coupures de texte dans le conteneur parent et assurer la lisibilité
 * de chaque point (nom complet + score).
 *
 * Props :
 *   - dimensions : [{ key, label, score, max? }] (score 0-100)
 *   - previousDimensions : même shape, rendu en contour fantôme si fourni
 *   - size : pixels du radar (défaut 240)
 *   - accent : 'violet' | 'sky' | 'emerald' (défaut 'violet')
 *   - showLabels : rend les labels autour du radar (true)
 */

const ACCENT_STROKES = {
    violet: { main: '#a78bfa', fill: 'rgba(167, 139, 250, 0.18)' },
    sky: { main: '#7dd3fc', fill: 'rgba(125, 211, 252, 0.18)' },
    emerald: { main: '#6ee7b7', fill: 'rgba(110, 231, 183, 0.18)' },
};

function polarToCartesian(cx, cy, radius, angleRad) {
    return {
        x: cx + radius * Math.cos(angleRad),
        y: cy + radius * Math.sin(angleRad),
    };
}

function buildPoints(cx, cy, maxRadius, dims) {
    const n = dims.length;
    if (n === 0) return [];
    const step = (Math.PI * 2) / n;
    const offset = -Math.PI / 2;
    return dims.map((dim, index) => {
        const angle = offset + step * index;
        const ratio = Math.max(0, Math.min(1, Number(dim.score || 0) / Number(dim.max || 100)));
        const point = polarToCartesian(cx, cy, maxRadius * ratio, angle);
        const labelPoint = polarToCartesian(cx, cy, maxRadius + 16, angle);
        return { ...dim, angle, point, labelPoint };
    });
}

function pointsToPath(points) {
    if (points.length === 0) return '';
    const parts = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.point.x.toFixed(1)} ${p.point.y.toFixed(1)}`);
    parts.push('Z');
    return parts.join(' ');
}

function labelAlignment(labelX, centerX) {
    if (Math.abs(labelX - centerX) < 8) return 'center';
    return labelX > centerX ? 'left' : 'right';
}

export default function DimensionsRadar({
    dimensions = [],
    previousDimensions = null,
    size = 240,
    accent = 'violet',
    showLabels = true,
}) {
    if (!Array.isArray(dimensions) || dimensions.length < 3) {
        return null;
    }

    const horizontalPadding = showLabels ? 120 : 12;
    const verticalPadding = showLabels ? 48 : 12;
    const containerWidth = size + horizontalPadding * 2;
    const containerHeight = size + verticalPadding * 2;

    const cx = containerWidth / 2;
    const cy = containerHeight / 2;
    const maxRadius = size / 2;

    const colors = ACCENT_STROKES[accent] || ACCENT_STROKES.violet;
    const currentPoints = buildPoints(cx, cy, maxRadius, dimensions);
    const previousPoints = Array.isArray(previousDimensions) && previousDimensions.length === dimensions.length
        ? buildPoints(cx, cy, maxRadius, previousDimensions)
        : null;

    const rings = [0.25, 0.5, 0.75, 1.0].map((ratio) => ratio * maxRadius);

    return (
        <div className="flex flex-col items-center">
            <div className="relative" style={{ width: containerWidth, height: containerHeight }}>
                <svg
                    width={containerWidth}
                    height={containerHeight}
                    viewBox={`0 0 ${containerWidth} ${containerHeight}`}
                    role="img"
                    aria-label="Score par dimension"
                    className="block"
                >
                    {rings.map((r) => (
                        <circle
                            key={r}
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth={1}
                        />
                    ))}

                    {currentPoints.map((p) => {
                        const axisEnd = {
                            x: cx + maxRadius * Math.cos(p.angle),
                            y: cy + maxRadius * Math.sin(p.angle),
                        };
                        return (
                            <line
                                key={`axis-${p.key || p.label}`}
                                x1={cx}
                                y1={cy}
                                x2={axisEnd.x}
                                y2={axisEnd.y}
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth={1}
                            />
                        );
                    })}

                    {previousPoints ? (
                        <path
                            d={pointsToPath(previousPoints)}
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth={1}
                            strokeDasharray="3 4"
                        />
                    ) : null}

                    <path
                        d={pointsToPath(currentPoints)}
                        fill={colors.fill}
                        stroke={colors.main}
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                    />

                    {currentPoints.map((p) => (
                        <circle
                            key={`dot-${p.key || p.label}`}
                            cx={p.point.x}
                            cy={p.point.y}
                            r={3}
                            fill={colors.main}
                        />
                    ))}
                </svg>

                {showLabels
                    ? currentPoints.map((p) => {
                        const align = labelAlignment(p.labelPoint.x, cx);
                        const style = {
                            top: p.labelPoint.y,
                            transform: 'translateY(-50%)',
                        };
                        if (align === 'center') {
                            style.left = p.labelPoint.x;
                            style.transform = 'translate(-50%, -50%)';
                            style.textAlign = 'center';
                        } else if (align === 'left') {
                            style.left = p.labelPoint.x + 4;
                            style.maxWidth = `${horizontalPadding - 12}px`;
                        } else {
                            style.right = containerWidth - p.labelPoint.x + 4;
                            style.maxWidth = `${horizontalPadding - 12}px`;
                        }
                        return (
                            <div
                                key={`lbl-${p.key || p.label}`}
                                className="pointer-events-none absolute text-[11px] leading-tight"
                                style={style}
                            >
                                <div
                                    className="font-semibold text-white/80"
                                    style={{ textAlign: align === 'center' ? 'center' : align }}
                                >
                                    {p.label}
                                </div>
                                <div
                                    className="mt-0.5 font-bold tabular-nums text-white/95"
                                    style={{ textAlign: align === 'center' ? 'center' : align }}
                                >
                                    {p.score != null ? Math.round(p.score) : '–'}
                                </div>
                            </div>
                        );
                    })
                    : null}
            </div>
        </div>
    );
}
