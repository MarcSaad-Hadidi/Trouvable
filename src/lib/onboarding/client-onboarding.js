import 'server-only';

import { normalizePortalContactEmail, syncClientProfileCompatibilityFields } from '@/lib/client-profile';
import { LIFECYCLE_DEFAULTS } from '@/lib/lifecycle';
import { getClientBySlug as dbGetClientBySlug, createClient as dbCreateClient, updateClient as dbUpdateClient, getClientById as dbGetClientById } from '@/lib/db/clients';
import { getLatestAudit as dbGetLatestAudit } from '@/lib/db/audits';
import { logAction as dbLogAction } from '@/lib/db/actions';
import { getTrackedQueriesAll as dbGetTrackedQueriesAll, createTrackedQuery as dbCreateTrackedQuery } from '@/lib/db/tracked-queries';
import { upsertClientPortalAccess } from '@/features/portal/server/access';
import { serializePromptContractForDb } from '@/lib/queries/prompt-contract-persistence';

function slugify(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeWebsiteUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    url.hash = '';
    return url.toString();
}

function uniqueStrings(values = []) {
    const seen = new Set();
    const list = [];
    for (const value of values) {
        const text = String(value || '').trim();
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        list.push(text);
    }
    return list;
}

function stringArray(values = []) {
    if (!Array.isArray(values)) return [];
    return uniqueStrings(values.map((value) => String(value || '').trim())).filter(Boolean);
}

function normalizeFaqPairs(values = []) {
    if (!Array.isArray(values)) return [];
    const output = [];
    for (const item of values) {
        const question = String(item?.question || '').trim();
        const answer = String(item?.answer || '').trim();
        if (!question || !answer) continue;
        output.push({ question, answer });
        if (output.length >= 6) break;
    }
    return output;
}

function deriveBusinessType(canonicalDetection) {
    const categoryFact = canonicalDetection?.facts?.canonical_category;
    if (!categoryFact?.value || categoryFact.value === 'unknown') return '';
    if (categoryFact.review_status !== 'auto_accepted') return '';
    return categoryFact.value;
}

function getSiteClassification(audit) {
    return (
        audit?.geo_breakdown?.site_classification
        || audit?.seo_breakdown?.site_classification
        || null
    );
}

function confidenceBand(value) {
    const numeric = Number(value || 0);
    if (numeric >= 0.75) return 'strong';
    if (numeric >= 0.5) return 'medium';
    return 'low';
}

async function ensureUniqueClientSlug(baseSlug, currentClientId = null) {
    const initial = slugify(baseSlug) || 'client';
    for (let index = 0; index < 50; index += 1) {
        const candidate = index === 0 ? initial : `${initial}-${index + 1}`;
        const existing = await dbGetClientBySlug(candidate);
        if (!existing || (currentClientId && existing.id === currentClientId)) {
            return candidate;
        }
    }
    return `${initial}-${Date.now().toString().slice(-5)}`;
}

function buildMissingItems({ emails, phones, socialLinks, classification, audit }) {
    const missing = [];
    if (!audit?.id) {
        missing.push('Initial audit did not complete yet.');
    }
    if (!classification?.type) {
        missing.push('Site classification is weak or missing.');
    }
    if (emails.length === 0) {
        missing.push('No public email was detected from crawl signals.');
    }
    if (phones.length === 0) {
        missing.push('No phone number was detected from crawl signals.');
    }
    if (socialLinks.length === 0) {
        missing.push('No social profiles were detected from crawl signals.');
    }
    return missing;
}

function buildWarnings({ auditResult, classification, businessNames }) {
    const warnings = [];
    if (auditResult && auditResult.success === false) {
        warnings.push('Initial audit failed. Suggestions below may be incomplete.');
    }
    if (!classification?.type) {
        warnings.push('Site type confidence is low; review inferred fields before activation.');
    } else if (confidenceBand(classification.confidence) === 'low') {
        warnings.push('Site type confidence is low; keep weak detections under review.');
    }
    if (businessNames.length === 0) {
        warnings.push('No strong business identity cluster was detected from site pages.');
    }
    return warnings;
}

function normalizeBusinessTypeForPromptContext(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^(localbusiness|organization|business|company|service)$/i.test(text)) return '';
    return text;
}

function buildProfileSuggestion({
    input,
    clientSlug,
    canonicalDetection,
    businessNames,
    emails,
    phones,
    socialLinks,
    summaryText,
    extracted,
}) {
    const detectedCity = stringArray([
        extracted?.local_signals?.cities?.[0],
        input.primary_region,
    ])[0] || '';

    const detectedRegion = stringArray([
        extracted?.local_signals?.regions?.[0],
    ])[0] || '';

    const detectedBusinessType = deriveBusinessType(canonicalDetection);
    const primaryEmail = emails[0] || normalizePortalContactEmail(input.primary_contact_email) || '';
    const primaryPhone = phones[0] || '';
    const services = stringArray(extracted?.service_signals?.services || []).slice(0, 8);
    const areasServed = stringArray([
        ...(extracted?.local_signals?.area_served || []),
        ...(extracted?.local_signals?.cities || []),
        ...(extracted?.local_signals?.regions || []),
        detectedCity,
        detectedRegion,
    ]).slice(0, 12);
    const description = String(summaryText || '').trim().slice(0, 260);
    const faqs = normalizeFaqPairs(extracted?.faq_pairs || []);

    return {
        client_name: businessNames[0] || input.business_name,
        client_slug: clientSlug,
        website_url: input.website_url,
        business_type: detectedBusinessType,
        target_region: input.primary_region,
        address: {
            city: detectedCity,
            region: detectedRegion,
            country: '',
        },
        contact_info: {
            public_email: primaryEmail,
            email: primaryEmail,
            phone: primaryPhone,
        },
        social_profiles: socialLinks.slice(0, 8),
        seo_description: description.slice(0, 190),
        business_details: {
            short_desc: description,
            short_description: description,
            services,
            areas_served: areasServed,
        },
        geo_faqs: faqs,
    };
}

function buildSuggestionSignals({
    input,
    classification,
    canonicalDetection,
    businessNames,
    emails,
    phones,
    socialLinks,
    missingItems,
}) {
    const categoryFact = canonicalDetection?.facts?.canonical_category;
    const modelFact = canonicalDetection?.facts?.business_model;
    
    return {
        identity: {
            value: businessNames[0] || input.business_name,
            source: businessNames.length > 0 ? 'observed' : 'inferred',
            confidence: businessNames.length > 0 ? 'medium' : 'low',
        },
        contact: {
            primary_email: emails[0] || normalizePortalContactEmail(input.primary_contact_email) || '',
            primary_phone: phones[0] || '',
            source: emails.length > 0 || phones.length > 0 ? 'observed' : 'missing',
        },
        site_type: {
            type: classification?.type || null,
            label: classification?.label || null,
            confidence: classification?.confidence ?? null,
            confidence_band: confidenceBand(classification?.confidence),
            source: classification?.type ? 'observed' : 'inferred',
        },
        resolved_category: {
            raw_schema_input: String(input.category || '').trim(),
            business_model: modelFact?.value || null,
            canonical_category: categoryFact?.value || 'unknown',
            confidence: categoryFact?.confidence || 'low',
            needs_review: categoryFact?.review_status !== 'auto_accepted',
            reason: canonicalDetection?.resolved_business?.category_resolution_reason || '',
            display_label: canonicalDetection?.resolved_business?.display_label || '',
            truth_class: categoryFact?.truth_class || 'uncertain',
            review_status: categoryFact?.review_status || 'blocked',
        },
        social: {
            count: socialLinks.length,
            source: socialLinks.length > 0 ? 'observed' : 'missing',
        },
        missing_items: missingItems,
    };
}

function compactClient(client) {
    if (!client) return null;
    return {
        id: client.id,
        client_name: client.client_name,
        client_slug: client.client_slug,
        website_url: client.website_url,
        business_type: client.business_type,
        target_region: client.target_region || '',
        is_published: client.is_published === true,
        publication_status: client.publication_status || 'draft',
    };
}

export async function startClientOnboarding(rawInput, options = {}) {
    const [{ runFullAudit }, { buildStarterPromptPack }, { buildCanonicalBusinessDetection }] = await Promise.all([
        import('@/lib/audit/run-audit'),
        import('@/lib/operator-intelligence/prompts'),
        import('@/lib/truth/detection'),
    ]);

    const input = {
        business_name: String(rawInput?.business_name || '').trim(),
        website_url: normalizeWebsiteUrl(rawInput?.website_url),
        primary_region: String(rawInput?.primary_region || '').trim(),
        category: String(rawInput?.category || '').trim(),
        primary_contact_email: normalizePortalContactEmail(rawInput?.primary_contact_email || ''),
    };

    const clientSlug = await ensureUniqueClientSlug(input.business_name);
    const client = await dbCreateClient({
        client_name: input.business_name,
        client_slug: clientSlug,
        website_url: input.website_url,
        business_type: input.category,
        target_region: input.primary_region || undefined,
        lifecycle_status: LIFECYCLE_DEFAULTS.onboarding,
    });

    await dbUpdateClient(client.id, syncClientProfileCompatibilityFields({
        publication_status: 'draft',
        is_published: false,
        target_region: input.primary_region,
        address: input.primary_region ? { city: input.primary_region } : {},
        contact_info: input.primary_contact_email
            ? { public_email: input.primary_contact_email, email: input.primary_contact_email }
            : {},
    }));

    let auditResult = null;
    try {
        auditResult = await runFullAudit(client.id, input.website_url);
    } catch (error) {
        auditResult = { success: false, error: error?.message || 'Audit execution failed' };
    }

    const latestAudit = await dbGetLatestAudit(client.id).catch(() => null);
    const extracted = latestAudit?.extracted_data || {};
    const classification = getSiteClassification(latestAudit);
    const businessNames = stringArray(extracted.business_names || []);
    const emails = uniqueStrings([
        input.primary_contact_email,
        ...stringArray(extracted.emails || []),
    ]).slice(0, 6);
    const phones = stringArray(extracted.phones || []).slice(0, 4);
    const socialLinks = stringArray(extracted.social_links || []).slice(0, 10);
    const summaryText =
        latestAudit?.geo_breakdown?.ai_analysis?.business_summary
        || latestAudit?.seo_breakdown?.ai_analysis?.business_summary
        || stringArray(extracted.descriptions || [])[0]
        || '';
    const canonicalDetection = buildCanonicalBusinessDetection({
        clientName: businessNames[0] || input.business_name,
        rawBusinessType: input.category,
        siteClassification: classification || { type: 'generic_business' },
        servicesPreview: extracted?.service_signals?.services || [],
        shortDescription: summaryText,
        seoTeaser: summaryText,
        address: { city: input.primary_region, region: input.primary_region },
        targetRegion: input.primary_region,
        localSignals: extracted?.local_signals || {},
        pageSummaries: extracted?.page_summaries || [],
    });

    const profileSuggestion = buildProfileSuggestion({
        input,
        clientSlug,
        canonicalDetection,
        businessNames,
        emails,
        phones,
        socialLinks,
        summaryText,
        extracted,
    });

    const promptContextClient = {
        client_name: profileSuggestion.client_name || input.business_name,
        business_type: normalizeBusinessTypeForPromptContext(profileSuggestion.business_type) || normalizeBusinessTypeForPromptContext(input.category),
        address: profileSuggestion.address || { city: input.primary_region },
        target_region: profileSuggestion.target_region || input.primary_region,
        business_details: profileSuggestion.business_details || {},
        seo_description: profileSuggestion.seo_description || '',
    };

    const starterPack = buildStarterPromptPack({
        client: promptContextClient,
        siteType: classification?.type || 'generic_business',
        siteClassification: {
            ...(classification || {}),
            services_preview: profileSuggestion.business_details?.services || [],
            short_description_preview: profileSuggestion.business_details?.short_desc || '',
            seo_teaser: profileSuggestion.seo_description || '',
        },
        locale: 'fr-CA',
        existingPrompts: [],
    });

    await dbUpdateClient(client.id, syncClientProfileCompatibilityFields({
        ...profileSuggestion,
        publication_status: 'draft',
        is_published: false,
    }));

    const missingItems = buildMissingItems({
        emails,
        phones,
        socialLinks,
        classification,
        audit: latestAudit,
    });

    const warnings = buildWarnings({
        auditResult,
        classification,
        businessNames,
    });

    const portalDraft = input.primary_contact_email
        ? {
            enabled: true,
            contact_email: input.primary_contact_email,
            portal_role: 'viewer',
            member_type: 'client_contact',
            source: 'operator_input',
        }
        : {
            enabled: false,
            contact_email: '',
            portal_role: 'viewer',
            member_type: 'client_contact',
            source: 'missing_email',
        };

    await dbLogAction({
        client_id: client.id,
        action_type: 'client_onboarding_started',
        details: {
            via: 'onboarding_wizard',
            audit_success: auditResult?.success === true,
            prompt_suggestions: starterPack.prompts.length,
        },
        performed_by: options.performedBy || null,
    });

    const latestClient = await dbGetClientById(client.id);
    return {
        client: compactClient(latestClient),
        input,
        audit: {
            id: latestAudit?.id || auditResult?.auditId || null,
            status: latestAudit?.scan_status || (auditResult?.success ? 'success' : 'failed'),
            seo_score: latestAudit?.seo_score ?? null,
            geo_score: latestAudit?.geo_score ?? null,
            summary: summaryText || null,
            error: auditResult?.success === false ? auditResult?.error || null : null,
        },
        classification: classification
            ? {
                type: classification.type || null,
                label: classification.label || null,
                confidence: classification.confidence ?? null,
                confidence_band: confidenceBand(classification.confidence),
                reasons: Array.isArray(classification.reasons) ? classification.reasons.slice(0, 6) : [],
            }
            : null,
        detected: {
            business_names: businessNames,
            emails,
            phones,
            social_links: socialLinks,
            cities: stringArray(extracted?.local_signals?.cities || []).slice(0, 6),
            regions: stringArray(extracted?.local_signals?.regions || []).slice(0, 6),
            services: stringArray(extracted?.service_signals?.services || []).slice(0, 8),
        },
        suggestionSignals: buildSuggestionSignals({
            input,
            classification,
            canonicalDetection,
            businessNames,
            emails,
            phones,
            socialLinks,
            missingItems,
        }),
        canonicalDetection,
        profileSuggestion,
        trackedPromptSuggestions: starterPack.prompts.map((prompt) => ({
            ...prompt,
            validation: prompt.validation || {
                status: prompt.quality_status || 'review',
                is_valid: prompt.quality_status !== 'weak',
                reasons: Array.isArray(prompt.quality_reasons) ? prompt.quality_reasons : [],
            },
            is_valid: prompt.validation?.is_valid ?? (prompt.quality_status !== 'weak'),
            is_selected: prompt.is_selected_default ?? (prompt.quality_status === 'strong'),
        })),
        portalDraft,
        missingItems,
        warnings,
    };
}

function normalizePromptSuggestions(values = []) {
    const output = [];
    for (const value of values || []) {
        const queryText = String(value?.query_text || '').trim();
        if (!queryText) continue;
        if (value?.is_valid === false) continue;
        output.push({
            query_text: queryText,
            category: String(value?.category || value?.query_type || 'discovery').trim() || 'discovery',
            locale: String(value?.locale || 'fr-CA').trim() || 'fr-CA',
            is_active: value?.is_active !== false,
            prompt_mode: value?.prompt_mode === 'operator_probe' ? 'operator_probe' : 'user_like',
            intent_family: String(value?.intent_family || '').trim() || null,
            quality_status: String(value?.quality_status || '').trim() || null,
            quality_score: Number.isFinite(Number(value?.quality_score)) ? Number(value.quality_score) : null,
            quality_reasons: Array.isArray(value?.quality_reasons) ? value.quality_reasons : [],
            validation_status: String(value?.validation?.status || value?.validation_status || '').trim() || null,
            validation_reasons: Array.isArray(value?.validation?.reasons)
                ? value.validation.reasons
                : (Array.isArray(value?.validation_reasons) ? value.validation_reasons : []),
            offer_anchor: value?.offer_anchor || null,
            user_visible_offering: value?.user_visible_offering || null,
            target_audience: value?.target_audience || null,
            primary_use_case: value?.primary_use_case || null,
            differentiation_angle: value?.differentiation_angle || null,
            prompt_metadata: {
                offer_label_normalized: value?.offer_label_normalized || null,
            },
        });
    }
    return output;
}

export async function activateClientOnboarding(rawInput, options = {}) {
    const clientId = String(rawInput?.clientId || '').trim();
    const client = await dbGetClientById(clientId);

    const profile = rawInput?.profile || {};
    const desiredName = String(profile.client_name || client.client_name || '').trim();
    const desiredSlug = await ensureUniqueClientSlug(profile.client_slug || desiredName, client.id);
    const desiredBusinessType = String(profile.business_type || client.business_type || '').trim();
    const desiredTargetRegion = String(profile.target_region || client.target_region || '').trim();
    const desiredAddress = profile.address && typeof profile.address === 'object' ? profile.address : {};
    const desiredContactInfo = profile.contact_info && typeof profile.contact_info === 'object' ? profile.contact_info : {};
    const desiredSocialProfiles = uniqueStrings(profile.social_profiles || []);
    const desiredBusinessDetails = profile.business_details && typeof profile.business_details === 'object' ? profile.business_details : {};
    const desiredFaqs = normalizeFaqPairs(profile.geo_faqs || []);

    const contactEmail = normalizePortalContactEmail(
        desiredContactInfo.public_email
        || desiredContactInfo.email
        || rawInput?.portalDraft?.contact_email
        || ''
    );

    const updatePayload = syncClientProfileCompatibilityFields({
        client_name: desiredName,
        client_slug: desiredSlug,
        business_type: desiredBusinessType,
        target_region: desiredTargetRegion,
        address: {
            city: String(desiredAddress.city || '').trim(),
            region: String(desiredAddress.region || '').trim(),
            country: String(desiredAddress.country || '').trim(),
        },
        contact_info: {
            public_email: contactEmail,
            email: contactEmail,
            phone: String(desiredContactInfo.phone || '').trim(),
        },
        social_profiles: desiredSocialProfiles,
        seo_description: String(profile.seo_description || '').trim().slice(0, 200) || null,
        business_details: {
            ...desiredBusinessDetails,
            short_desc: String(desiredBusinessDetails.short_desc || desiredBusinessDetails.short_description || '').trim(),
            short_description: String(desiredBusinessDetails.short_description || desiredBusinessDetails.short_desc || '').trim(),
        },
        geo_faqs: desiredFaqs,
        publication_status: 'draft',
        is_published: false,
    });

    const updatedClient = await dbUpdateClient(client.id, updatePayload);

    const existingPrompts = await dbGetTrackedQueriesAll(client.id).catch(() => []);
    const existingPromptKeys = new Set(
        (existingPrompts || []).map((prompt) => String(prompt.query_text || '').trim().toLowerCase()).filter(Boolean)
    );

    const normalizedPrompts = normalizePromptSuggestions(rawInput?.promptSuggestions || []);
    if (normalizedPrompts.length === 0) {
        throw new Error('Activation refusée: aucun prompt valide sélectionné depuis le pack suggéré.');
    }
    const promptRows = [];
    for (const prompt of normalizedPrompts) {
        const key = prompt.query_text.toLowerCase();
        if (existingPromptKeys.has(key)) continue;
        const serialized = serializePromptContractForDb({
            contract: {
                prompt_origin: 'onboarding_wizard',
                intent_family: prompt.intent_family || 'discovery',
                prompt_mode: prompt.prompt_mode || 'user_like',
                quality_status: prompt.quality_status || 'review',
                quality_score: prompt.quality_score ?? 60,
                quality_reasons: Array.isArray(prompt.quality_reasons) ? prompt.quality_reasons : [],
                validation_status: prompt.validation_status || prompt.quality_status || 'review',
                validation_reasons: Array.isArray(prompt.validation_reasons) ? prompt.validation_reasons : [],
                offer_anchor: prompt.offer_anchor || null,
                user_visible_offering: prompt.user_visible_offering || null,
                target_audience: prompt.target_audience || null,
                primary_use_case: prompt.primary_use_case || null,
                differentiation_angle: prompt.differentiation_angle || null,
                query_type_v2: 'question',
                funnel_stage: 'consideration',
                geo_scope: 'market',
                brand_scope: 'market_generic',
                comparison_scope: 'none',
            },
            existingPromptMetadata: prompt.prompt_metadata || {},
        });
        const createdPrompt = await dbCreateTrackedQuery({
            client_id: client.id,
            query_text: prompt.query_text,
            category: prompt.category,
            query_type: prompt.category,
            locale: prompt.locale,
            is_active: prompt.is_active !== false,
            ...serialized.dbFields,
            prompt_metadata: serialized.prompt_metadata,
        });
        promptRows.push(createdPrompt);
        existingPromptKeys.add(key);
    }

    let portalDraftRecord = null;
    let clerkAccountCreated = false;
    if (rawInput?.portalDraft?.enabled === true && contactEmail) {
        const { clerkClient } = await import('@clerk/nextjs/server');
        portalDraftRecord = await upsertClientPortalAccess({
            clientId: client.id,
            contactEmail,
            portalRole: rawInput?.portalDraft?.portal_role || 'viewer',
            memberType: rawInput?.portalDraft?.member_type || 'client_contact',
            status: 'active',
        });

        // Create Clerk account so the client can sign in directly
        try {
            const clerk = await clerkClient();
            const existingUsers = await clerk.users.getUserList({
                emailAddress: [contactEmail],
            });
            if (existingUsers.totalCount === 0) {
                await clerk.users.createUser({
                    emailAddress: [contactEmail],
                    skipPasswordRequirement: true,
                    publicMetadata: {
                        source: 'portal_invitation',
                        client_id: client.id,
                    },
                });
                clerkAccountCreated = true;
            }
        } catch (err) {
            console.error('[onboarding] Clerk account creation failed:', err?.message);
        }

        /* 
        // Send notification email (Disabled by user request: manual sending preferred)
        await sendPortalInvitationEmail({
            contactEmail,
            clientName: desiredName,
            clientId: client.id,
            clientSlug: desiredSlug,
        }).catch((err) => {
            console.error('[onboarding] Portal email failed:', err?.message);
        });
        */
    }

    await dbLogAction({
        client_id: client.id,
        action_type: 'client_onboarding_activated',
        details: {
            prompts_created: promptRows.length,
            portal_draft_prepared: Boolean(portalDraftRecord),
            clerk_account_created: clerkAccountCreated,
            publication_status: 'draft',
        },
        performed_by: options.performedBy || null,
    });

    return {
        client: compactClient(updatedClient),
        createdPrompts: promptRows.length,
        portalDraft: portalDraftRecord
            ? {
                id: portalDraftRecord.id,
                contact_email: portalDraftRecord.contact_email,
                status: portalDraftRecord.status,
                portal_role: portalDraftRecord.portal_role,
                member_type: portalDraftRecord.member_type,
            }
            : null,
    };
}
