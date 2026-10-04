import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import {
    acceptsMarkdown,
    buildRobotsTxt,
    CONTENT_SIGNAL_VALUE,
    HOME_DISCOVERY_LINKS,
} from '@/lib/agent-discovery/config';
import { isDevAuthBypassAllowedForRequest } from '@/lib/dev-bypass';

const isAdminRoute = createRouteMatcher(['/admin(.*)']);
const isPortalRoute = createRouteMatcher(['/portal(.*)']);
const isEspaceRoute = createRouteMatcher(['/espace(.*)']);
const isPublicAdminAuthRoute = createRouteMatcher(['/admin/sign-in(.*)']);
const isPublicPortalAuthRoute = createRouteMatcher(['/portal/sign-in(.*)']);
const isEspacePostLogin = createRouteMatcher(['/espace/apres-connexion(.*)']);
const HOME_LINK_HEADER_VALUE = HOME_DISCOVERY_LINKS.join(', ');
const MARKDOWN_BYPASS_HEADER = 'x-trouvable-markdown-source';
const MARKDOWN_BLOCKED_PREFIXES = ['/api', '/admin', '/portal', '/espace', '/_next', '/.well-known', '/__agent'];

function appendVaryHeader(response, value) {
    const existing = response.headers.get('Vary');
    if (!existing) {
        response.headers.set('Vary', value);
        return;
    }

    const normalizedValues = existing
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

    if (!normalizedValues.includes(value.toLowerCase())) {
        response.headers.set('Vary', `${existing}, ${value}`);
    }
}

function addHomeDiscoveryHeaders(req, response) {
    if (req.nextUrl.pathname !== '/') return;

    response.headers.set('Link', HOME_LINK_HEADER_VALUE);
    appendVaryHeader(response, 'Accept');
}

function shouldRewriteToMarkdown(req) {
    if (req.method !== 'GET') return false;
    if (!acceptsMarkdown(req)) return false;
    if (req.headers.get(MARKDOWN_BYPASS_HEADER) === '1') return false;

    const pathname = req.nextUrl.pathname;
    if (pathname === '/favicon.ico') return false;

    if (/\.[a-z0-9]+$/i.test(pathname)) return false;

    return !MARKDOWN_BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function createMarkdownRewriteResponse(req) {
    const markdownUrl = new URL('/__agent/markdown', req.url);
    markdownUrl.searchParams.set('path', req.nextUrl.pathname);
    if (req.nextUrl.search) {
        markdownUrl.searchParams.set('query', req.nextUrl.search);
    }

    return NextResponse.rewrite(markdownUrl);
}

function createRobotsResponse() {
    return new Response(buildRobotsTxt(), {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, no-transform',
            'CDN-Cache-Control': 'no-transform',
            'Content-Signal': CONTENT_SIGNAL_VALUE,
        },
    });
}

// ---------------------------------------------------------------------------
// Content-Security-Policy — application runtime policy
// Static hibernation parking uses a separate restrictive CSP in vercel.json.
// Validate each policy against its own security contract; they intentionally differ.
//
// Directive rationale (per integration):
//   Clerk v7      — *.clerk.com, *.clerk.accounts.dev (dev), clerk.trouvable.app,
//                    clerk-telemetry.com, img.clerk.com, wss:// for WebSocket auth
//   Turnstile     — challenges.cloudflare.com (script + frame + connect)
//   CF Web Analytics — static.cloudflareinsights.com (script),
//                      cloudflareinsights.com (connect), auto-injected by CF proxy
//   Vercel Analytics — va.vercel-scripts.com (script + connect)
//   Vercel Insights  — cdn.vercel-insights.com (script),
//                      vitals.vercel-insights.com (connect)
//   Microsoft Clarity — *.clarity.ms (script + connect),
//                       c.bing.com (connect)
//   Supabase      — *.supabase.co (connect)
//
// 'unsafe-inline' in script-src: still required by Next.js inline scripts,
//   Clerk SDK script injection, and Vercel Analytics. Removal requires
//   nonce-based CSP (deferred to future batch).
// 'unsafe-inline' in style-src: required by Clerk UI, Framer Motion, Next.js
//   CSS injection. Removal requires nonce-based style handling (deferred).
// 'unsafe-eval' REMOVED from the baseline policy: not required by Clerk v7,
//   Next.js production, or any first-party code. Local Next.js development
//   still needs it for React callstack reconstruction and Fast Refresh, so it
//   is injected at runtime only when NODE_ENV=development.
// Google Fonts URLs REMOVED: next/font/google self-hosts fonts at build time.
// ---------------------------------------------------------------------------
const cspHeader = [
    "default-src 'self' https://*.clarity.ms https://c.bing.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
    "worker-src 'self' blob:",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.trouvable.app https://clerk-telemetry.com https://*.clerk-telemetry.com https://va.vercel-scripts.com https://cdn.vercel-insights.com https://*.clarity.ms",
    "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com https://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://clerk.trouvable.app wss://*.clerk.accounts.dev wss://clerk-telemetry.com wss://*.clerk-telemetry.com https://clerk-telemetry.com https://*.clerk-telemetry.com https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.clarity.ms https://c.bing.com",
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://*.clerk.com https://clerk.trouvable.app",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https: https://img.clerk.com",
    "object-src 'none'",
].join('; ');

function getRuntimeCspHeader() {
    if (process.env.NODE_ENV !== 'development') {
        return cspHeader;
    }

    return cspHeader.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'");
}

const clerkProxy = clerkMiddleware(
    async (auth, req) => {
        if (req.nextUrl.pathname === '/favicon.ico') {
            return NextResponse.redirect(new URL('/icon.png', req.url), 307);
        }

        if (isAdminRoute(req) && !isPublicAdminAuthRoute(req)) {
            await auth.protect({ unauthenticatedUrl: new URL('/espace', req.url).toString() });
        }
        if (isPortalRoute(req) && !isPublicPortalAuthRoute(req)) {
            await auth.protect({ unauthenticatedUrl: new URL('/espace', req.url).toString() });
        }
        if (isEspaceRoute(req) && isEspacePostLogin(req)) {
            await auth.protect({ unauthenticatedUrl: new URL('/espace', req.url).toString() });
        }

        const response = shouldRewriteToMarkdown(req) ? createMarkdownRewriteResponse(req) : NextResponse.next();

        response.headers.set('Content-Security-Policy', getRuntimeCspHeader());
        addHomeDiscoveryHeaders(req, response);
        return response;
    },
    {
        signInUrl: '/espace',
        signUpUrl: '/espace',
    },
);

export default async function proxy(req) {
    const isDevAdminAuthBypass = isDevAuthBypassAllowedForRequest(req) && isAdminRoute(req);

    if (req.nextUrl.pathname === '/favicon.ico') {
        return NextResponse.redirect(new URL('/icon.png', req.url), 307);
    }

    if (req.nextUrl.pathname === '/robots.txt') {
        return createRobotsResponse();
    }

    if (isDevAdminAuthBypass) {
        const response = shouldRewriteToMarkdown(req) ? createMarkdownRewriteResponse(req) : NextResponse.next();
        response.headers.set('Content-Security-Policy', getRuntimeCspHeader());
        response.headers.set('x-trouvable-dev-auth-bypass', '1');
        addHomeDiscoveryHeaders(req, response);
        return response;
    }

    return clerkProxy(req);
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
