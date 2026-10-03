/**
 * Admin allowlist + Gmail-aware normalization (dots in local part are ignored by Google).
 */

/** Comma-separated. Prefer CLERK_ADMIN_EMAIL so ADMIN_EMAIL (Resend) stays distinct. */
function rawAdminList() {
    const admin = process.env.CLERK_ADMIN_EMAIL || process.env.ADMIN_PANEL_EMAIL;
    if (!admin) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[AdminEmail] CLERK_ADMIN_EMAIL non definie en developpement. Aucun acces admin Clerk ne sera accorde sans DEV_BYPASS_AUTH=1.');
            return '';
        }

        throw new Error('CLERK_ADMIN_EMAIL env var is required - no admin fallback in production');
    }

    return admin;
}

function normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';

    const trimmed = email.trim().toLowerCase();
    const at = trimmed.lastIndexOf('@');
    if (at <= 0) return trimmed;

    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);

    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        return `${local.replace(/\./g, '')}@${domain}`;
    }

    return trimmed;
}

/** Comma-separated list in CLERK_ADMIN_EMAIL / ADMIN_PANEL_EMAIL, or empty in local dev without config. */
export function getAdminEmailsNormalized() {
    const raw = rawAdminList();
    return raw
        .split(',')
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean);
}

export function isAdminEmail(email) {
    if (!email) return false;

    const adminEmails = getAdminEmailsNormalized();
    const normalizedEmail = normalizeEmail(email);

    return adminEmails.includes(normalizedEmail);
}
