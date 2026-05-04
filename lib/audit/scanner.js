import * as cheerio from 'cheerio';
import {
    appendTextChunks,
    collectContentBlocks,
    collectSchemaData,
    collectTextChunks,
    extractBusinessNames,
    extractFaqPairsFromDom,
    extractLocalSignals,
    extractPhonesAndEmails,
    extractServiceSignals,
    extractSocialLinks,
    extractTrustSignals,
    firstNonEmpty,
    inferPageType,
    mergeUnique,
    normalizeWhitespace,
    scoreLinkPriority,
    scorePageCitability,
    truncate,
    uniqueStrings,
} from './extraction-helpers.js';
import { createPlaywrightRenderer } from './playwright-renderer.js';
import { normalizeUrl, isLikelyHtmlUrl, sameOrigin } from './layer1/url-utils.js';
import { discoverSitemapUrls } from './layer1/sitemap.js';
import { runPageChecks } from './layer1/page-checks.js';
import { aggregateRawScores } from './layer1/raw-scoring.js';
import { isSitemapFirstEnabled, getCrawlSafetyCeiling } from './audit-config.js';
import { fetchPublicResource } from './url-safety.js';
import { hasBlockedNavigationScheme, inputMatchesHostname } from './url-hosts.js';

const FETCH_TIMEOUT_MS = 9000;
const STATIC_WORD_CONFIDENCE_THRESHOLD = 220;
const RENDERED_PAGE_ATTEMPT_LIMIT = 8;
const LAYER1_ENGINE_ID = 'trouvable.scanner.v1';
/* Sitemap seed cap remains bounded so a 50k-URL sitemap doesn't choke the
   priority queue. The BFS link-discovery phase still fills the rest. */
const SITEMAP_SEED_LIMIT = 200;
/* Link extraction is allowed from the first N visited pages so the BFS
   frontier has enough breadth to discover the full graph. After that,
   we stop expanding to keep the graph bounded — but we still process any
   pages already in the queue (frontier-exhaustion stop). */
const LINK_EXTRACTION_PAGE_DEPTH = 80;

const KEYWORD_PAGES = [
    'contact', 'about', 'a-propos', 'propos', 'service', 'services', 'prestation', 'solution',
    'faq', 'question', 'questions', 'zone', 'ville', 'region', 'secteur', 'pricing', 'tarif',
    'features', 'feature', 'product', 'produit', 'blog', 'article', 'guide', 'docs', 'documentation',
];

async function fetchWithTimeout(url) {
    return fetchPublicResource(url, {
        timeoutMs: FETCH_TIMEOUT_MS,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, TrouvableAuditBot/3.0)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });
}

function quickWordCountFromHtml(html = '') {
    if (!html) return 0;
    try {
        const $ = cheerio.load(html);
        const text = normalizeWhitespace($('body').text());
        if (!text) return 0;
        return text.split(/\s+/).length;
    } catch {
        return 0;
    }
}

function detectHydrationHints(html = '') {
    const hints = [];
    if (!html) return hints;
    if (html.includes('__NEXT_DATA__')) hints.push('next_data');
    if (html.includes('data-reactroot')) hints.push('react_root');
    if (html.includes('id="__nuxt"')) hints.push('nuxt_root');
    if (html.includes('id="root"')) hints.push('root_shell');
    if (html.includes('data-hydration')) hints.push('hydration_marker');
    return [...new Set(hints)];
}

function shouldAttemptRenderedPage({
    rendererAvailable,
    renderAttempts,
    pageIndex,
    pageType,
    staticWordCount,
    staticHydrationHints,
}) {
    if (!rendererAvailable) return false;
    if (renderAttempts >= RENDERED_PAGE_ATTEMPT_LIMIT) return false;
    if (pageType === 'homepage') return true;
    if (pageIndex <= 3) return true;
    if (staticHydrationHints.length > 0) return true;
    if (staticWordCount < STATIC_WORD_CONFIDENCE_THRESHOLD) return true;
    return false;
}

function createEmptyExtractedData() {
    return {
        emails: new Set(),
        phones: new Set(),
        social_links: new Set(),
        h1s: [],
        titles: [],
        descriptions: [],
        h2_clusters: [],
        canonicals: [],
        has_noindex: false,
        structured_data: [],
        has_faq_schema: false,
        has_local_business_schema: false,
        has_organization_schema: false,
        text_chunks: [],
        page_summaries: [],
        schema_entities: [],
        faq_pairs: [],
        business_names: [],
        local_signals: {
            cities: [],
            regions: [],
            area_served: [],
            address_lines: [],
            maps_links: [],
            local_terms: [],
        },
        service_signals: {
            services: [],
            keywords: [],
        },
        trust_signals: {
            proof_terms: [],
            review_terms: [],
            social_networks: [],
        },
        page_stats: {
            successful_pages: 0,
            faq_pages: 0,
            service_pages: 0,
            about_pages: 0,
            contact_pages: 0,
            total_word_count: 0,
            citability_pages: 0,
            high_citability_blocks: 0,
            low_citability_blocks: 0,
        },
        technology_signals: {
            has_next_data: false,
            hydration_hints: [],
            app_shell_pages: 0,
        },
        render_stats: {
            playwright_available: false,
            playwright_reason: null,
            audit_strategy: 'unknown',
            audit_strategy_message: null,
            rendered_pages: 0,
            static_pages: 0,
            render_fallback_pages: 0,
            render_failures: 0,
        },
        layered_v1_layer1: {
            crawl_metadata: {
                strategy: 'bfs_fallback',
                single_engine_id: LAYER1_ENGINE_ID,
                pages_budget: 0,
                pages_visited: 0,
                sitemap_sources: [],
                robots_present: false,
                started_at: null,
                completed_at: null,
                stopped_reason: null,
                fetch_attempts: 0,
                duration_ms: 0,
            },
            page_level_checks: [],
            site_level_raw_scores: null,
        },
    };
}

export async function runSiteAudit(startUrl) {
    const results = {
        source_url: startUrl,
        resolved_url: null,
        scanned_pages: [],
        extracted_data: createEmptyExtractedData(),
        error_message: null,
    };

    let baseUrlObj;
    try {
        baseUrlObj = new URL(startUrl.startsWith('http') ? startUrl : `https://${startUrl}`);
    } catch {
        results.error_message = 'URL de depart invalide.';
        return results;
    }

    const renderer = await createPlaywrightRenderer();
    results.extracted_data.render_stats.playwright_available = renderer.available === true;
    results.extracted_data.render_stats.playwright_reason = renderer.reason || null;
    if (renderer.available === true) {
        results.extracted_data.render_stats.audit_strategy = 'hybrid_render';
        results.extracted_data.render_stats.audit_strategy_message = `Browser rendering enabled (${renderer.reason || 'default'}): hybrid static + browser rendering mode.`;
    } else {
        results.extracted_data.render_stats.audit_strategy = 'static_only';
        results.extracted_data.render_stats.audit_strategy_message = renderer.reason === 'disabled_by_config'
            ? 'Playwright rendering disabled by configuration. Audit runs in static-only mode.'
            : `Playwright unavailable (${renderer.reason || 'unknown_reason'}). Audit runs in static-only mode.`;
    }

    const safety = getCrawlSafetyCeiling();
    const crawlStartedAt = Date.now();

    const layer1Block = results.extracted_data.layered_v1_layer1;
    layer1Block.crawl_metadata.started_at = new Date(crawlStartedAt).toISOString();
    layer1Block.crawl_metadata.pages_budget = safety.maxPages;

    const seedUrl = normalizeUrl(baseUrlObj.href) || baseUrlObj.href;
    const pagesToVisit = new Map([[seedUrl, 100]]);
    const visitedPages = new Set();
    const queuedUrls = new Set([seedUrl]);
    let renderAttempts = 0;
    let fetchAttempts = 0;
    let stoppedReason = 'frontier_exhausted';

    // Layer 1 sitemap-first discovery: seed queue from sitemaps when available,
    // then always fall back to BFS link discovery if budget remains. Only one
    // crawl engine runs; sitemap URLs are merely additional seeds.
    if (isSitemapFirstEnabled()) {
        try {
            const sitemapDiscovery = await discoverSitemapUrls(baseUrlObj.href);
            layer1Block.crawl_metadata.robots_present = sitemapDiscovery.robots_present;
            layer1Block.crawl_metadata.sitemap_sources = sitemapDiscovery.sitemap_sources || [];
            if (sitemapDiscovery.discovered_urls.length > 0) {
                layer1Block.crawl_metadata.strategy = sitemapDiscovery.strategy === 'robots_sitemap' ? 'sitemap_first' : 'sitemap_first';
                let seeded = 0;
                for (const url of sitemapDiscovery.discovered_urls) {
                    if (seeded >= SITEMAP_SEED_LIMIT) break;
                    if (!isLikelyHtmlUrl(url)) continue;
                    if (!sameOrigin(url, baseUrlObj.href)) continue;
                    if (queuedUrls.has(url) || visitedPages.has(url)) continue;
                    const priority = scoreLinkPriority(url, '', KEYWORD_PAGES);
                    pagesToVisit.set(url, Math.max(priority, 20));
                    queuedUrls.add(url);
                    seeded += 1;
                }
            }
        } catch (err) {
            console.warn('[AuditScanner] sitemap_discovery_failed', { error: err?.message });
        }
    }

    try {
        /* Frontier-exhaustion BFS. Three safety guards stop the loop:
           1. pages visited reaches AUDIT_MAX_PAGES (hard ceiling)
           2. total fetch attempts (visited + failed) reach the cap
           3. wall-clock duration exceeds the configured ceiling
           In normal operation, the loop exits when the frontier is empty. */
        while (pagesToVisit.size > 0) {
            if (visitedPages.size >= safety.maxPages) {
                stoppedReason = 'max_pages_ceiling';
                break;
            }
            if (fetchAttempts >= safety.maxFetchAttempts) {
                stoppedReason = 'max_fetch_attempts';
                break;
            }
            if (Date.now() - crawlStartedAt >= safety.maxDurationMs) {
                stoppedReason = 'max_duration';
                break;
            }

            const [targetUrl] = [...pagesToVisit.entries()].sort((a, b) => b[1] - a[1])[0];
            pagesToVisit.delete(targetUrl);

            if (visitedPages.has(targetUrl)) continue;
            visitedPages.add(targetUrl);
            fetchAttempts += 1;

            const pageRecord = {
                url: targetUrl,
                final_url: null,
                status_code: null,
                page_type: 'unknown',
                success: false,
                error_message: null,
                title: null,
                render_mode: 'static',
                render_error: null,
            };

            try {
                let fetchFailed = false;
                let staticHtml = '';
                let staticHydrationHints = [];
                let staticWordCount = 0;
                
                try {
                    const response = await fetchWithTimeout(targetUrl);
                    pageRecord.status_code = response.status;
                    pageRecord.final_url = response.url;

                    if (!results.resolved_url) {
                        results.resolved_url = response.url;
                        pageRecord.page_type = 'homepage';
                    }

                    if (!response.ok) {
                        pageRecord.error_message = `HTTP ${response.status}`;
                        fetchFailed = true;
                    } else {
                        const contentType = response.headers.get('content-type') || '';
                        if (!contentType.includes('text/html')) {
                            pageRecord.error_message = `Not HTML (${contentType})`;
                            results.scanned_pages.push(pageRecord);
                            continue;
                        }

                        staticHtml = await response.text();
                        staticHydrationHints = detectHydrationHints(staticHtml);
                        staticWordCount = quickWordCountFromHtml(staticHtml);
                    }
                } catch (fetchErr) {
                    pageRecord.error_message = fetchErr.message || 'Network / timeout error';
                    fetchFailed = true;
                }

                if (!results.resolved_url) {
                    results.resolved_url = targetUrl;
                    pageRecord.page_type = 'homepage';
                }

                const pageIndex = visitedPages.size;

                let finalHtml = staticHtml;
                let finalHydrationHints = [...staticHydrationHints];

                let shouldRender = false;
                
                if (fetchFailed) {
                    if (renderer.available === true && renderAttempts < 10) {
                        shouldRender = true;
                    } else {
                        results.scanned_pages.push(pageRecord);
                        continue;
                    }
                } else {
                    shouldRender = shouldAttemptRenderedPage({
                        rendererAvailable: renderer.available === true,
                        renderAttempts,
                        pageIndex,
                        pageType: pageRecord.page_type,
                        staticWordCount,
                        staticHydrationHints,
                    });
                }

                if (shouldRender) {
                    renderAttempts += 1;
                    const rendered = await renderer.render(pageRecord.final_url || targetUrl);
                    if (rendered.ok && rendered.html) {
                        const renderedWordCount = Number(rendered.visibleWordCount || 0);
                        const staticLooksThin = staticWordCount < STATIC_WORD_CONFIDENCE_THRESHOLD || staticHydrationHints.length > 0;
                        const renderImprovesCoverage = renderedWordCount >= (staticWordCount + 80);
                        const preferRendered = pageRecord.page_type === 'homepage' || staticLooksThin || renderImprovesCoverage;

                        if (preferRendered) {
                            finalHtml = rendered.html;
                            pageRecord.render_mode = 'playwright';
                            results.extracted_data.render_stats.rendered_pages += 1;
                        } else {
                            pageRecord.render_mode = 'static_preferred';
                            results.extracted_data.render_stats.static_pages += 1;
                        }

                        pageRecord.final_url = rendered.finalUrl || pageRecord.final_url;
                        if (!results.resolved_url && pageRecord.final_url) {
                            results.resolved_url = pageRecord.final_url;
                        }

                        finalHydrationHints = mergeUnique(finalHydrationHints, rendered.hydrationHints || []);
                    } else {
                        pageRecord.render_mode = 'static_fallback';
                        pageRecord.render_error = rendered.error || 'playwright_render_failed';
                        results.extracted_data.render_stats.render_fallback_pages += 1;
                        results.extracted_data.render_stats.render_failures += 1;
                        console.warn('[AuditScanner] browser_render_fallback', {
                            url: pageRecord.final_url || targetUrl,
                            error: pageRecord.render_error,
                            renderer_reason: results.extracted_data.render_stats.playwright_reason,
                        });
                    }
                } else {
                    results.extracted_data.render_stats.static_pages += 1;
                }

                const $ = cheerio.load(finalHtml);

                const title = firstNonEmpty($('title').text(), $('meta[property="og:title"]').attr('content'));
                const description = firstNonEmpty(
                    $('meta[name="description"]').attr('content'),
                    $('meta[property="og:description"]').attr('content'),
                    $('meta[name="twitter:description"]').attr('content'),
                );
                const h1 = normalizeWhitespace($('h1').first().text());
                const h2s = uniqueStrings($('h2').map((_, el) => $(el).text()).get()).slice(0, 12);
                const canonical = firstNonEmpty($('link[rel="canonical"]').attr('href'));
                const robots = firstNonEmpty($('meta[name="robots"]').attr('content')).toLowerCase();
                const bodyText = normalizeWhitespace($('body').text()).toLowerCase();

                pageRecord.title = title;
                pageRecord.success = true;
                if (pageRecord.page_type !== 'homepage') {
                    pageRecord.page_type = inferPageType(targetUrl, title, h1, bodyText);
                }

                const pageTextChunks = collectTextChunks($);
                const pageText = normalizeWhitespace(pageTextChunks.join(' '));
                const wordCount = pageText ? pageText.split(/\s+/).length : 0;
                const contentBlocks = collectContentBlocks($, pageRecord.final_url || targetUrl);
                const citability = scorePageCitability(contentBlocks);

                const schemaData = collectSchemaData($, pageRecord.final_url || targetUrl);
                const faqPairs = [...schemaData.faqPairs, ...extractFaqPairsFromDom($, pageRecord.final_url || targetUrl)];
                const contacts = extractPhonesAndEmails($);
                const socialLinks = extractSocialLinks($);
                const businessNames = extractBusinessNames($, schemaData.schemaEntities);
                const localSignals = extractLocalSignals($, bodyText, schemaData.schemaEntities, targetUrl);
                const serviceSignals = extractServiceSignals($, pageRecord.page_type, bodyText);
                const trustSignals = extractTrustSignals(bodyText, socialLinks);

                results.extracted_data.technology_signals.has_next_data ||= finalHtml.includes('__NEXT_DATA__');
                results.extracted_data.technology_signals.hydration_hints = mergeUnique(
                    results.extracted_data.technology_signals.hydration_hints,
                    finalHydrationHints
                );
                if (wordCount < 120 && finalHydrationHints.length > 0) {
                    results.extracted_data.technology_signals.app_shell_pages += 1;
                }

                if (title) results.extracted_data.titles.push(title);
                if (description) results.extracted_data.descriptions.push(description);
                if (h1) results.extracted_data.h1s.push(h1);
                if (h2s.length > 0) results.extracted_data.h2_clusters.push(h2s);
                if (canonical && pageRecord.page_type === 'homepage') results.extracted_data.canonicals.push(canonical);
                if (robots.includes('noindex') && pageRecord.page_type === 'homepage') results.extracted_data.has_noindex = true;

                results.extracted_data.structured_data.push(...schemaData.structuredData);
                results.extracted_data.schema_entities.push(...schemaData.schemaEntities);
                results.extracted_data.has_faq_schema ||= schemaData.hasFaqSchema;
                results.extracted_data.has_local_business_schema ||= schemaData.hasLocalBusinessSchema;
                results.extracted_data.has_organization_schema ||= schemaData.hasOrganizationSchema;
                results.extracted_data.faq_pairs.push(...faqPairs);
                results.extracted_data.business_names = mergeUnique(results.extracted_data.business_names, businessNames);
                results.extracted_data.text_chunks = appendTextChunks(results.extracted_data.text_chunks, pageTextChunks);

                contacts.phones.forEach((phone) => results.extracted_data.phones.add(phone));
                contacts.emails.forEach((email) => results.extracted_data.emails.add(email));
                socialLinks.forEach((link) => results.extracted_data.social_links.add(link));

                for (const entity of schemaData.schemaEntities) {
                    if (Array.isArray(entity.sameAs)) {
                        entity.sameAs.forEach((url) => {
                            if (typeof url === 'string' && ['facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com', 'tiktok.com', 'youtube.com'].some((domain) => inputMatchesHostname(url, domain))) {
                                results.extracted_data.social_links.add(url);
                            }
                        });
                    }
                }

                results.extracted_data.local_signals = {
                    cities: mergeUnique(results.extracted_data.local_signals.cities, localSignals.cities),
                    regions: mergeUnique(results.extracted_data.local_signals.regions, localSignals.regions),
                    area_served: mergeUnique(results.extracted_data.local_signals.area_served, localSignals.area_served),
                    address_lines: mergeUnique(results.extracted_data.local_signals.address_lines, localSignals.address_lines),
                    maps_links: mergeUnique(results.extracted_data.local_signals.maps_links, localSignals.maps_links),
                    local_terms: mergeUnique(results.extracted_data.local_signals.local_terms, localSignals.local_terms),
                };

                results.extracted_data.service_signals = {
                    services: mergeUnique(results.extracted_data.service_signals.services, serviceSignals.services),
                    keywords: mergeUnique(results.extracted_data.service_signals.keywords, serviceSignals.keywords),
                };

                results.extracted_data.trust_signals = {
                    proof_terms: mergeUnique(results.extracted_data.trust_signals.proof_terms, trustSignals.proof_terms),
                    review_terms: mergeUnique(results.extracted_data.trust_signals.review_terms, trustSignals.review_terms),
                    social_networks: mergeUnique(results.extracted_data.trust_signals.social_networks, trustSignals.social_networks),
                };

                results.extracted_data.page_stats.successful_pages += 1;
                results.extracted_data.page_stats.total_word_count += wordCount;
                if (pageRecord.page_type === 'faq' || faqPairs.length > 0) results.extracted_data.page_stats.faq_pages += 1;
                if (pageRecord.page_type === 'services') results.extracted_data.page_stats.service_pages += 1;
                if (pageRecord.page_type === 'about') results.extracted_data.page_stats.about_pages += 1;
                if (pageRecord.page_type === 'contact') results.extracted_data.page_stats.contact_pages += 1;
                if (citability.block_count > 0) {
                    results.extracted_data.page_stats.citability_pages += 1;
                    results.extracted_data.page_stats.high_citability_blocks += citability.high_citability_count;
                    results.extracted_data.page_stats.low_citability_blocks += citability.low_citability_count;
                }

                results.extracted_data.page_summaries.push({
                    url: pageRecord.final_url || targetUrl,
                    page_type: pageRecord.page_type,
                    title,
                    description,
                    h1,
                    word_count: wordCount,
                    faq_pairs_count: faqPairs.length,
                    local_signal_count: localSignals.cities.length + localSignals.regions.length + localSignals.area_served.length + localSignals.address_lines.length,
                    service_signal_count: serviceSignals.services.length,
                    citability: {
                        page_score: citability.page_score,
                        block_count: citability.block_count,
                        high_citability_count: citability.high_citability_count,
                        low_citability_count: citability.low_citability_count,
                        top_blocks: citability.scored_blocks
                            .slice()
                            .sort((a, b) => (b.citability_score || b.score || 0) - (a.citability_score || a.score || 0))
                            .slice(0, 3)
                            .map((block) => ({
                                block_id: block.block_id,
                                page_url: block.page_url || (pageRecord.final_url || targetUrl),
                                heading: block.heading || null,
                                heading_level: block.heading_level || null,
                                block_type: block.block_type,
                                word_count: block.word_count || 0,
                                position: block.position,
                                citability_score: block.citability_score ?? block.score ?? 0,
                                sub_scores: block.sub_scores || {},
                                text_sample: truncate(block.block_text || block.text || '', 220),
                            })),
                    },
                    text_sample: truncate(pageText, 280),
                });

                if (visitedPages.size <= LINK_EXTRACTION_PAGE_DEPTH) {
                    $('a[href]').each((_, link) => {
                        const href = $(link).attr('href');
                        if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') || hasBlockedNavigationScheme(href)) return;

                        const baseHref = pageRecord.final_url || targetUrl;
                        const normalizedHref = normalizeUrl(href, baseHref);
                        if (!normalizedHref) return;
                        if (!sameOrigin(normalizedHref, baseUrlObj.href)) return;
                        if (!isLikelyHtmlUrl(normalizedHref)) return;
                        if (visitedPages.has(normalizedHref) || queuedUrls.has(normalizedHref)) return;

                        const anchorText = normalizeWhitespace($(link).text());
                        pagesToVisit.set(normalizedHref, scoreLinkPriority(normalizedHref, anchorText, KEYWORD_PAGES));
                        queuedUrls.add(normalizedHref);
                    });
                }

                // Layer 1 deterministic page check registry
                try {
                    const pageChecks = runPageChecks({
                        $,
                        pageUrl: pageRecord.final_url || targetUrl,
                        html: finalHtml,
                        meta: {
                            title,
                            description,
                            h1s: h1 ? [h1] : [],
                            canonical,
                            hasNoindex: robots.includes('noindex'),
                            wordCount,
                            pageType: pageRecord.page_type,
                            schemaData: schemaData.schemaEntities,
                            hasFaqSchema: schemaData.hasFaqSchema,
                            hasLocalBusinessSchema: schemaData.hasLocalBusinessSchema,
                            hasOrganizationSchema: schemaData.hasOrganizationSchema,
                            hydrationHints: finalHydrationHints,
                            httpStatus: pageRecord.status_code,
                        },
                    });
                    layer1Block.page_level_checks.push({
                        page_url: pageRecord.final_url || targetUrl,
                        page_type: pageRecord.page_type,
                        render_mode: pageRecord.render_mode,
                        checks: pageChecks,
                    });
                } catch (checkErr) {
                    console.warn('[AuditScanner] page_checks_failed', { url: pageRecord.final_url || targetUrl, error: checkErr?.message });
                }

                results.scanned_pages.push(pageRecord);
            } catch (err) {
                pageRecord.error_message = err.message || 'Network / timeout error';
                results.scanned_pages.push(pageRecord);
            }
        }
    } finally {
        await renderer.close().catch(() => { });
    }

    results.extracted_data.emails = uniqueStrings([...results.extracted_data.emails]);
    results.extracted_data.phones = uniqueStrings([...results.extracted_data.phones]);
    results.extracted_data.social_links = uniqueStrings([...results.extracted_data.social_links]);
    results.extracted_data.titles = uniqueStrings(results.extracted_data.titles).slice(0, 12);
    results.extracted_data.descriptions = uniqueStrings(results.extracted_data.descriptions).slice(0, 12);
    results.extracted_data.h1s = uniqueStrings(results.extracted_data.h1s).slice(0, 12);
    results.extracted_data.canonicals = uniqueStrings(results.extracted_data.canonicals).slice(0, 4);
    results.extracted_data.faq_pairs = results.extracted_data.faq_pairs.slice(0, 16);
    results.extracted_data.business_names = uniqueStrings(results.extracted_data.business_names).slice(0, 8);
    results.extracted_data.schema_entities = results.extracted_data.schema_entities.slice(0, 20);
    results.extracted_data.structured_data = results.extracted_data.structured_data.slice(0, 20);
    /* Page summaries are kept proportional to the scanned graph; we cap at
       the safety ceiling so massive crawls don't blow up the audit document. */
    results.extracted_data.page_summaries = results.extracted_data.page_summaries.slice(0, safety.maxPages);

    layer1Block.crawl_metadata.pages_visited = results.scanned_pages.filter((page) => page.success).length;
    layer1Block.crawl_metadata.completed_at = new Date().toISOString();
    layer1Block.crawl_metadata.stopped_reason = stoppedReason;
    layer1Block.crawl_metadata.fetch_attempts = fetchAttempts;
    layer1Block.crawl_metadata.duration_ms = Date.now() - crawlStartedAt;
    layer1Block.site_level_raw_scores = aggregateRawScores(layer1Block.page_level_checks);

    return results;
}
