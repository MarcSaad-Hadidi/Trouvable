'use client';

export function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function getScoreTone(score) {
    if (score >= 80) return 'text-emerald-300';
    if (score >= 60) return 'text-violet-300';
    if (score >= 40) return 'text-amber-200';
    return 'text-red-300';
}

export function Pill({ label, tone }) {
    return (
        <span
            className={`inline-flex items-center leading-none rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.06em] ${tone}`}
        >
            {label}
        </span>
    );
}

export function extractLlmsTxtStatus(audit) {
    const issues = toArray(audit?.issues);
    const strengths = toArray(audit?.strengths);
    const llmsIssue = issues.find((i) =>
        String(i?.title || '')
            .toLowerCase()
            .includes('llms.txt'),
    );
    const llmsStrength = strengths.find((s) =>
        String(s?.title || '')
            .toLowerCase()
            .includes('llms.txt'),
    );
    if (llmsStrength)
        return {
            found: true,
            valid: true,
            label: llmsStrength.title,
            detail: llmsStrength.evidence_summary || llmsStrength.description,
        };
    if (llmsIssue)
        return {
            found: false,
            valid: false,
            label: llmsIssue.title,
            detail: llmsIssue.recommended_fix || llmsIssue.evidence_summary,
        };
    return null;
}

export function extractCrawlerStatus(audit) {
    const issues = toArray(audit?.issues);
    const strengths = toArray(audit?.strengths);
    const crawlerIssue = issues.find((i) =>
        String(i?.title || '')
            .toLowerCase()
            .includes('ai crawler'),
    );
    const crawlerStrength = strengths.find((s) =>
        String(s?.title || '')
            .toLowerCase()
            .includes('ai crawler'),
    );
    if (crawlerStrength)
        return {
            ok: true,
            label: crawlerStrength.title,
            detail: crawlerStrength.evidence_summary || crawlerStrength.description,
        };
    if (crawlerIssue)
        return {
            ok: false,
            label: crawlerIssue.title,
            detail: crawlerIssue.evidence_summary || crawlerIssue.recommended_fix,
        };
    return null;
}
