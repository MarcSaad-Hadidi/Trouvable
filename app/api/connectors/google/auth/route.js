import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import {
    createGoogleOAuthState,
    hasGoogleOAuthEnv,
    inferGoogleOAuthInitiator,
    normalizeGoogleOAuthReturnTo,
} from '@/lib/connectors/google-oauth-state';

export async function GET(request) {
    // Allow clients to initiate OAuth from the private email link without being logged into Clerk yet.
    // The clientId is a UUID and acts as an obscure token in this context.
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const fallbackReturnTo = clientId ? `/admin/clients/${clientId}/dossier/connectors` : null;
    const returnTo = normalizeGoogleOAuthReturnTo(searchParams.get('returnTo'), fallbackReturnTo);
    
    if (!clientId) {
        return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
    }

    if (!returnTo) {
        return NextResponse.json({
            error: 'invalid_return_to',
            status: 400,
            detail: 'Google OAuth return target must be a relative admin, portal, or espace path.',
        }, { status: 400 });
    }

    if (!hasGoogleOAuthEnv()) {
        return NextResponse.json({
            error: 'missing_google_oauth_env',
            status: 503,
            detail: 'Google OAuth is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET server-side.',
        }, { status: 503 });
    }

    // We dynamically use the request origin to avoid redirect_uri mismatches (www vs non-www, Vercel previews, etc.)
    const appUrl = new URL(request.url).origin;
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        `${appUrl}/api/connectors/google/callback`
    );

    const scopes = [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/userinfo.email'
    ];

    let statePayload;
    try {
        statePayload = createGoogleOAuthState({
            clientId,
            returnTo,
            origin: appUrl,
            initiator: inferGoogleOAuthInitiator(returnTo),
        });
    } catch (error) {
        console.error('[Google OAuth] Failed to create signed state:', { code: error?.message || 'state_error' });
        return NextResponse.json({
            error: 'google_oauth_state_error',
            status: 500,
            detail: 'Google OAuth state could not be created.',
        }, { status: 500 });
    }

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: scopes,
        state: statePayload,
    });

    return NextResponse.redirect(authorizationUrl);
}
