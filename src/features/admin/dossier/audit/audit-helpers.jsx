'use client';

export function toArray(value) {
    return Array.isArray(value) ? value : [];
}

export function normalizeIssue(issue, index) {
    if (typeof issue === 'string') {
        return {
            id: `issue-${index}`,
            title: issue,
            description: issue,
            priority: 'medium',
            category: 'seo',
            evidence_status: 'not_found',
            evidence_summary: '',
            recommended_fix: '',
            provenance: 'observed',
        };
    }
    return {
        id: `issue-${index}`,
        title: issue?.title || issue?.description || 'Problème',
        description: issue?.description || issue?.title || 'Problème',
        priority: issue?.priority || issue?.severity || 'medium',
        category: issue?.category || 'seo',
        evidence_status: issue?.evidence_status || 'not_found',
        evidence_summary: issue?.evidence_summary || '',
        recommended_fix: issue?.recommended_fix || '',
        provenance: issue?.provenance || 'observed',
    };
}

export function normalizeStrength(strength, index) {
    if (typeof strength === 'string') {
        return {
            id: `strength-${index}`,
            title: strength,
            description: strength,
            evidence_summary: '',
            provenance: 'observed',
        };
    }
    return {
        id: `strength-${index}`,
        title: strength?.title || strength?.description || 'Point fort',
        description: strength?.description || strength?.title || 'Point fort',
        evidence_summary: strength?.evidence_summary || '',
        provenance: strength?.provenance || 'observed',
    };
}

export function getPriorityTone(priority) {
    if (priority === 'high') return 'bg-red-400/10 text-red-300 border-red-400/20';
    if (priority === 'low') return 'bg-white/[0.05] text-white/55 border-white/10';
    return 'bg-amber-400/10 text-amber-200 border-amber-400/20';
}

export function getEvidenceStatusMeta(value) {
    if (value === 'detected') return { label: 'Détecté', tone: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20' };
    if (value === 'weak_evidence') return { label: 'Preuve faible', tone: 'bg-amber-400/10 text-amber-200 border-amber-400/20' };
    if (value === 'not_applicable') return { label: 'Pertinence faible', tone: 'bg-white/[0.05] text-white/55 border-white/10' };
    return { label: 'Non trouvé', tone: 'bg-red-400/10 text-red-300 border-red-400/20' };
}

export function getScoreTone(score) {
    if (score >= 80) return 'text-emerald-300';
    if (score >= 60) return 'text-violet-300';
    if (score >= 40) return 'text-amber-200';
    return 'text-red-300';
}

export function getScoreBg(score) {
    if (score >= 60) return 'bg-emerald-400/10 border-emerald-400/20';
    if (score >= 40) return 'bg-amber-400/10 border-amber-400/20';
    return 'bg-red-400/10 border-red-400/20';
}

export function Pill({ label, tone }) {
    return (
        <span className={`inline-flex items-center leading-none rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.06em] ${tone}`}>
            {label}
        </span>
    );
}

export function collectAllBlocks(audit) {
    const pageSummaries = toArray(audit?.extracted_data?.page_summaries);
    const blocks = [];
    for (const page of pageSummaries) {
        for (const block of toArray(page?.citability?.top_blocks)) {
            if (block && typeof block.citability_score === 'number') {
                blocks.push(block);
            }
        }
    }
    return blocks;
}

export function computePageStats(audit) {
    const pageSummaries = toArray(audit?.extracted_data?.page_summaries);
    let totalPages = 0;
    let totalBlocks = 0;
    let highBlocks = 0;
    let lowBlocks = 0;
    let scoreSum = 0;
    let scoreCount = 0;
    for (const page of pageSummaries) {
        const cit = page?.citability;
        if (!cit) continue;
        totalPages++;
        totalBlocks += cit.block_count || 0;
        highBlocks += cit.high_citability_count || 0;
        lowBlocks += cit.low_citability_count || 0;
        if (typeof cit.page_score === 'number') {
            scoreSum += cit.page_score;
            scoreCount++;
        }
    }
    return { totalPages, totalBlocks, highBlocks, lowBlocks, avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null };
}

export function extractLlmsTxtStatus(audit) {
    const issues = toArray(audit?.issues);
    const strengths = toArray(audit?.strengths);
    const llmsIssue = issues.find((i) => String(i?.title || '').toLowerCase().includes('llms.txt'));
    const llmsStrength = strengths.find((s) => String(s?.title || '').toLowerCase().includes('llms.txt'));
    if (llmsStrength) return { found: true, valid: true, label: llmsStrength.title, detail: llmsStrength.evidence_summary || llmsStrength.description };
    if (llmsIssue) return { found: false, valid: false, label: llmsIssue.title, detail: llmsIssue.recommended_fix || llmsIssue.evidence_summary };
    return null;
}

export function extractCrawlerStatus(audit) {
    const issues = toArray(audit?.issues);
    const strengths = toArray(audit?.strengths);
    const crawlerIssue = issues.find((i) => String(i?.title || '').toLowerCase().includes('ai crawler'));
    const crawlerStrength = strengths.find((s) => String(s?.title || '').toLowerCase().includes('ai crawler'));
    if (crawlerStrength) return { ok: true, label: crawlerStrength.title, detail: crawlerStrength.evidence_summary || crawlerStrength.description };
    if (crawlerIssue) return { ok: false, label: crawlerIssue.title, detail: crawlerIssue.evidence_summary || crawlerIssue.recommended_fix };
    return null;
}

/**
 * Maps an issue's title/category to a remediation type, if supported.
 */
export function getRemediationType(issue) {
    const title = String(issue?.title || '').toLowerCase();
    const category = String(issue?.category || '').toLowerCase();
    if (title.includes('faq') || (category === 'content' && title.includes('question'))) return 'missing_faq_for_intent';
    if (title.includes('local') || title.includes('nap') || title.includes('adresse')) return 'weak_local_clarity';
    if (title.includes('schema') || title.includes('json-ld') || title.includes('données structurées')) return 'schema_missing_or_incoherent';
    if (title.includes('llms.txt')) return 'llms_txt_missing';
    if (title.includes('crawler') || title.includes('robots') || title.includes('bot')) return 'ai_crawlers_blocked';
    return null;
}
