'use client';

import { useCallback, useMemo, useState } from 'react';
import {
    Area,
    Brush,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function getLastFiniteValue(values = []) {
    for (let index = values.length - 1; index >= 0; index -= 1) {
        if (isFiniteNumber(values[index])) return values[index];
    }
    return null;
}

function ChartTooltip({ active, payload, label, valueFormatter, hiddenKeys }) {
    if (!active || !payload?.length) return null;

    const rows = payload.filter((item) => item && item.dataKey && !hiddenKeys[item.dataKey]);
    if (!rows.length) return null;

    return (
        <div className="rounded-xl border border-slate-400/25 bg-[#252b3a]/95 px-3.5 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <div className="border-b border-white/[0.08] pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">
                {label}
            </div>
            <div className="mt-2.5 flex flex-col gap-2">
                {rows.map((item) => (
                    <div key={String(item.dataKey)} className="flex items-center justify-between gap-6 text-[12px]">
                        <span className="flex items-center gap-2 font-medium text-white/75">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                            {item.name}
                        </span>
                        <span className="tabular-nums text-[13px] font-semibold text-white">
                            {item.value != null && isFiniteNumber(item.value) ? valueFormatter(item.value) : 'n.d.'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SeriesLegend({ seriesList, hiddenKeys, onToggle, primaryId }) {
    if (!seriesList?.length) return null;

    return (
        <div className="flex flex-wrap justify-center gap-2 px-1 pb-2">
            {seriesList.map((s) => {
                const hidden = hiddenKeys[s.id];
                const isPrimary = s.id === primaryId;
                return (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => onToggle(s.id)}
                        title={hidden ? 'Afficher la serie' : 'Masquer la serie'}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                            hidden
                                ? 'border-white/[0.06] bg-white/[0.03] text-white/35 line-through'
                                : isPrimary
                                    ? 'border-white/[0.18] bg-white/[0.09] text-white'
                                    : 'border-white/[0.12] bg-white/[0.06] text-white/85 hover:bg-white/[0.09]'
                        }`}
                    >
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.label}
                        {isPrimary ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">principale</span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Graphique d'evolution interactif (Recharts): tooltip au survol, legende cliquable pour masquer/afficher une serie,
 * brush de plage lorsqu'il y a assez de points, grille et axes lisibles.
 */
export default function CommandLineChart({
    labels = [],
    series = [],
    min = 0,
    max = 100,
    /** Renseigne seulement si le parent ne fixe pas la hauteur (ex. `className="h-[300px]"`). */
    height = null,
    className = '',
    valueFormatter = (value) => `${Math.round(value)}%`,
    primarySeriesId = null,
}) {
    const [hiddenKeys, setHiddenKeys] = useState({});

    const normalizedSeries = useMemo(() => {
        return (series || [])
            .map((entry, index) => {
                const id = entry?.id || entry?.label || `series-${index}`;
                const normalizedValues = Array.from({ length: labels.length }, (_, valueIndex) => {
                    const raw = entry?.values?.[valueIndex];
                    return isFiniteNumber(raw) ? raw : null;
                });
                if (!normalizedValues.some(isFiniteNumber)) return null;

                return {
                    id,
                    label: entry?.label || id,
                    color: entry?.color || '#60a5fa',
                    values: normalizedValues,
                    latestValue: getLastFiniteValue(normalizedValues),
                };
            })
            .filter(Boolean);
    }, [labels.length, series]);

    const resolvedPrimaryId = useMemo(() => {
        if (!normalizedSeries.length) return null;
        if (primarySeriesId && normalizedSeries.some((s) => s.id === primarySeriesId)) return primarySeriesId;
        return normalizedSeries[0].id;
    }, [normalizedSeries, primarySeriesId]);

    const chartData = useMemo(() => {
        return labels.map((name, index) => {
            const row = { name };
            for (const s of normalizedSeries) {
                row[s.id] = s.values[index];
            }
            return row;
        });
    }, [labels, normalizedSeries]);

    const toggleSeries = useCallback((dataKey) => {
        setHiddenKeys((prev) => ({
            ...prev,
            [dataKey]: !prev[dataKey],
        }));
    }, []);

    if (!labels.length || !normalizedSeries.length) {
        return null;
    }

    const showBrush = chartData.length > 6;

    const rootStyle = height != null ? { height } : undefined;

    return (
        <div
            className={`relative flex h-full min-h-[200px] w-full flex-col overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.02),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.02),transparent_40%)] p-1 sm:p-2 ${className}`.trim()}
            style={rootStyle}
        >
            <SeriesLegend
                seriesList={normalizedSeries}
                hiddenKeys={hiddenKeys}
                onToggle={toggleSeries}
                primaryId={resolvedPrimaryId}
            />
            <div className="min-h-0 w-full flex-1">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={chartData}
                        margin={{
                            top: 8,
                            right: 10,
                            left: 2,
                            bottom: showBrush ? 28 : 10,
                        }}
                    >
                    <defs>
                        {normalizedSeries.map((s) => (
                            <linearGradient key={`grad-${s.id}`} id={`area-fill-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                                <stop offset="70%" stopColor={s.color} stopOpacity={0.06} />
                                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>

                    <CartesianGrid
                        strokeDasharray="4 6"
                        stroke="rgba(255,255,255,0.07)"
                        vertical={false}
                    />

                    <XAxis
                        dataKey="name"
                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                        interval="preserveStartEnd"
                        minTickGap={28}
                    />

                    <YAxis
                        domain={[min, max]}
                        tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        tickFormatter={(v) => (Number.isInteger(v) ? String(v) : Number(v).toFixed(0))}
                    />

                    <Tooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.25)', strokeWidth: 1 }}
                        content={(
                            <ChartTooltip
                                valueFormatter={valueFormatter}
                                hiddenKeys={hiddenKeys}
                            />
                        )}
                    />

                    {normalizedSeries.map((s) => {
                        const isPrimary = s.id === resolvedPrimaryId;
                        const hidden = Boolean(hiddenKeys[s.id]);

                        if (isPrimary) {
                            return (
                                <Area
                                    key={s.id}
                                    type="monotone"
                                    dataKey={s.id}
                                    name={s.label}
                                    stroke={s.color}
                                    strokeWidth={2.5}
                                    fill={`url(#area-fill-${s.id})`}
                                    activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                    dot={{ r: 3, strokeWidth: 1, stroke: 'rgba(255,255,255,0.4)', fill: s.color }}
                                    connectNulls
                                    isAnimationActive
                                    hide={hidden}
                                />
                            );
                        }

                        return (
                            <Line
                                key={s.id}
                                type="monotone"
                                dataKey={s.id}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                                connectNulls
                                isAnimationActive
                                hide={hidden}
                            />
                        );
                    })}

                    {showBrush ? (
                        <Brush
                            dataKey="name"
                            height={20}
                            stroke="rgba(148,163,184,0.35)"
                            fill="rgba(255,255,255,0.05)"
                            travellerWidth={8}
                        />
                    ) : null}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
