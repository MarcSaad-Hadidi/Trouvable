/**
 * Résolution "métier" pour prompts & stratégie — le type Schema.org brut est un signal partiel,
 * jamais la seule source de vérité. Priorité : classification d'audit > services > type libre.
 */
function slugifyLabel(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80);
}

function inferAudienceFromSignals(rawType, siteType, servicesText) {
    const hay = `${rawType} ${siteType} ${servicesText}`.toLowerCase();
    if (/(b2b|entreprise|saas|agence|professionnel|industriel)/.test(hay)) return 'b2b';
    if (/(b2c|particulier|resident|menage|famille)/.test(hay)) return 'b2c';
    if (/(b2b2c|marketplace|plateforme)/.test(hay)) return 'b2b2c';
    return 'mixed';
}

function isGenericSchemaToken(rawType) {
    const t = String(rawType || '').trim().toLowerCase().replace(/^https?:\/\/schema\.org\//i, '');
    if (!t) return true;
    return /^(localbusiness|organization|organisation|business|company|corporation|thing|webpage|website|service|place|establishment|store|shop|professional_service|professionalservice)$/i.test(t);
}

function firstSentence(value, maxLen = 140) {
    const s = String(value || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    const m = s.match(/^.{1,400}?[.!?](?=\s|$)/);
    const cut = (m ? m[0] : s).trim();
    return cut.length > maxLen ? `${cut.slice(0, maxLen - 1)}…` : cut;
}

export function resolveBusinessType(businessType, siteClassification = {}, clientName = '') {
    const rawType = String(businessType || '').trim();
    const schemaTypeDetected = rawType || null;
    const siteType = siteClassification?.type || 'generic_business';
    const siteLabel = String(siteClassification?.label || '').trim();
    const services = Array.isArray(siteClassification?.services_preview)
        ? siteClassification.services_preview
        : (Array.isArray(siteClassification?.detected_services) ? siteClassification.detected_services : []);
    const servicesText = services.slice(0, 12).join(' ');
    const shortPreview = String(siteClassification?.short_description_preview || '').trim();
    const seoTeaser = String(siteClassification?.seo_teaser || '').trim();
    const narrativeHay = `${servicesText} ${firstSentence(shortPreview, 200)} ${firstSentence(seoTeaser, 160)}`.toLowerCase();

    let businessModelDetected = siteType || 'generic_business';
    let canonicalCategory = 'unknown';
    let canonicalSubcategory = 'general';
    let targetAudience = inferAudienceFromSignals(rawType, siteType, servicesText);
    let categoryConfidence = 'medium';
    let categoryResolutionReason = 'Heuristiques par défaut';
    let needsReview = false;
    let primaryUseCase = '';
    let marketPositioning = '';
    let differentiationAngle = '';
    let offeringAnchor = '';
    let displayLabel = '';

    const descriptiveLabel = (!isGenericSchemaToken(rawType) && rawType.length >= 3)
        ? rawType
        : (siteLabel && !isGenericSchemaToken(siteLabel) ? siteLabel : '');

    if (descriptiveLabel) {
        canonicalCategory = slugifyLabel(descriptiveLabel) || 'unknown';
        categoryResolutionReason = 'Libellé métier descriptif (Schema ou classification site)';
        categoryConfidence = 'medium';
    }

    if (siteLabel && !isGenericSchemaToken(siteLabel)) {
        canonicalSubcategory = slugifyLabel(siteLabel) || canonicalSubcategory;
        marketPositioning = `Positionnement observé (audit) : ${siteLabel}`;
    }

    if (services[0]) {
        primaryUseCase = `Livrer / réaliser : ${services[0]}`;
        canonicalSubcategory = slugifyLabel(services[0]) || canonicalSubcategory;
        offeringAnchor = String(services[0]).trim();
    } else if (shortPreview.length >= 14) {
        offeringAnchor = firstSentence(shortPreview, 120);
        primaryUseCase = `Livrer / réaliser : ${offeringAnchor}`;
        categoryResolutionReason = services.length === 0 && descriptiveLabel
            ? `${categoryResolutionReason} ; complété par la description courte`
            : 'Ancre offre dérivée de la description courte (profil)';
        if (!descriptiveLabel) needsReview = true;
    } else if (seoTeaser.length >= 14) {
        offeringAnchor = firstSentence(seoTeaser, 100);
        primaryUseCase = `Livrer / réaliser : ${offeringAnchor}`;
        marketPositioning = marketPositioning
            ? `${marketPositioning} · Accroche SEO : ${offeringAnchor}`
            : `Accroche SEO : ${offeringAnchor}`;
    }

    const saasSignals = /software|saas|plateforme|platform|logiciel|cloud|api|abonnement|subscription/i;
    const nameHay = String(clientName || '');
    const typeHay = `${rawType} ${siteType} ${siteLabel} ${servicesText} ${narrativeHay} ${nameHay.toLowerCase()}`;

    if (saasSignals.test(typeHay) || businessModelDetected === 'saas_software') {
        businessModelDetected = 'saas';
        canonicalCategory = slugifyLabel(descriptiveLabel || 'logiciel') || 'saas_product';
        canonicalSubcategory = 'software_platform';
        targetAudience = 'b2b';
        categoryConfidence = saasSignals.test(rawType) ? 'high' : 'medium';
        categoryResolutionReason = 'Signaux logiciel / SaaS (type, audit ou services)';
        differentiationAngle = 'Préciser intégrations, preuve ROI et segment cible plutôt que la catégorie générique « logiciel ».';
    }

    if (/(restaurant|cafe|bar|hotel|clinique|clinic|dentiste|plombier|electricien|avocat|notaire|agence immobiliere|garage|salon)/i.test(typeHay)) {
        businessModelDetected = 'local_service';
        targetAudience = /(avocat|clinique|agence|b2b)/i.test(typeHay) ? 'b2b' : 'b2c';
        categoryConfidence = 'high';
        categoryResolutionReason = 'Signaux forte intention locale / métier réglementé';
        differentiationAngle = 'Mettre l’accent sur preuves locales, délais, garanties et prise en charge géographique.';
    }

    // Service-led / operated-service detection — firms that provide strategy, consulting,
    // execution or managed services using internal tech. These are NOT selling software
    // as a self-serve product, even if they use platforms/AI internally.
    const serviceLedSignals = /agence|agency|consulting|conseil|cabinet|firme|mandat|strateg|execution|managed.?service|operated|accompagnement|pilotage|service.?professionnel/i;
    if (serviceLedSignals.test(typeHay) && businessModelDetected === 'saas') {
        businessModelDetected = 'operated_service';
        targetAudience = 'b2b';
        categoryConfidence = 'medium';
        categoryResolutionReason = 'Signaux service opéré / firme de services (priorité sur SaaS quand les deux sont détectés)';
        differentiationAngle = "Mettre l'accent sur l'exécution, les résultats mesurés et l'accompagnement humain plutôt que sur les fonctionnalités logicielles.";
    }

    if (isGenericSchemaToken(rawType) && !descriptiveLabel) {
        needsReview = true;
        categoryConfidence = offeringAnchor ? 'medium' : 'weak';
        categoryResolutionReason = offeringAnchor
            ? 'Type Schema.org générique, l’ancre offre repose surtout sur services / description (à valider)'
            : 'Type Schema.org trop générique, renseigner services, description courte et zone pour ancrer les prompts';
        differentiationAngle = 'Compléter le profil (services, zone, preuves) avant de tirer des conclusions fortes.';
    }

    if (!offeringAnchor && descriptiveLabel) {
        offeringAnchor = descriptiveLabel;
    }

    if (/trouvable/i.test(nameHay) && /(geo|seo|visibilit[eé]|ia|trouvable|findable|visible)/i.test(typeHay)) {
        businessModelDetected = 'operated_service';
        canonicalCategory = 'ai_visibility_services';
        canonicalSubcategory = 'local_visibility_strategy';
        targetAudience = 'b2b';
        categoryConfidence = 'strong';
        needsReview = false;
        categoryResolutionReason = 'Correspondance produit Trouvable / services de visibilité IA opérés';
        displayLabel = 'Services de visibilité IA';
    }

    if (!displayLabel) {
        displayLabel = descriptiveLabel || offeringAnchor || '';
    }

    return {
        schema_type_detected: schemaTypeDetected || '',
        business_model_detected: businessModelDetected,
        canonical_category: canonicalCategory,
        canonical_subcategory: canonicalSubcategory,
        target_audience: targetAudience,
        category_confidence: categoryConfidence,
        category_resolution_reason: categoryResolutionReason,
        needs_review: needsReview,
        primary_use_case: primaryUseCase || null,
        offering_anchor: offeringAnchor || null,
        market_positioning: marketPositioning || null,
        differentiation_angle: differentiationAngle || null,
        display_label: displayLabel || null,
    };
}
