import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { updateConnectorState, getClientConnectorRows } from '@/lib/connectors/repository';
import { mapGoogleOAuthError } from '@/lib/seo/gsc-property';
import { hasGoogleOAuthEnv, verifyGoogleOAuthState } from '@/lib/connectors/google-oauth-state';

/**
 * Forward an OAuth error to the operator surface as a structured remediation
 * payload. The error code (raw or wrapped) is mapped to a French headline
 * and remediation text via `mapGoogleOAuthError`. The connector state is
 * updated with the same payload so DossierConnectorsView can render the
 * remediation card without a roundtrip.
 */
async function failWithError({ clientId, returnTo, appUrl, code, fallbackMessage }) {
    const remedy = mapGoogleOAuthError(code, fallbackMessage);
    if (clientId) {
        try {
            await Promise.all([
                updateConnectorState({
                    clientId,
                    provider: 'gsc',
                    status: 'error',
                    lastError: remedy ? `[${remedy.code}] ${remedy.headline}: ${remedy.body}` : (fallbackMessage || 'oauth_failed'),
                }),
                updateConnectorState({
                    clientId,
                    provider: 'ga4',
                    status: 'error',
                    lastError: remedy ? `[${remedy.code}] ${remedy.headline}: ${remedy.body}` : (fallbackMessage || 'oauth_failed'),
                }),
            ]);
        } catch (persistError) {
            console.error('[Google OAuth] Failed to persist OAuth error state:', persistError);
        }
    }
    const errUrl = new URL(returnTo || '/admin', appUrl);
    errUrl.searchParams.set('error', remedy?.code || code || 'GoogleAuthFailed');
    if (remedy?.headline) errUrl.searchParams.set('errorMessage', remedy.headline);
    return NextResponse.redirect(errUrl.toString());
}

export async function GET(request) {
    // Support non-admin portal flow when callback state is valid.

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const statePayload = searchParams.get('state');
    const errorParam = searchParams.get('error');

    // We dynamically use the request origin to avoid redirect_uri mismatches (www vs non-www, Vercel previews, etc.)
    const appUrl = new URL(request.url).origin;

    const verifiedState = await verifyGoogleOAuthState(statePayload);
    if (!verifiedState.valid) {
        return NextResponse.json({
            error: 'invalid_google_oauth_state',
            status: 400,
            detail: verifiedState.error,
        }, { status: 400 });
    }

    const { clientId, returnTo } = verifiedState.payload;

    if (errorParam) {
        return failWithError({ clientId, returnTo, appUrl, code: errorParam });
    }

    if (!code || !clientId) {
        return NextResponse.json({ error: 'Invalid callback parameters' }, { status: 400 });
    }

    if (!hasGoogleOAuthEnv()) {
        return failWithError({
            clientId,
            returnTo,
            appUrl,
            code: 'missing_google_oauth_env',
        });
    }

    let oauth2Client;
    let tokens;
    try {
        oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_OAUTH_CLIENT_ID,
            process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            `${appUrl}/api/connectors/google/callback`
        );

        ({ tokens } = await oauth2Client.getToken(code));
    } catch (tokenError) {
        /* invalid_client → mauvais GOOGLE_OAUTH_CLIENT_ID/SECRET (voir
           lib/seo/gsc-property.js + mapGoogleOAuthError). Même remédiation
           côté UI connecteurs. Autres: invalid_grant, redirect_uri_mismatch. */
        const oauthCode =
            tokenError?.response?.data?.error
            || tokenError?.code
            || tokenError?.message;
        const fallbackMessage = tokenError?.response?.data?.error_description
            || tokenError?.message
            || null;
        console.error('[Google OAuth] Token exchange failed:', { code: oauthCode, message: fallbackMessage });
        return failWithError({ clientId, returnTo, appUrl, code: oauthCode, fallbackMessage });
    }

    try {
        oauth2Client.setCredentials(tokens);

        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const userInfo = await oauth2.userinfo.get();
        const googleEmail = userInfo.data.email;

        const existingConnectors = await getClientConnectorRows(clientId);
        const gscConnector = existingConnectors.find(c => c.provider === 'gsc') || {};
        const ga4Connector = existingConnectors.find(c => c.provider === 'ga4') || {};

        const gscConfig = {
            ...(gscConnector.config || {}),
            google_access_token: tokens.access_token,
            google_email: googleEmail,
        };

        const ga4Config = {
            ...(ga4Connector.config || {}),
            google_access_token: tokens.access_token,
            google_email: googleEmail,
        };

        if (tokens.refresh_token) {
            gscConfig.google_refresh_token = tokens.refresh_token;
            ga4Config.google_refresh_token = tokens.refresh_token;
        }

        if (!ga4Config.propertyId) {
            try {
                const analyticsadmin = google.analyticsadmin({ version: 'v1beta', auth: oauth2Client });
                const accountsResp = await analyticsadmin.accountSummaries.list();
                const summaries = accountsResp?.data?.accountSummaries || [];
                
                if (summaries.length > 0 && summaries[0].propertySummaries && summaries[0].propertySummaries.length > 0) {
                    const propertyName = summaries[0].propertySummaries[0].property;
                    if (propertyName) {
                        ga4Config.propertyId = propertyName.replace('properties/', '');
                    }
                }
            } catch (err) {
                console.error('[Google OAuth] Failed to auto-fetch GA4 property:', err);
            }
        }

        await Promise.all([
            updateConnectorState({
                clientId,
                provider: 'gsc',
                status: 'configured',
                config: gscConfig,
                lastError: null,
            }),
            updateConnectorState({
                clientId,
                provider: 'ga4',
                status: 'configured',
                config: ga4Config,
                lastError: null,
            })
        ]);

        const succUrl = new URL(returnTo, appUrl);
        succUrl.searchParams.set('success', 'GoogleConnected');
        return NextResponse.redirect(succUrl.toString());
    } catch (error) {
        console.error('[Google OAuth] Callback Error:', error);
        const oauthCode = error?.response?.data?.error || error?.code || 'GoogleAuthCallbackFailed';
        const fallbackMessage = error?.response?.data?.error_description || error?.message || null;
        return failWithError({ clientId, returnTo, appUrl, code: oauthCode, fallbackMessage });
    }
}
