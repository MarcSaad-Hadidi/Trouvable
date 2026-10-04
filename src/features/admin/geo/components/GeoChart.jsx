'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function getDates(points) {
    const dates = [];
    const d = new Date();
    for (let i = points - 1; i >= 0; i--) {
        const past = new Date(d);
        past.setDate(d.getDate() - i);
        dates.push(past.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }));
    }
    return dates;
}

export default function GeoChart({ series, options = {} }) {
    const canvasRef = useRef(null);
    const wrapRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const padRef = useRef(null);
    const layoutRef = useRef(null);

    const {
        interactive = false,
        height: optHeight,
        h: optH,
        min: minVal,
        max: maxVal,
        unit = '%',
        gridVals,
        lw,
        grid = false,
        showLabels = false,
        pad: customPad,
        labels: customLabels,
        fillArea = true,
    } = options;

    const h = optHeight || optH;

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;

        const W = wrap.offsetWidth || 400;
        const H = h || wrap.offsetHeight || 130;
        const PR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

        canvas.width = W * PR;
        canvas.height = H * PR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(PR, PR);

        const pad = customPad || { l: 10, r: 10, t: 10, b: 20 };
        padRef.current = pad;
        const iW = W - pad.l - pad.r;
        const iH = H - pad.t - pad.b;

        const n = series[0]?.data?.length || 0;
        if (n === 0) return;

        const xs = (i) => {
            if (n === 1) return pad.l + iW / 2;
            return pad.l + (i / (n - 1)) * iW;
        };

        const finiteVals = series.flatMap((s) => s.data.filter((v) => Number.isFinite(v)));
        let mn = minVal != null ? minVal : finiteVals.length > 0 ? Math.max(0, Math.min(...finiteVals) - 5) : 0;
        let mx = maxVal != null ? maxVal : finiteVals.length > 0 ? Math.min(100, Math.max(...finiteVals) + 5) : 100;
        if (mx <= mn) {
            mn = Math.max(0, mn - 1);
            mx = Math.min(100, mx + 1);
        }
        const ys = (v) => pad.t + iH - ((v - mn) / (mx - mn)) * iH;

        layoutRef.current = { W, H, pad, iW, iH, n, xs, ys, mn, mx };

        ctx.clearRect(0, 0, W, H);

        if (grid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            const gv = gridVals || [mn, (mn + mx) / 2, mx];
            gv.forEach((v) => {
                ctx.beginPath();
                ctx.moveTo(pad.l, ys(v));
                ctx.lineTo(W - pad.r, ys(v));
                ctx.stroke();
            });
        }

        const labels = customLabels || getDates(n);

        if (showLabels) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '10px Inter';
            ctx.textAlign = 'center';
            const steps = Math.min(n, 5);
            for (let i = 0; i < steps; i++) {
                const idx = steps <= 1 ? 0 : Math.floor((i * (n - 1)) / (steps - 1));
                ctx.fillText(labels[idx], xs(idx), H - 4);
            }
        }

        series.forEach((s) => {
            const pts = s.data;
            const hasGap = pts.some((v) => !Number.isFinite(v));
            const doFill = fillArea && !hasGap && pts.every((v) => Number.isFinite(v));

            if (doFill) {
                const grd = ctx.createLinearGradient(0, pad.t, 0, H - pad.b);
                grd.addColorStop(0, s.color + '40');
                grd.addColorStop(1, s.color + '00');

                ctx.beginPath();
                ctx.moveTo(xs(0), ys(pts[0]));
                for (let i = 1; i < n; i++) {
                    const cx = (xs(i - 1) + xs(i)) / 2;
                    ctx.bezierCurveTo(cx, ys(pts[i - 1]), cx, ys(pts[i]), xs(i), ys(pts[i]));
                }
                ctx.lineTo(xs(n - 1), H - pad.b);
                ctx.lineTo(xs(0), H - pad.b);
                ctx.closePath();
                ctx.fillStyle = grd;
                ctx.fill();
            }

            ctx.beginPath();
            let prev = -1;
            for (let i = 0; i < n; i++) {
                if (!Number.isFinite(pts[i])) {
                    prev = -1;
                    continue;
                }
                if (prev < 0) {
                    ctx.moveTo(xs(i), ys(pts[i]));
                    prev = i;
                } else {
                    const cx = (xs(prev) + xs(i)) / 2;
                    ctx.bezierCurveTo(cx, ys(pts[prev]), cx, ys(pts[i]), xs(i), ys(pts[i]));
                    prev = i;
                }
            }
            ctx.strokeStyle = s.color;
            ctx.lineWidth = lw || 2;
            ctx.shadowColor = s.color;
            ctx.shadowBlur = 6;
            ctx.shadowOffsetY = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            if (n === 1 && Number.isFinite(pts[0])) {
                ctx.beginPath();
                ctx.arc(xs(0), ys(pts[0]), 4, 0, Math.PI * 2);
                ctx.fillStyle = s.color;
                ctx.fill();
            }
        });
    }, [series, h, minVal, maxVal, gridVals, grid, showLabels, customLabels, customPad, lw, fillArea]);

    useEffect(() => {
        draw();
        let rafId = null;
        const handleResize = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(draw);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [draw]);

    const handleMouseMove = useCallback(
        (e) => {
            if (!interactive || !layoutRef.current || !wrapRef.current) return;
            const rect = wrapRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const { pad, iW, n, xs } = layoutRef.current;
            const labels = customLabels || getDates(n);

            const step = n <= 1 ? iW : iW / (n - 1);
            let index = Math.round((mouseX - pad.l) / step);
            if (index < 0) index = 0;
            if (index >= n) index = n - 1;

            const exactX = xs(index);

            const rows = series.map((s) => ({
                label: s.label || 'Val',
                color: s.color,
                value: Number.isFinite(s.data[index]) ? s.data[index] : null,
            }));

            setTooltip({
                x: exactX,
                wrapWidth: wrapRef.current.offsetWidth || 400,
                date: labels[index] || `#${index}`,
                rows,
                lineTop: pad.t,
                lineHeight: layoutRef.current.iH,
            });
        },
        [interactive, series, customLabels],
    );

    const handleMouseLeave = useCallback(() => {
        setTooltip(null);
    }, []);

    return (
        <div
            ref={wrapRef}
            className="relative w-full"
            style={{ height: h || 130 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <canvas ref={canvasRef} className="block" style={{ width: '100%', height: '100%' }} />

            {tooltip && (
                <>
                    <div
                        className="absolute pointer-events-none"
                        style={{
                            left: tooltip.x,
                            top: tooltip.lineTop,
                            height: tooltip.lineHeight,
                            width: 1,
                            background: 'rgba(255,255,255,0.15)',
                            zIndex: 10,
                        }}
                    />
                    <div
                        className="absolute pointer-events-none z-20"
                        style={{
                            left: Math.min(Math.max(tooltip.x, 70), tooltip.wrapWidth - 70),
                            top: tooltip.lineTop - 4,
                            transform: 'translate(-50%, -100%)',
                        }}
                    >
                        <div className="bg-[rgba(10,10,10,0.95)] backdrop-blur-lg border border-white/10 rounded-lg px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.7)] min-w-[120px]">
                            <div className="text-[10px] text-white/25 font-bold uppercase tracking-[0.06em] mb-1.5">
                                {tooltip.date}
                            </div>
                            {tooltip.rows.map((r, i) => (
                                <div key={i} className="flex justify-between items-center gap-4 mb-0.5 text-xs">
                                    <div className="flex items-center gap-1.5 text-white/55">
                                        <span
                                            className="w-2 h-2 rounded-full inline-block"
                                            style={{ background: r.color, boxShadow: `0 0 6px ${r.color}` }}
                                        />
                                        {r.label}
                                    </div>
                                    <span className="font-bold text-white/90">
                                        {r.value != null ? `${r.value}${unit}` : 'n.d.'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
