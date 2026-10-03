import {
    applicabilityMultiplier,
    clamp,
    summarize,
} from './score-meta.js';

export function makeIndicator({ key, label, max, score, applicability = 'high', evidence = '', status = 'detected' }) {
    const effectiveMax = max * applicabilityMultiplier(applicability);
    return {
        key,
        label,
        score: clamp(score, 0, effectiveMax),
        max_score: effectiveMax,
        applicability,
        evidence,
        status,
    };
}

export function buildDimensionParts({ metrics, siteClassification, scanUrlEvidence, crawlerAccessData = null }) {
    const issues = [];
    const strengths = [];
    const localApplicability = siteClassification.applicability.local_schema;
    const serviceAreaApplicability = siteClassification.applicability.service_area;
    const publicContactApplicability = siteClassification.applicability.public_contact;

    const technical = [
        makeIndicator({ key: 'https', label: 'HTTPS', max: 18, score: metrics.hasHttps ? 18 : 0, evidence: scanUrlEvidence, status: metrics.hasHttps ? 'detected' : 'not_found' }),
        makeIndicator({ key: 'title', label: 'Homepage title', max: 16, score: metrics.title.length >= 16 ? 16 : metrics.title.length >= 10 ? 8 : 0, evidence: metrics.title || 'No strong title observed.', status: metrics.title.length >= 16 ? 'detected' : metrics.title ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'description', label: 'Meta description', max: 12, score: metrics.description.length >= 70 ? 12 : metrics.description.length >= 35 ? 6 : 0, evidence: metrics.description || 'No meta description observed.', status: metrics.description.length >= 70 ? 'detected' : metrics.description ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'h1', label: 'Homepage H1', max: 12, score: metrics.h1.length >= 8 ? 12 : 0, evidence: metrics.h1 || 'No clear homepage H1 observed.', status: metrics.h1.length >= 8 ? 'detected' : 'not_found' }),
        makeIndicator({ key: 'canonical', label: 'Canonical', max: 10, score: metrics.hasCanonical ? 10 : 0, evidence: metrics.hasCanonical ? summarize(metrics.extracted.canonicals, 2) : 'No canonical observed.', status: metrics.hasCanonical ? 'detected' : 'not_found' }),
        makeIndicator({ key: 'indexability', label: 'Indexability', max: 14, score: metrics.hasNoindex ? 0 : 14, evidence: metrics.hasNoindex ? 'Noindex observed.' : 'No noindex observed.', status: metrics.hasNoindex ? 'not_found' : 'detected' }),
        makeIndicator({ key: 'crawl', label: 'Crawl coverage', max: 10, score: metrics.successCount >= 2 && metrics.crawlSuccessRate >= 0.5 ? 10 : metrics.successCount > 0 ? 5 : 0, evidence: `${metrics.successCount}/${metrics.scannedCount} pages returned usable HTML.`, status: metrics.successCount >= 2 && metrics.crawlSuccessRate >= 0.5 ? 'detected' : metrics.successCount > 0 ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'rendered_content', label: 'Rendered content', max: 8, score: metrics.hasHydrationRisk ? 2 : metrics.totalWordCount >= 700 ? 8 : metrics.totalWordCount >= 350 ? 5 : 0, evidence: metrics.hasHydrationRisk ? `${metrics.appShellPages} app-shell-like page(s) observed: JavaScript rendering may be required.` : `${metrics.totalWordCount} visible words extracted.`, status: metrics.hasHydrationRisk ? 'weak_evidence' : metrics.totalWordCount >= 350 ? 'detected' : metrics.totalWordCount > 0 ? 'weak_evidence' : 'not_found' }),
    ];

    const local = [
        makeIndicator({ key: 'local_schema', label: 'Local schema', max: 24, applicability: localApplicability, score: metrics.hasLocalBusinessSchema ? 24 * applicabilityMultiplier(localApplicability) : 0, evidence: metrics.hasLocalBusinessSchema ? 'LocalBusiness-style schema observed.' : 'No local schema observed.', status: metrics.hasLocalBusinessSchema ? 'detected' : localApplicability === 'low' ? 'not_applicable' : 'not_found' }),
        makeIndicator({ key: 'local_footprint', label: 'Local footprint', max: 40, applicability: serviceAreaApplicability, score: metrics.localEvidence.length >= 5 ? 40 * applicabilityMultiplier(serviceAreaApplicability) : metrics.localEvidence.length >= 2 ? 24 * applicabilityMultiplier(serviceAreaApplicability) : 0, evidence: summarize(metrics.localEvidence, 5) || 'No strong local footprint observed.', status: metrics.localEvidence.length >= 5 ? 'detected' : metrics.localEvidence.length >= 2 ? 'weak_evidence' : serviceAreaApplicability === 'low' ? 'not_applicable' : 'not_found' }),
        makeIndicator({ key: 'supporting_pages', label: 'Local support pages', max: 16, applicability: serviceAreaApplicability, score: metrics.localPageCount > 0 ? 16 * applicabilityMultiplier(serviceAreaApplicability) : metrics.servicePageCount > 0 ? 8 * applicabilityMultiplier(serviceAreaApplicability) : 0, evidence: metrics.localPageCount > 0 ? `${metrics.localPageCount} local page(s) observed.` : metrics.servicePageCount > 0 ? `${metrics.servicePageCount} service page(s) observed, but no local page.` : 'No local support page observed.', status: metrics.localPageCount > 0 ? 'detected' : metrics.servicePageCount > 0 ? 'weak_evidence' : serviceAreaApplicability === 'low' ? 'not_applicable' : 'not_found' }),
        makeIndicator({ key: 'identity_local_context', label: 'Identity plus location', max: 20, applicability: serviceAreaApplicability, score: metrics.businessNames.length && metrics.localEvidence.length ? 20 * applicabilityMultiplier(serviceAreaApplicability) : metrics.businessNames.length ? 8 * applicabilityMultiplier(serviceAreaApplicability) : 0, evidence: summarize([...metrics.businessNames, ...metrics.localEvidence], 4) || 'No business-name/local-context cluster observed.', status: metrics.businessNames.length && metrics.localEvidence.length ? 'detected' : serviceAreaApplicability === 'low' ? 'not_applicable' : metrics.businessNames.length ? 'weak_evidence' : 'not_found' }),
    ];

    const answerability = [
        makeIndicator({ key: 'content_richness', label: 'Visible text richness', max: 22, score: metrics.totalWordCount >= 1400 ? 22 : metrics.totalWordCount >= 800 ? 16 : metrics.totalWordCount >= 400 ? 10 : 4, evidence: `${metrics.totalWordCount} visible words extracted.`, status: metrics.totalWordCount >= 800 ? 'detected' : 'weak_evidence' }),
        makeIndicator({ key: 'service_clarity', label: 'Service and offer clarity', max: 26, score: metrics.serviceEvidence.length >= 5 || metrics.servicePageCount > 0 ? 26 : metrics.serviceEvidence.length >= 2 ? 16 : 6, evidence: summarize(metrics.serviceEvidence, 6) || 'Little service or offer language observed.', status: metrics.serviceEvidence.length >= 5 || metrics.servicePageCount > 0 ? 'detected' : metrics.serviceEvidence.length >= 2 ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'faq_support', label: 'FAQ and direct answers', max: 20, score: metrics.faqCount >= 3 || metrics.hasFaqSchema ? 20 : metrics.hasFaq ? 12 : 0, evidence: metrics.faqCount > 0 ? `${metrics.faqCount} FAQ pair(s) extracted.` : metrics.hasFaqSchema ? 'FAQ schema observed.' : 'No FAQ-like content observed.', status: metrics.faqCount >= 3 || metrics.hasFaqSchema ? 'detected' : metrics.hasFaq ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'structure', label: 'Heading structure', max: 12, score: metrics.h2Rich ? 12 : metrics.h1.length >= 8 ? 6 : 0, evidence: metrics.h2Rich ? 'At least one strong H2 cluster observed.' : metrics.h1 || 'Very little heading structure observed.', status: metrics.h2Rich ? 'detected' : metrics.h1.length >= 8 ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'extractable_identity', label: 'Extractable identity cues', max: 20, score: metrics.businessNames.length && metrics.schemaEntities.length ? 20 : metrics.businessNames.length || metrics.schemaEntities.length ? 11 : 0, evidence: summarize(metrics.businessNames, 2) || (metrics.schemaEntities.length ? `${metrics.schemaEntities.length} schema entities observed.` : 'Few identity cues observed.'), status: metrics.businessNames.length && metrics.schemaEntities.length ? 'detected' : metrics.businessNames.length || metrics.schemaEntities.length ? 'weak_evidence' : 'not_found' }),
        makeIndicator({
            key: 'citability_blocks',
            label: 'Citation-ready content blocks',
            max: 16,
            score: metrics.citabilityBlockCount > 0 ? Math.round(metrics.averageCitabilityScore * 16 / 100) : 0,
            evidence: metrics.citabilityBlockCount > 0
                ? `${metrics.citabilityBlockCount} scored block(s) across ${metrics.citabilityPageCount} page(s); average citability ${metrics.averageCitabilityScore}/100.${metrics.citabilityHighlights.length ? ` Top blocks: ${summarize(metrics.citabilityHighlights, 2)}.` : ''}`
                : 'No heading-bound content blocks were scored for citability.',
            status: metrics.highCitabilityBlockCount >= 3 ? 'detected' : metrics.citabilityBlockCount > 0 ? 'weak_evidence' : 'not_found',
        }),
    ];

    if (crawlerAccessData && !crawlerAccessData.fetchError) {
        const crawlerScore = Math.round(crawlerAccessData.crawlerAccessScore * 15 / 100);
        answerability.push(makeIndicator({
            key: 'ai_crawler_access',
            label: 'AI crawler access',
            max: 15,
            score: crawlerScore,
            evidence: crawlerAccessData.blockedCriticalCount > 0
                ? `${crawlerAccessData.blockedCriticalCount} critical AI crawler(s) blocked: ${crawlerAccessData.blockedCriticalNames.join(', ')}.`
                : crawlerAccessData.robotsTxtFound
                    ? 'AI crawlers are allowed via robots.txt.'
                    : 'No robots.txt found, AI crawlers are not explicitly blocked.',
            status: crawlerAccessData.blockedCriticalCount === 0 ? 'detected' : crawlerAccessData.blockedCriticalCount <= 2 ? 'weak_evidence' : 'not_found',
        }));

        const llmsScore = Math.round(crawlerAccessData.llmsTxtScore * 10 / 100);
        answerability.push(makeIndicator({
            key: 'llms_txt_presence',
            label: 'llms.txt presence',
            max: 10,
            score: llmsScore,
            evidence: crawlerAccessData.llmsTxt.found
                ? `llms.txt found (${crawlerAccessData.llmsTxt.validation.reason}).${crawlerAccessData.llmsTxt.hasFullVersion ? ' llms-full.txt also present.' : ''}`
                : 'No llms.txt file was found at the domain root.',
            status: crawlerAccessData.llmsTxt.found && crawlerAccessData.llmsTxt.validation.valid ? 'detected' : crawlerAccessData.llmsTxt.found ? 'weak_evidence' : 'not_found',
        }));
    }

    const trust = [
        makeIndicator({ key: 'proof_terms', label: 'Proof and review language', max: 38, score: metrics.trustEvidence.length >= 4 ? 38 : metrics.trustEvidence.length >= 2 ? 24 : metrics.trustEvidence.length >= 1 ? 14 : 0, evidence: summarize(metrics.trustEvidence, 6) || 'No strong trust language observed.', status: metrics.trustEvidence.length >= 4 ? 'detected' : metrics.trustEvidence.length ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'social_presence', label: 'Public social presence', max: 14, score: metrics.socialLinks.length >= 3 ? 14 : metrics.socialLinks.length >= 1 ? 8 : 0, evidence: summarize(metrics.socialLinks, 3) || 'No social profiles observed.', status: metrics.socialLinks.length ? 'detected' : 'not_found' }),
        makeIndicator({ key: 'support_pages', label: 'About and contact pages', max: 24, score: metrics.aboutPageCount && metrics.contactPageCount ? 24 : metrics.aboutPageCount || metrics.contactPageCount ? 14 : 0, evidence: `${metrics.aboutPageCount} about page(s), ${metrics.contactPageCount} contact page(s).`, status: metrics.aboutPageCount && metrics.contactPageCount ? 'detected' : metrics.aboutPageCount || metrics.contactPageCount ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'structured_identity', label: 'Structured identity support', max: 24, score: metrics.schemaEntities.length >= 2 ? 24 : metrics.schemaEntities.length >= 1 || metrics.hasLocalBusinessSchema ? 14 : 0, evidence: metrics.schemaEntities.length ? `${metrics.schemaEntities.length} structured entity record(s) observed.` : 'No structured identity record observed.', status: metrics.schemaEntities.length || metrics.hasLocalBusinessSchema ? 'detected' : 'not_found' }),
    ];

    const identity = [
        makeIndicator({ key: 'business_name', label: 'Business name visibility', max: 28, score: metrics.businessNames.length ? 28 : 0, evidence: summarize(metrics.businessNames, 3) || 'No clear business name cluster observed.', status: metrics.businessNames.length ? 'detected' : 'not_found' }),
        makeIndicator({ key: 'contactability', label: 'Phone and email completeness', max: 34, applicability: publicContactApplicability, score: metrics.phones.length && metrics.emails.length ? 34 * applicabilityMultiplier(publicContactApplicability) : metrics.phones.length || metrics.emails.length ? 18 * applicabilityMultiplier(publicContactApplicability) : 0, evidence: summarize([...metrics.phones, ...metrics.emails], 3) || 'No phone or email observed.', status: metrics.phones.length && metrics.emails.length ? 'detected' : metrics.phones.length || metrics.emails.length ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'business_context', label: 'Business context and services', max: 22, score: metrics.serviceSignals.services?.length >= 3 ? 22 : metrics.serviceSignals.services?.length || metrics.servicePageCount ? 14 : 0, evidence: summarize(metrics.serviceSignals.services || metrics.serviceEvidence, 5) || 'Limited service detail observed.', status: metrics.serviceSignals.services?.length >= 3 ? 'detected' : metrics.serviceSignals.services?.length || metrics.servicePageCount ? 'weak_evidence' : 'not_found' }),
        makeIndicator({ key: 'support_surfaces', label: 'Support identity surfaces', max: 16, score: metrics.contactPageCount && metrics.aboutPageCount ? 16 : metrics.contactPageCount || metrics.aboutPageCount || metrics.socialLinks.length ? 9 : 0, evidence: summarize([metrics.contactPageCount ? `${metrics.contactPageCount} contact page(s)` : '', metrics.aboutPageCount ? `${metrics.aboutPageCount} about page(s)` : '', metrics.socialLinks.length ? `${metrics.socialLinks.length} social link(s)` : ''], 3) || 'Few support identity surfaces observed.', status: metrics.contactPageCount && metrics.aboutPageCount ? 'detected' : metrics.contactPageCount || metrics.aboutPageCount || metrics.socialLinks.length ? 'weak_evidence' : 'not_found' }),
    ];

    return { technical, local, answerability, trust, identity, issues, strengths, localApplicability, serviceAreaApplicability, publicContactApplicability };
}
