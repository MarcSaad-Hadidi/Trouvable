import { summarize } from './score-meta.js';

export function makeIssue({
    title,
    description,
    severity = 'medium',
    priority = severity,
    category,
    dimension,
    provenance = 'observed',
    evidence_status = 'not_found',
    evidence_summary = '',
    recommended_fix = '',
}) {
    return {
        title,
        description,
        severity,
        priority,
        category,
        dimension,
        provenance,
        evidence_status,
        evidence_summary,
        recommended_fix,
    };
}

export function makeStrength({ title, description, category, dimension, provenance = 'observed', evidence_summary = '' }) {
    return {
        title,
        description,
        category,
        dimension,
        provenance,
        evidence_status: 'detected',
        evidence_summary,
    };
}

function pushAutomationData(automation_data, field_key, detected_value, confidence_level, source_type) {
    if (detected_value === null || detected_value === undefined) return;
    if (typeof detected_value === 'string' && detected_value.trim().length === 0) return;
    if (Array.isArray(detected_value) && detected_value.length === 0) return;
    if (typeof detected_value === 'object' && !Array.isArray(detected_value) && Object.keys(detected_value).length === 0) return;
    if (detected_value === false || detected_value === 0) return;

    automation_data.push({
        field_key,
        detected_value,
        normalized_value: typeof detected_value === 'string' ? detected_value.trim() : detected_value,
        confidence_level,
        source_type,
        status: 'suggested',
    });
}

export function applyScoreRules({ parts, metrics, truthContext = {}, scanUrlEvidence }) {
    const automation_data = [];

    if (metrics.phones.length) pushAutomationData(automation_data, 'phone', metrics.phones[0], 'high', 'Crawl');
    if (metrics.emails.length) pushAutomationData(automation_data, 'public_email', metrics.emails[0], 'high', 'Crawl');
    if (metrics.description) pushAutomationData(automation_data, 'short_desc', metrics.description, metrics.description.length >= 70 ? 'high' : 'medium', 'Meta Description');
    if (metrics.socialLinks.length) pushAutomationData(automation_data, 'social_profiles', metrics.socialLinks, 'high', 'Crawl');

    if (!metrics.hasHttps) {
        parts.issues.push(makeIssue({
            title: 'HTTPS is not enforced',
            description: 'The resolved site URL is not HTTPS, which is a trust and indexing risk.',
            severity: 'high',
            priority: 'high',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: scanUrlEvidence,
            recommended_fix: 'Redirect the main site to HTTPS and align canonical URLs.',
        }));
    } else {
        parts.strengths.push(makeStrength({
            title: 'HTTPS is active',
            description: 'The resolved URL is served over HTTPS.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: scanUrlEvidence,
        }));
    }

    if (metrics.hasNoindex) {
        parts.issues.push(makeIssue({
            title: 'Homepage appears to be noindex',
            description: 'A noindex instruction was observed on the homepage, which can suppress visibility.',
            severity: 'high',
            priority: 'high',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_status: 'detected',
            evidence_summary: 'Meta robots noindex was observed on the homepage.',
            recommended_fix: 'Remove noindex from the homepage unless this is an intentional private environment.',
        }));
    } else {
        parts.strengths.push(makeStrength({
            title: 'Homepage is indexable',
            description: 'No homepage noindex directive was observed.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: 'No noindex signal observed.',
        }));
    }

    if (metrics.title.length < 10) {
        parts.issues.push(makeIssue({
            title: 'Homepage title is missing or too weak',
            description: 'The homepage title is missing or too short, which weakens extractable topic clarity.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: metrics.title ? `Observed title is too short: "${metrics.title}".` : 'No title tag was observed on the homepage.',
            recommended_fix: 'Add a clear homepage title that names the business and primary offer.',
        }));
    }

    if (metrics.description.length < 35) {
        parts.issues.push(makeIssue({
            title: 'Meta description is missing or too thin',
            description: 'The homepage lacks a strong meta description, reducing concise business context for crawlers and operators.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: metrics.description ? `Observed description is too short: "${metrics.description}".` : 'No meta description was observed on the homepage.',
            recommended_fix: 'Write a concise summary of the business, service, and local relevance in the meta description.',
        }));
    }

    if (!metrics.h1) {
        parts.issues.push(makeIssue({
            title: 'Homepage H1 is missing or unclear',
            description: 'The homepage does not expose a clear primary heading, which weakens page focus.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: 'No strong H1 heading was extracted from the homepage.',
            recommended_fix: 'Add a clear H1 that explains who the business helps and what it offers.',
        }));
    }

    if (!metrics.hasCanonical) {
        parts.issues.push(makeIssue({
            title: 'Canonical is not exposed on the homepage',
            description: 'The homepage canonical tag was not observed, which can weaken canonical clarity.',
            severity: 'low',
            priority: 'low',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: 'No canonical tag was observed on the homepage crawl.',
            recommended_fix: 'Add a canonical tag on the homepage and key landing pages.',
        }));
    }

    if (metrics.successCount === 0) {
        parts.issues.push(makeIssue({
            title: 'Crawl coverage is very weak',
            description: 'The audit found little or no usable HTML content, which makes downstream scoring brittle.',
            severity: 'high',
            priority: 'high',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_status: 'weak_evidence',
            evidence_summary: `${metrics.successCount}/${metrics.scannedCount} scanned pages returned usable HTML.`,
            recommended_fix: 'Check routing, blocking, and whether key pages are rendered enough for crawling.',
        }));
    } else if (metrics.successCount >= 2 && metrics.crawlSuccessRate >= 0.5) {
        parts.strengths.push(makeStrength({
            title: 'Crawl reached multiple pages',
            description: 'The audit extracted usable HTML from several pages.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_summary: `${metrics.successCount}/${metrics.scannedCount} pages returned usable HTML.`,
        }));
    }

    if (metrics.hasHydrationRisk) {
        parts.issues.push(makeIssue({
            title: 'Crawl is seeing thin rendered content',
            description: 'Some pages look heavily hydrated or app-shell-like, so extracted content may under-represent the real page.',
            category: 'technical',
            dimension: 'technical_seo',
            evidence_status: 'weak_evidence',
            evidence_summary: `${metrics.appShellPages} app-shell-like page(s) observed. Hydration hints: ${summarize(metrics.hydrationHints, 3) || 'none'}.`,
            recommended_fix: 'Expose key business copy, headings, and FAQ/service content in rendered HTML where possible.',
        }));
    }

    if (!metrics.phones.length && !metrics.emails.length) {
        parts.issues.push(makeIssue({
            title: 'Public contact information is weak',
            description: 'The crawl did not observe a public phone or email, which weakens recommendation confidence and lead capture.',
            severity: parts.publicContactApplicability === 'high' ? 'high' : 'medium',
            priority: parts.publicContactApplicability === 'high' ? 'high' : 'medium',
            category: 'geo',
            dimension: 'local_readiness',
            evidence_summary: 'No public phone or email was observed in links or visible text.',
            recommended_fix: 'Expose a public phone number and email on the site and in structured data.',
        }));
    } else if (metrics.phones.length && metrics.emails.length) {
        parts.strengths.push(makeStrength({
            title: 'Public contact data is visible',
            description: 'Both phone and email were observed on the site.',
            category: 'geo',
            dimension: 'local_readiness',
            evidence_summary: summarize([...metrics.phones, ...metrics.emails], 3),
        }));
    }

    if (!metrics.hasLocalBusinessSchema && parts.localApplicability !== 'low') {
        parts.issues.push(makeIssue({
            title: 'Local schema is missing for a locally relevant site',
            description: 'The crawl did not observe LocalBusiness-style schema even though the detected site type has local recommendation relevance.',
            severity: parts.localApplicability === 'high' ? 'high' : 'medium',
            priority: parts.localApplicability === 'high' ? 'high' : 'medium',
            category: 'geo',
            dimension: 'local_readiness',
            evidence_summary: 'No LocalBusiness-style schema was observed in JSON-LD.',
            recommended_fix: 'Add schema that exposes the business type, public contact details, and local footprint.',
        }));
    } else if (metrics.hasLocalBusinessSchema) {
        parts.strengths.push(makeStrength({
            title: 'Local schema is present',
            description: 'Structured local business data was observed.',
            category: 'geo',
            dimension: 'local_readiness',
            evidence_summary: 'Observed LocalBusiness-style JSON-LD.',
        }));
    }

    if (metrics.localEvidence.length < 2 && parts.serviceAreaApplicability !== 'low') {
        parts.issues.push(makeIssue({
            title: 'Local service footprint is weak',
            description: 'The site does not clearly expose the cities, regions, address, or service area that support local recommendation use cases.',
            severity: parts.serviceAreaApplicability === 'high' ? 'high' : 'medium',
            priority: parts.serviceAreaApplicability === 'high' ? 'high' : 'medium',
            category: 'geo',
            dimension: 'local_readiness',
            evidence_summary: 'Very little city, region, address, or area-served evidence was observed.',
            recommended_fix: 'Add service-area copy, address or coverage details, and supporting local landing content where relevant.',
        }));
    } else if (metrics.localEvidence.length >= 5) {
        parts.strengths.push(makeStrength({
            title: 'Local footprint is described',
            description: 'The crawl observed useful address or service-area evidence.',
            category: 'geo',
            dimension: 'local_readiness',
            evidence_summary: summarize(metrics.localEvidence, 5),
        }));
    }

    if (metrics.totalWordCount < 400) {
        parts.issues.push(makeIssue({
            title: 'Visible text is too thin for reliable answer extraction',
            description: 'The crawl extracted very little visible text, which reduces confidence in AI-oriented comprehension and Q&A coverage.',
            severity: 'high',
            priority: 'high',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_status: 'weak_evidence',
            evidence_summary: `${metrics.totalWordCount} visible words were extracted across ${metrics.successCount} successful page(s).`,
            recommended_fix: 'Expose more explanatory text about the business, services, differentiators, and common questions in rendered HTML.',
        }));
    } else if (metrics.totalWordCount >= 1400) {
        parts.strengths.push(makeStrength({
            title: 'The site exposes enough visible copy',
            description: 'The crawl extracted a meaningful body of text for downstream understanding.',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_summary: `${metrics.totalWordCount} visible words were extracted.`,
        }));
    }

    if (metrics.serviceEvidence.length < 2 && metrics.servicePageCount === 0) {
        parts.issues.push(makeIssue({
            title: 'Offer clarity is weak',
            description: 'The crawl found too little structured evidence about the primary services, offer, or product value.',
            severity: 'high',
            priority: 'high',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_summary: 'Service and offer signals were sparse across the scanned pages.',
            recommended_fix: 'Clarify the main services, use cases, or product capabilities with dedicated headings and body copy.',
        }));
    } else if (metrics.serviceEvidence.length >= 5 || metrics.servicePageCount > 0) {
        parts.strengths.push(makeStrength({
            title: 'Offer clarity is visible',
            description: 'The crawl found clear service or offer evidence.',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_summary: summarize(metrics.serviceEvidence, 6),
        }));
    }

    if (!metrics.hasFaq) {
        parts.issues.push(makeIssue({
            title: 'No clear FAQ or answer blocks were observed',
            description: 'The site lacks explicit FAQ or Q&A content, which reduces direct-answer readiness for AI surfaces.',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_summary: 'No FAQ schema or visible FAQ/QA pair was observed.',
            recommended_fix: 'Add FAQ or question-led content that answers the most common buyer and local-intent questions.',
        }));
    } else if (metrics.faqCount >= 3 || metrics.hasFaqSchema) {
        parts.strengths.push(makeStrength({
            title: 'FAQ support is present',
            description: 'FAQ or question-led content was observed.',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_summary: metrics.faqCount > 0 ? `${metrics.faqCount} FAQ/QA pair(s) extracted.` : 'FAQ schema was observed.',
        }));
    }

    if (metrics.citabilityBlockCount === 0) {
        parts.issues.push(makeIssue({
            title: 'No citation-ready content blocks were extracted',
            description: 'The crawl did not find enough heading-bound, self-contained content blocks to support reliable AI citation extraction.',
            severity: 'medium',
            priority: 'medium',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_status: 'weak_evidence',
            evidence_summary: 'No eligible content blocks were scored for citability across the scanned pages.',
            recommended_fix: 'Add short, self-contained paragraphs under clear headings that state services, locations, proof points, and direct answers.',
        }));
    } else if (metrics.averageCitabilityScore < 40 && metrics.highCitabilityBlockCount === 0) {
        parts.issues.push(makeIssue({
            title: 'Extractable citation blocks are weak',
            description: 'The site exposes content, but the extracted blocks are not yet specific and self-contained enough for strong AI citation use cases.',
            severity: 'medium',
            priority: 'medium',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_status: 'weak_evidence',
            evidence_summary: `${metrics.citabilityBlockCount} scored block(s) across ${metrics.citabilityPageCount} page(s); average citability ${metrics.averageCitabilityScore}/100.`,
            recommended_fix: 'Rewrite key sections into tighter factual paragraphs with explicit subjects, services, locations, and proof points.',
        }));
    } else if (metrics.averageCitabilityScore >= 60 && metrics.highCitabilityBlockCount >= 3) {
        parts.strengths.push(makeStrength({
            title: 'Citation-ready blocks are present',
            description: 'The crawl found several self-contained content blocks that are usable for AI citation and answer extraction.',
            category: 'content',
            dimension: 'ai_answerability',
            evidence_summary: `${metrics.highCitabilityBlockCount} high-citability block(s) observed across ${metrics.citabilityPageCount} page(s).`,
        }));
    }

    const crawlerAccessData = truthContext.crawlerAccessData || null;
    if (crawlerAccessData && !crawlerAccessData.fetchError) {
        if (crawlerAccessData.blockedCriticalCount > 0) {
            parts.issues.push(makeIssue({
                title: 'Critical AI crawlers are blocked',
                description: `${crawlerAccessData.blockedCriticalCount} critical AI crawler(s) are blocked via robots.txt, which prevents inclusion in AI-generated answers.`,
                severity: crawlerAccessData.blockedCriticalCount >= 3 ? 'high' : 'medium',
                priority: crawlerAccessData.blockedCriticalCount >= 3 ? 'high' : 'medium',
                category: 'content',
                dimension: 'ai_answerability',
                evidence_summary: `Blocked: ${crawlerAccessData.blockedCriticalNames.join(', ')}.`,
                recommended_fix: 'Review robots.txt directives for GPTBot, ClaudeBot, PerplexityBot, and other AI crawlers. Allow them unless there is a strong reason to block.',
            }));
        } else {
            parts.strengths.push(makeStrength({
                title: 'AI crawlers can access the site',
                description: 'No critical AI crawlers are blocked via robots.txt.',
                category: 'content',
                dimension: 'ai_answerability',
                evidence_summary: crawlerAccessData.robotsTxtFound ? 'robots.txt is present and allows major AI crawlers.' : 'No robots.txt found, AI crawlers are not explicitly blocked.',
            }));
        }

        if (!crawlerAccessData.llmsTxt.found) {
            parts.issues.push(makeIssue({
                title: 'No llms.txt file found',
                description: 'The site does not expose an llms.txt file, which is an emerging standard for providing structured context to AI systems.',
                severity: 'low',
                priority: 'low',
                category: 'content',
                dimension: 'ai_answerability',
                evidence_summary: 'No /llms.txt file was found at the domain root.',
                recommended_fix: 'Consider adding an llms.txt file that describes the business, services, and key content for AI consumption.',
            }));
        } else if (crawlerAccessData.llmsTxt.validation.valid) {
            parts.strengths.push(makeStrength({
                title: 'llms.txt is present and valid',
                description: `The site exposes an llms.txt file (${crawlerAccessData.llmsTxt.validation.reason}).`,
                category: 'content',
                dimension: 'ai_answerability',
                evidence_summary: crawlerAccessData.llmsTxt.hasFullVersion ? 'llms.txt and llms-full.txt are both present.' : 'llms.txt is present at the domain root.',
            }));
        }
    }

    if (!metrics.trustEvidence.length) {
        parts.issues.push(makeIssue({
            title: 'Trust evidence is weak',
            description: 'The crawl found little visible proof, review, guarantee, or expertise language.',
            category: 'trust',
            dimension: 'trust_signals',
            evidence_summary: 'No strong trust or review language was observed in visible copy.',
            recommended_fix: 'Add testimonials, guarantees, years of experience, certifications, or review references.',
        }));
    } else if (metrics.trustEvidence.length >= 4) {
        parts.strengths.push(makeStrength({
            title: 'Trust language is visible',
            description: 'The site exposes multiple proof or review cues.',
            category: 'trust',
            dimension: 'trust_signals',
            evidence_summary: summarize(metrics.trustEvidence, 6),
        }));
    }

    if (!metrics.socialLinks.length) {
        parts.issues.push(makeIssue({
            title: 'Public trust surfaces are thin',
            description: 'No public social profile links were observed, which can reduce visible trust reinforcement.',
            severity: 'low',
            priority: 'low',
            category: 'trust',
            dimension: 'trust_signals',
            evidence_summary: 'No public social profile links were observed during the crawl.',
            recommended_fix: 'Expose relevant social or trust profiles where they reinforce the business identity.',
        }));
    } else {
        parts.strengths.push(makeStrength({
            title: 'Public social profiles are linked',
            description: 'The crawl observed public social profile links.',
            category: 'trust',
            dimension: 'trust_signals',
            evidence_summary: summarize(metrics.socialLinks, 3),
        }));
    }

    if (!metrics.businessNames.length) {
        parts.issues.push(makeIssue({
            title: 'Business identity is not clearly named',
            description: 'The crawl did not extract a clear business name with confidence.',
            severity: 'high',
            priority: 'high',
            category: 'seo',
            dimension: 'identity_completeness',
            evidence_summary: 'No clear business name cluster was extracted from schema, headings, or page chrome.',
            recommended_fix: 'Expose the business name consistently in schema, headings, and primary site navigation.',
        }));
    } else {
        parts.strengths.push(makeStrength({
            title: 'Business name is visible',
            description: 'The audit extracted a clear business identity signal.',
            category: 'seo',
            dimension: 'identity_completeness',
            evidence_summary: summarize(metrics.businessNames, 3),
        }));
    }

    if (!metrics.phones.length || !metrics.emails.length) {
        parts.issues.push(makeIssue({
            title: metrics.phones.length || metrics.emails.length ? 'Contact information is only partially exposed' : 'Public contact information is missing',
            description: metrics.phones.length || metrics.emails.length ? 'Only one contact channel was clearly observed, which weakens completeness and operational trust.' : 'Neither a public phone number nor a public email was observed on the site.',
            severity: metrics.phones.length || metrics.emails.length ? 'medium' : 'high',
            priority: metrics.phones.length || metrics.emails.length ? 'medium' : 'high',
            category: 'seo',
            dimension: 'identity_completeness',
            evidence_status: metrics.phones.length || metrics.emails.length ? 'weak_evidence' : 'not_found',
            evidence_summary: summarize([...metrics.phones, ...metrics.emails], 3) || 'No public phone or email was observed.',
            recommended_fix: 'Expose both phone and email publicly and keep them consistent with structured data and profile records.',
        }));
    } else {
        parts.strengths.push(makeStrength({
            title: 'Phone and email are both visible',
            description: 'Both primary contact channels were observed.',
            category: 'seo',
            dimension: 'identity_completeness',
            evidence_summary: summarize([...metrics.phones, ...metrics.emails], 3),
        }));
    }

    return automation_data;
}
