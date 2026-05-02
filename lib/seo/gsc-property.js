import 'server-only';

/**
 * Shared GSC property resolution.
 *
 * The Google Search Console API is strict about how a site is identified.
 * A property can be either:
 *   - a domain property:  `sc-domain:example.com`
 *   - a URL prefix:       `https://www.example.com/`  (trailing slash matters)
 *
 * Trouvable historically had two divergent resolvers:
 *   - lib/seo/gsc-sync.js used `client.website_url` directly
 *   - lib/operator-intelligence/visibility.js walked the connector config
 *     for several keys before falling back to the website URL
 *
 * That drift caused mandates connected via OAuth to a different property
 * than the marketing website to surface "invalid_client" / property-not-
 * found errors in the visibility view even though the connector was healthy.
 *
 * This module is the single source of truth. Both the sync job and the
 * read-side resolvers must call it.
 *
 * Resolution order (first non-empty wins):
 *   1. connector.config.site_url
 *   2. connector.config.gsc_site_url
 *   3. connector.config.property_url
 *   4. connector.config.property
 *   5. connector.config.gsc_property
 *   6. websiteUrl (caller-provided client.website_url)
 */

export function normalizeGscSiteUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (value.startsWith('sc-domain:')) return value;

    try {
        return new URL(value).href;
    } catch {
        return value;
    }
}

export function resolveGscProperty({ connector = null, websiteUrl = null } = {}) {
    const config = connector?.config || {};
    const candidates = [
        config.site_url,
        config.gsc_site_url,
        config.property_url,
        config.property,
        config.gsc_property,
        websiteUrl,
    ];

    for (const candidate of candidates) {
        const normalized = normalizeGscSiteUrl(candidate);
        if (normalized) return normalized;
    }
    return null;
}

/* ─────────────── OAuth error mapping ───────────────
 * Google OAuth failures arrive as opaque codes. We translate them into
 * actionable French remediation copy for the connector card and surface
 * the underlying code separately so operators can debug in the logs.
 */

const GOOGLE_OAUTH_ERROR_REMEDY = {
    invalid_client: {
        headline: 'Identifiants OAuth Google invalides',
        body: 'Le `client_id` ou `client_secret` configuré dans l\u2019environnement Trouvable ne correspond pas à l\u2019application Google Cloud autorisée. Vérifiez les variables `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`, puis reconnectez le mandat.',
        severity: 'critical',
    },
    invalid_grant: {
        headline: 'Refresh token Google expiré ou révoqué',
        body: 'Le refresh token associé à ce mandat n\u2019est plus accepté. Reconnectez Google Search Console pour générer un nouveau jeton.',
        severity: 'critical',
    },
    redirect_uri_mismatch: {
        headline: 'URI de redirection OAuth non autorisée',
        body: 'L\u2019URL de callback (`/api/connectors/google/callback`) n\u2019est pas listée dans la console Google Cloud pour ce client OAuth. Ajoutez l\u2019URL dans les "URI de redirection autorisés", puis relancez la connexion.',
        severity: 'critical',
    },
    access_denied: {
        headline: 'Autorisation refusée par l\u2019utilisateur',
        body: 'L\u2019utilisateur a annulé le consentement Google. Relancez la connexion et acceptez les autorisations Search Console + Analytics.',
        severity: 'warning',
    },
    insufficient_scope: {
        headline: 'Périmètre OAuth insuffisant',
        body: 'Le compte connecté n\u2019a pas accordé l\u2019accès Search Console requis. Reconnectez en validant explicitement le scope `webmasters.readonly`.',
        severity: 'warning',
    },
    unauthorized_client: {
        headline: 'Application OAuth non autorisée',
        body: 'L\u2019application Google Cloud n\u2019est pas autorisée à demander ce flux. Vérifiez que le projet est en mode "Production" ou que l\u2019utilisateur figure dans les testeurs.',
        severity: 'critical',
    },
    server_error: {
        headline: 'Erreur côté Google',
        body: 'Google a renvoyé une erreur transitoire (HTTP 5xx). Réessayez dans quelques minutes.',
        severity: 'warning',
    },
};

export function mapGoogleOAuthError(code = null, fallbackMessage = null) {
    const normalized = String(code || '').trim().toLowerCase();
    if (normalized && GOOGLE_OAUTH_ERROR_REMEDY[normalized]) {
        return {
            code: normalized,
            ...GOOGLE_OAUTH_ERROR_REMEDY[normalized],
        };
    }
    if (fallbackMessage) {
        return {
            code: normalized || 'unknown',
            headline: 'Erreur de connexion Google',
            body: fallbackMessage,
            severity: 'warning',
        };
    }
    if (normalized) {
        return {
            code: normalized,
            headline: 'Erreur de connexion Google',
            body: `Code OAuth: ${normalized}`,
            severity: 'warning',
        };
    }
    return null;
}
