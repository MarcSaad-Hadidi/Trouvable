'use client';

import { useId, useMemo } from 'react';
import { motion } from 'framer-motion';

export default function PremiumSparkline({
    data = [],
    color = '#34d399',
    width = 120,
    height = 32,
    strokeWidth = 1.5,
    showArea = true,
    showEndDot = true,
    animate = true,
    className = '',
}) {
    const uid = useId();

    const result = useMemo(() => {
        const valid = data
            .map((v, i) => (v != null && Number.isFinite(Number(v)) ? { i, v: Number(v) } : null))
            .filter(Boolean);

        if (valid.length < 2) return null;

        const minV = Math.min(...valid.map((p) => p.v));
        const maxV = Math.max(...valid.map((p) => p.v));
        const range = maxV - minV || 1;

        const px = showEndDot ? 6 : 4;
        const py = showEndDot ? 6 : 4;
        const iW = width - px * 2;
        const iH = height - py * 2;
        const total = data.length - 1 || 1;

        const points = valid.map((p) => ({
            x: px + (p.i / total) * iW,
            y: py + iH - ((p.v - minV) / range) * iH,
        }));

        let d = `M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
        for (let i = 1; i < points.length; i++) {
            const cx = ((points[i - 1].x + points[i].x) / 2).toFixed(1);
            d += ` C${cx},${points[i - 1].y.toFixed(1)} ${cx},${points[i].y.toFixed(1)} ${points[i].x.toFixed(1)},${points[i].y.toFixed(1)}`;
        }

        const last = points[points.length - 1];
        const first = points[0];
        const area = `${d} L${last.x.toFixed(1)},${(height - 1).toFixed(1)} L${first.x.toFixed(1)},${(height - 1).toFixed(1)} Z`;

        return { linePath: d, areaPath: area, lastPoint: last };
    }, [data, width, height, showEndDot]);

    if (!result) return null;

    const gradientId = `spark-${uid}`;
    const { linePath, areaPath, lastPoint } = result;

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" className={className}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            {showArea && (
                <motion.path
                    d={areaPath}
                    fill={`url(#${gradientId})`}
                    initial={animate ? { opacity: 0 } : undefined}
                    animate={{ opacity: 0.65 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                />
            )}
            <motion.path
                d={linePath}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
                initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 3px ${color}44)` }}
            />
            {showEndDot && lastPoint && (
                <motion.circle
                    cx={lastPoint.x}
                    cy={lastPoint.y}
                    r={2.5}
                    fill={color}
                    initial={animate ? { scale: 0, opacity: 0 } : undefined}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.7, duration: 0.25 }}
                    style={{ filter: `drop-shadow(0 0 5px ${color}77)` }}
                />
            )}
        </svg>
    );
}
