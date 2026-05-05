import 'server-only';

import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_RETURN_TO_LENGTH = 512;
const SAFE_RETURN_PREFIXES = ['/admin/', '/portal/', '/espace/'];
const STATE_ISSUER = 'trouvable';
const STATE_AUDIENCE = 'google-oauth';

function getStateSecret() {
    return process.env.GOOGLE_OAUTH_STATE_SECRET
        || process.env.GOOGLE_OAUTH_CLIENT_SECRET
        || process.env.CLERK_SECRET_KEY
        || '';
}

function getStateKey(secret) {
    return new TextEncoder().encode(secret);
}

export function normalizeGoogleOAuthReturnTo(value, fallback = null) {
    const raw = String(value || fallback || '').trim();
    if (!raw || raw.length > MAX_RETURN_TO_LENGTH) return null;
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//')) return null;
    if (raw.includes('\\')) return null;
    if (/[\u0000-\u001F\u007F]/.test(raw)) return null;

    let parsed;
    try {
        parsed = new URL(raw, 'https://trouvable.local');
    } catch {
        return null;
    }

    const pathname = parsed.pathname || '/';
    const isAllowed = SAFE_RETURN_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
    if (!isAllowed) return null;

    return `${pathname}${parsed.search || ''}${parsed.hash || ''}`;
}

export function inferGoogleOAuthInitiator(returnTo = '') {
    if (String(returnTo).startsWith('/portal/')) return 'portal';
    if (String(returnTo).startsWith('/espace/')) return 'espace';
    return 'admin';
}

export async function createGoogleOAuthState({
    clientId,
    returnTo,
    origin,
    initiator = null,
    nowMs = Date.now(),
    ttlMs = DEFAULT_STATE_TTL_MS,
} = {}) {
    const secret = getStateSecret();
    if (!secret) {
        throw new Error('missing_google_oauth_state_secret');
    }

    const safeReturnTo = normalizeGoogleOAuthReturnTo(returnTo);
    if (!clientId || !safeReturnTo || !origin) {
        throw new Error('invalid_google_oauth_state_payload');
    }

    const issuedAt = Math.floor(nowMs);
    const expiresAt = issuedAt + Math.max(1, Number(ttlMs) || DEFAULT_STATE_TTL_MS);
    const payload = {
        clientId: String(clientId),
        returnTo: safeReturnTo,
        origin: String(origin),
        initiator: initiator || inferGoogleOAuthInitiator(safeReturnTo),
        nonce: crypto.randomBytes(16).toString('hex'),
        issuedAt,
        expiresAt,
    };

    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuer(STATE_ISSUER)
        .setAudience(STATE_AUDIENCE)
        .setIssuedAt(Math.floor(issuedAt / 1000))
        .setExpirationTime(Math.floor(expiresAt / 1000))
        .sign(getStateKey(secret));
}

export async function verifyGoogleOAuthState(state, { nowMs = Date.now() } = {}) {
    const raw = String(state || '').trim();
    if (!raw) {
        return { valid: false, error: 'missing_state' };
    }

    const secret = getStateSecret();
    if (!secret) {
        return { valid: false, error: 'missing_state_secret' };
    }

    if (raw.split('.').length !== 3) {
        return { valid: false, error: 'malformed_state' };
    }

    let payload;
    try {
        ({ payload } = await jwtVerify(raw, getStateKey(secret), {
            issuer: STATE_ISSUER,
            audience: STATE_AUDIENCE,
            currentDate: new Date(Number(nowMs)),
        }));
    } catch (error) {
        if (error?.code === 'ERR_JWT_EXPIRED') {
            return { valid: false, error: 'expired_state' };
        }
        return { valid: false, error: 'invalid_signature' };
    }

    if (!payload?.clientId || !payload?.origin || !payload?.nonce || !payload?.expiresAt) {
        return { valid: false, error: 'malformed_state' };
    }

    const safeReturnTo = normalizeGoogleOAuthReturnTo(payload.returnTo);
    if (!safeReturnTo) {
        return { valid: false, error: 'invalid_return_to' };
    }

    if (Number(payload.expiresAt) < Number(nowMs)) {
        return { valid: false, error: 'expired_state' };
    }

    return {
        valid: true,
        payload: {
            ...payload,
            returnTo: safeReturnTo,
        },
    };
}

export function hasGoogleOAuthEnv(env = process.env) {
    return Boolean(String(env.GOOGLE_OAUTH_CLIENT_ID || '').trim() && String(env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim());
}
