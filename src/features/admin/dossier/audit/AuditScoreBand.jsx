'use client';

import { readSeoScore, readGeoScore, readOverallScore } from '@/lib/audit/scores-facade';

import { getScoreTone, Pill } from './audit-helpers';

function getScoreBarColor(score) {
    if (score >= 80) return 'bg-emerald-400';
    if (score >= 60) return 'bg-violet-400';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
}

export default function AuditScoreBand({ audit }) {
    const seoReading = readSeoScore(audit);
    const geoReading = readGeoScore(audit);
    const overallReading = readOverallScore(audit);
    const seoScore = seoReading.value;
    const geoScore = geoReading.value;
    const hybridScore = audit?.geo_breakdown?.overall?.hybrid_score ?? overallReading.value;
    const siteType = audit?.geo_breakdown?.site_classification?.label || audit?.seo_breakdown?.site_classification?.label || null;

    return (
        <div>
            <div className="flex flex-wrap items-center justify-center gap-5">
                <ScoreCard label="SEO technique" value={seoScore} />
                <div className="hidden sm:block h-10 w-px bg-white/[0.06]" />
                <ScoreCard label="Score GEO" value={geoScore} />
                <div className="hidden sm:block h-10 w-px bg-white/[0.06]" />
                <ScoreCard label="Hybride" value={hybridScore} primary />
                <div className="flex items-center gap-2">
                    {siteType && <Pill label={siteType} tone="bg-violet-400/10 text-violet-300 border-violet-400/20" />}
                    <Pill label="Observé + dérivé" tone="bg-white/[0.05] text-white/55 border-white/10" />
                </div>
            </div>
        </div>
    );
}

function ScoreCard({ label, value, primary }) {
    const tone = value != null ? getScoreTone(value) : 'text-white/30';
    return (
        <div className={`flex flex-col items-center gap-1 rounded-xl px-5 py-3 ${
            primary
                ? 'bg-gradient-to-br from-violet-500/[0.12] to-violet-600/[0.04] border border-violet-400/20 shadow-[0_0_24px_rgba(139,92,246,0.12)]'
                : 'bg-white/[0.04] border border-white/[0.08]'
        }`}>
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/50">{label}</span>
            <div className="flex items-baseline gap-1">
                <span className={`font-['Plus_Jakarta_Sans',sans-serif] ${primary ? 'text-4xl geo-premium-hero-num' : 'text-2xl'} font-extrabold tabular-nums ${primary ? 'text-white/90' : tone}`}>
                    {value != null ? value : '–'}
                </span>
                {value != null && <span className="text-[11px] text-white/30">/100</span>}
            </div>
            {value != null && (
                <div className="mt-1.5 h-1 w-16 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full rounded-full ${getScoreBarColor(value)}`} style={{ width: `${value}%` }} />
                </div>
            )}
        </div>
    );
}
