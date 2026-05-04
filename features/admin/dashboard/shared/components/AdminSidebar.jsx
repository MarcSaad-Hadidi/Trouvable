'use client';

import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminSidebarAuthPanel = dynamic(() => import('./AdminSidebarAuthPanel'), {
    ssr: false,
});

const PORTFOLIO_NAV = [
    { id: 'dashboard', label: 'Tableau de bord', icon: 'dashboard', href: '/admin' },
    { id: 'clients', label: 'Portefeuille', icon: 'portfolio', href: '/admin/clients' },
    { id: 'new', label: 'Nouveau mandat', icon: 'plus', href: '/admin/clients/onboarding' },
];

const CLIENT_DOSSIER_NAV = [
    { id: 'dossier', label: 'Vue dossier', icon: 'command', path: '/dossier' },
    { id: 'dossier-audit', label: 'Laboratoire audit', icon: 'audit', path: '/dossier/audit' },
    { id: 'dossier-audit-comparison', label: 'Comparaison audits', icon: 'compare', path: '/dossier/audit/comparison' },
    { id: 'dossier-activity', label: 'Activité', icon: 'pulse', path: '/dossier/activity' },
    { id: 'dossier-connectors', label: 'Connecteurs', icon: 'connectors', path: '/dossier/connectors' },
];

const CLIENT_SEO_NAV = [
    { id: 'seo-visibility', label: 'Visibilité SEO', icon: 'visibility', path: '/seo/visibility' },
    { id: 'seo-health', label: 'Santé SEO', icon: 'audit', path: '/seo/health' },
    { id: 'seo-correction-prompts', label: 'Prompts correction IA', icon: 'prompts', path: '/seo/correction-prompts' },
    { id: 'seo-on-page', label: 'Optimisation on-page', icon: 'content', path: '/seo/on-page' },
    { id: 'seo-content', label: 'Contenu SEO', icon: 'editorial', path: '/seo/content' },
    { id: 'seo-cannibalization', label: 'Cannibalisation SEO', icon: 'compare', path: '/seo/cannibalization' },
];

const CLIENT_GEO_NAV = [
    { id: 'overview', label: 'Situation GEO', icon: 'overview', path: '/geo' },
    { id: 'geo-crawlers', label: 'Crawlers IA', icon: 'crawler', path: '/geo/crawlers' },
    { id: 'geo-schema', label: 'Schema & entité', icon: 'schema', path: '/geo/schema' },
    { id: 'geo-readiness', label: 'Préparation GEO', icon: 'readiness', path: '/geo/readiness' },
    { id: 'geo-consistency', label: 'Cohérence marque', icon: 'compare', path: '/geo/consistency' },
    { id: 'geo-alerts', label: 'Alertes GEO', icon: 'alerts', path: '/geo/alerts' },
    { id: 'runs', label: 'Exécution', icon: 'pulse', path: '/geo/runs' },
    { id: 'prompts', label: 'Requêtes GEO', icon: 'prompts', path: '/geo/prompts' },
    { id: 'geo-compare', label: 'GEO Compare', icon: 'compare', path: '/geo/compare' },
    { id: 'signals', label: 'Signaux', icon: 'signal', path: '/geo/signals' },
    { id: 'social', label: 'Veille sociale', icon: 'social', path: '/geo/social' },
    { id: 'opportunities', label: "File d'actions", icon: 'actions', path: '/geo/opportunities' },
    { id: 'llms-txt', label: 'llms.txt', icon: 'llmstxt', path: '/geo/llms-txt' },
    { id: 'models', label: 'Fiabilité IA', icon: 'models', path: '/geo/models' },
    { id: 'continuous', label: 'Suivi continu', icon: 'continuous', path: '/geo/continuous' },
];

const CLIENT_AGENT_NAV = [
    { id: 'agent', label: 'Vue AGENT', icon: 'dashboard', path: '/agent' },
    { id: 'agent-visibility', label: 'Visibilité AGENT', icon: 'visibility', path: '/agent/visibility' },
    { id: 'agent-readiness', label: 'Préparation AGENT', icon: 'readiness', path: '/agent/readiness' },
    { id: 'agent-actionability', label: 'Actionnabilité AGENT', icon: 'signal', path: '/agent/actionability' },
    { id: 'agent-protocols', label: 'Protocoles AGENT', icon: 'schema', path: '/agent/protocols' },
    { id: 'agent-competitors', label: 'Comparatif AGENT', icon: 'compare', path: '/agent/competitors' },
    { id: 'agent-fixes', label: 'Correctifs AGENT', icon: 'actions', path: '/agent/fixes' },
];

const CLIENT_RESTITUTION_NAV = [
    { id: 'portal', label: 'Restitution client', icon: 'portal', path: '/portal' },
    { id: 'settings', label: 'Paramètres', icon: 'gear', path: '/dossier/settings' },
];

const ICONS = {
    portfolio: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 17v-1a3 3 0 00-3-3H8a3 3 0 00-3 3v1" /><circle cx="10" cy="7" r="3" />
            <path d="M17 6a2.5 2.5 0 010 5M3 11A2.5 2.5 0 013 6" />
        </svg>
    ),
    plus: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 4v12M4 10h12" />
        </svg>
    ),
    command: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="6" height="6" rx="1.5" /><rect x="12" y="2" width="6" height="6" rx="1.5" />
            <rect x="2" y="12" width="6" height="6" rx="1.5" /><rect x="12" y="12" width="6" height="6" rx="1.5" />
        </svg>
    ),
    overview: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 10h5V3H3v7zm0 7h5v-5H3v5zm9 0h5V9h-5v8zm0-14v4h5V3h-5z" />
        </svg>
    ),
    crawler: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="2.5" />
            <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3M4.8 4.8l2.1 2.1M13.1 13.1l2.1 2.1M15.2 4.8l-2.1 2.1M6.9 13.1l-2.1 2.1" />
        </svg>
    ),
    schema: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="5" height="5" rx="1.2" /><rect x="12" y="3" width="5" height="5" rx="1.2" />
            <rect x="7.5" y="12" width="5" height="5" rx="1.2" /><path d="M8 5.5h4M10 8v4" /><path d="M12 5.5h0" />
        </svg>
    ),
    readiness: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3a7 7 0 107 7" />
            <path d="M10 10l4-4" />
            <path d="M10 10l2.5 2.5" />
            <circle cx="10" cy="10" r="1.4" />
        </svg>
    ),
    pulse: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 10h3l2-4 3 8 2-4h6" />
        </svg>
    ),
    connectors: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M7 5V3H5v2H4a2 2 0 00-2 2v1h4V7h2V5H7zm6 10v2h2v-2h1a2 2 0 002-2v-1h-4v1h-2v2h1z" />
            <path d="M6 11h8" />
        </svg>
    ),
    audit: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V9M13 2l5 5h-5V2zM7 10h6M7 13h4" />
        </svg>
    ),
    compare: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 17l5-5 4 4 8-12" /><path d="M14 5h5v5" />
        </svg>
    ),
    signal: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 2" />
        </svg>
    ),
    social: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 4h16M2 8h12M2 12h10M2 16h6" />
        </svg>
    ),
    actions: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 17l5-5 4 4 8-12" /><path d="M14 5h5v5" />
        </svg>
    ),
    portal: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 17v-1a3 3 0 00-3-3H8a3 3 0 00-3 3v1" /><circle cx="10" cy="7" r="3" />
        </svg>
    ),
    llmstxt: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M11 2H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8l-6-6z" />
            <path d="M11 2v6h6" /><path d="M7 13h6M7 10h3" />
        </svg>
    ),
    gear: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path d="M17.7 10a8 8 0 01-.1 1l1.5 1.2-1.5 2.6-1.8-.8a7.4 7.4 0 01-1.8 1l-.3 1.9h-3l-.3-1.9a7.4 7.4 0 01-1.8-1l-1.8.8L5 13.2 6.5 12a8 8 0 010-2L5 8.8l1.5-2.6 1.8.8a7.4 7.4 0 011.8-1L10.3 4h3l.3 1.9a7.4 7.4 0 011.8 1l1.8-.8 1.5 2.6-1.5 1.2a8 8 0 01.5 1z" />
        </svg>
    ),
    dashboard: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="7" height="8" rx="1.5" /><rect x="11" y="2" width="7" height="5" rx="1.5" />
            <rect x="2" y="12" width="7" height="6" rx="1.5" /><rect x="11" y="9" width="7" height="9" rx="1.5" />
        </svg>
    ),
    prompts: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 5h12M4 10h8M4 15h5" /><path d="M15 12l3 3-3 3" />
        </svg>
    ),
    models: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.5 2.5" /><path d="M6 3l1 2M14 3l-1 2" />
        </svg>
    ),
    continuous: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 15l4-4 3 3 4-5 5-5" /><circle cx="17" cy="4" r="2" />
        </svg>
    ),
    visibility: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" /><circle cx="10" cy="10" r="2.5" />
        </svg>
    ),
    content: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 5h12M4 10h12M4 15h8" />
            <path d="M14 13l2 2 4-4" />
        </svg>
    ),
    editorial: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4h12v12H4z" />
            <path d="M7 7h6M7 10h6M7 13h4" />
        </svg>
    ),
    alerts: (
        <svg className="w-[15px] h-[15px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 2L2 16h16L10 2z" /><path d="M10 8v4" /><circle cx="10" cy="14" r="0.8" fill="currentColor" />
        </svg>
    ),
};

function NavGroup({ label, children }) {
    return (
        <div className="space-y-0.5">
            <div className="px-4 pt-5 pb-1.5">
                <span className="text-[9px] font-bold text-white/20 tracking-[0.14em] uppercase">{label}</span>
            </div>
            {children}
        </div>
    );
}

function NavItem({ href, active, icon, children }) {
    return (
        <Link
            href={href}
            className={`group relative flex items-center gap-2.5 px-3 py-[7px] mx-2 rounded-lg transition-all duration-200 text-[12px] font-medium ${
                active
                    ? 'bg-white/[0.06] text-white'
                    : 'text-white/40 hover:bg-white/[0.03] hover:text-white/65'
            }`}
        >
            {active && (
                <motion.div
                    layoutId="sidebar-active-indicator"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[#5b73ff]"
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                />
            )}
            <span className={`shrink-0 transition-colors duration-200 ${active ? 'text-[#7b8fff]' : 'text-white/25 group-hover:text-white/45'}`}>
                {icon}
            </span>
            {children}
        </Link>
    );
}

export default function AdminSidebar({ devBypass = false, devBypassEmail = '' }) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => { setHydrated(true); }, []);
    useEffect(() => { setMobileOpen(false); }, [pathname]);

    const clientId = useMemo(() => {
        const match = pathname?.match(/\/admin\/clients\/([^/]+)/);
        const id = match ? match[1] : null;
        if (id === 'new' || id === 'create' || id === 'onboarding') return null;
        return id;
    }, [pathname]);

    const isDashboard = pathname === '/admin';
    const isClientList = pathname === '/admin/clients' || (pathname?.startsWith('/admin/clients') && !clientId);
    const isNewClient =
        pathname === '/admin/clients/new'
        || pathname === '/admin/clients/create'
        || pathname === '/admin/clients/onboarding';
    const clientBase = clientId ? `/admin/clients/${clientId}` : null;

    const activeView = useMemo(() => {
        if (!clientId) return null;

        const sub = pathname?.replace(`/admin/clients/${clientId}`, '') || '';
        const [seg, nested] = sub.split('/').filter(Boolean);

        if (!seg) return 'dossier';

        if (seg === 'dossier') {
            if (nested === 'audit') {
                const deeper = sub.split('/').filter(Boolean)[2];
                if (deeper === 'comparison') return 'dossier-audit-comparison';
                return 'dossier-audit';
            }
            if (nested === 'activity') return 'dossier-activity';
            if (nested === 'connectors') return 'dossier-connectors';
            if (nested === 'settings') return 'settings';
            return 'dossier';
        }

        if (seg === 'seo') {
            if (nested === 'health') return 'seo-health';
            if (nested === 'correction-prompts') return 'seo-correction-prompts';
            if (nested === 'on-page') return 'seo-on-page';
            if (nested === 'content') return 'seo-content';
            if (nested === 'cannibalization') return 'seo-cannibalization';
            return 'seo-visibility';
        }

        if (seg === 'agent') {
            if (nested === 'visibility') return 'agent-visibility';
            if (nested === 'readiness') return 'agent-readiness';
            if (nested === 'actionability') return 'agent-actionability';
            if (nested === 'protocols') return 'agent-protocols';
            if (nested === 'competitors') return 'agent-competitors';
            if (nested === 'fixes') return 'agent-fixes';
            return 'agent';
        }

        if (seg === 'geo') {
            if (nested === 'runs') return 'runs';
            if (nested === 'prompts') return 'prompts';
            if (nested === 'signals') return 'signals';
            if (nested === 'social') return 'social';
            if (nested === 'opportunities') return 'opportunities';
            if (nested === 'models') return 'models';
            if (nested === 'continuous') return 'continuous';
            if (nested === 'crawlers') return 'geo-crawlers';
            if (nested === 'schema') return 'geo-schema';
            if (nested === 'readiness') return 'geo-readiness';
            if (nested === 'consistency') return 'geo-consistency';
            if (nested === 'alerts') return 'geo-alerts';
            if (nested === 'llms-txt') return 'llms-txt';
            if (nested === 'compare') return 'geo-compare';
            return 'overview';
        }

        if (seg === 'crawlers') return 'geo-crawlers';
        if (seg === 'schema') return 'geo-schema';

        if (seg === 'citations' || seg === 'competitors') return 'signals';
        if (seg === 'social') return 'social';

        return seg;
    }, [pathname, clientId]);

    return (
        <>
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="fixed top-3 left-3 z-30 flex items-center justify-center w-9 h-9 rounded-lg bg-[#090a0b]/90 border border-white/[0.06] text-white/45 hover:bg-white/[0.06] hover:text-white backdrop-blur-sm transition-colors lg:hidden"
                aria-label="Menu"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
                        onClick={() => setMobileOpen(false)}
                    />
                )}
            </AnimatePresence>

            <nav className={`geo-sb ${mobileOpen ? 'open' : ''}`}>
                <div className="px-4 py-4 border-b border-white/[0.05]">
                    <div className="flex items-center justify-between gap-2">
                        <Link
                            href="/admin"
                            className="flex items-center gap-2.5 rounded-lg -mx-1 px-1 py-0.5 transition-colors hover:bg-white/[0.03] min-w-0"
                        >
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5b73ff]/20 to-[#8b5cf6]/10 border border-[#5b73ff]/15 flex items-center justify-center shrink-0">
                                <Image src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" width={16} height={16} sizes="16px" className="w-4 h-4 object-contain" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[13px] font-bold tracking-[-0.03em] text-white leading-none">Trouvable</div>
                                <div className="text-[9px] font-semibold text-[#7b8fff]/60 tracking-[0.08em] uppercase mt-0.5">Commande</div>
                            </div>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            className="p-1 rounded-md text-white/20 hover:text-white hover:bg-white/[0.06] transition-colors lg:hidden"
                            aria-label="Fermer"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto geo-sb-scroll">
                    <div className="py-2 pb-6">
                        <NavGroup label="Supervision">
                            {PORTFOLIO_NAV.map((item) => (
                                <NavItem
                                    key={item.id}
                                    href={item.href}
                                    active={item.id === 'dashboard' ? isDashboard : item.id === 'clients' ? isClientList : isNewClient}
                                    icon={ICONS[item.icon]}
                                >
                                    {item.label}
                                </NavItem>
                            ))}
                        </NavGroup>

                        <AnimatePresence>
                            {hydrated && clientBase && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                    className="overflow-hidden"
                                >
                                    <NavGroup label="Dossier partagé">
                                        {CLIENT_DOSSIER_NAV.map((item) => (
                                            <NavItem
                                                key={item.id}
                                                href={`${clientBase}${item.path}`}
                                                active={activeView === item.id}
                                                icon={ICONS[item.icon]}
                                            >
                                                {item.label}
                                            </NavItem>
                                        ))}
                                    </NavGroup>

                                    <NavGroup label="SEO Ops">
                                        {CLIENT_SEO_NAV.map((item) => (
                                            <NavItem
                                                key={item.id}
                                                href={`${clientBase}${item.path}`}
                                                active={activeView === item.id}
                                                icon={ICONS[item.icon]}
                                            >
                                                {item.label}
                                            </NavItem>
                                        ))}
                                    </NavGroup>

                                    <NavGroup label="GEO Ops">
                                        {CLIENT_GEO_NAV.map((item) => (
                                            <NavItem
                                                key={item.id}
                                                href={`${clientBase}${item.path}`}
                                                active={activeView === item.id}
                                                icon={ICONS[item.icon]}
                                            >
                                                {item.label}
                                            </NavItem>
                                        ))}
                                    </NavGroup>

                                    <NavGroup label="AGENT Ops">
                                        {CLIENT_AGENT_NAV.map((item) => (
                                            <NavItem
                                                key={item.id}
                                                href={`${clientBase}${item.path}`}
                                                active={activeView === item.id}
                                                icon={ICONS[item.icon]}
                                            >
                                                {item.label}
                                            </NavItem>
                                        ))}
                                    </NavGroup>

                                    <NavGroup label="Restitution">
                                        {CLIENT_RESTITUTION_NAV.map((item) => (
                                            <NavItem
                                                key={item.id}
                                                href={`${clientBase}${item.path}`}
                                                active={activeView === item.id}
                                                icon={ICONS[item.icon]}
                                            >
                                                {item.label}
                                            </NavItem>
                                        ))}
                                    </NavGroup>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="border-t border-white/[0.05] p-3 space-y-2">

                    {devBypass ? (
                        <div className="mt-1 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100/85">Mode local</div>
                            <div className="mt-1 truncate text-[11px] font-medium text-white/75">{devBypassEmail || 'dev-admin@localhost'}</div>
                            <p className="mt-1 text-[10px] leading-relaxed text-white/35">
                                Session admin simulée pour vérification locale. Désactivez <code className="text-white/55">DEV_BYPASS_AUTH</code> pour revenir à Clerk.
                            </p>
                        </div>
                    ) : (
                        <AdminSidebarAuthPanel />
                    )}
                </div>
            </nav>
        </>
    );
}

