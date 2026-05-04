'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { cn } from '@/features/admin/dashboard/shared/components/command';

const DOSSIER_LINKS = [
    { id: 'overview', label: "Vue d'ensemble", path: '/geo' },
    { id: 'dossier', label: 'Dossier', path: '/dossier' },
    { id: 'journal', label: 'Journal', path: '/dossier/activity' },
    { id: 'sources', label: 'Sources', path: '/dossier/connectors' },
    { id: 'audit', label: 'Audit / Evidence', path: '/dossier/audit' },
    { id: 'portal', label: 'Portal', path: '/portal' },
    { id: 'settings', label: 'Paramètres', path: '/dossier/settings' },
];

const SEO_GROUPS = [
    {
        label: 'Observe',
        items: [
            { id: 'vue-seo', label: 'Vue SEO', path: '/seo' },
            { id: 'seo-visibility', label: 'Visibilité organique', path: '/seo/visibility' },
        ]
    },
    {
        label: 'Analyze',
        items: [
            { id: 'seo-health', label: 'Santé SEO', path: '/seo/health' },
            { id: 'seo-on-page', label: 'Inspecteur on-page', path: '/seo/on-page' },
            { id: 'seo-content', label: 'Matrice contenu', path: '/seo/content' },
            { id: 'seo-cannibalization', label: 'Cannibalisation', path: '/seo/cannibalization' },
        ]
    },
    {
        label: 'Act',
        items: [
            { id: 'seo-opportunities', label: 'Opportunités SEO', path: '/seo/opportunities' },
            { id: 'seo-correction-prompts', label: 'Prompts correction', path: '/seo/correction-prompts' },
            { id: 'seo-local', label: 'Préparation locale', path: '/seo/local' },
        ]
    }
];

const GEO_GROUPS = [
    {
        label: 'Observe',
        items: [
            { id: 'geo-situation', label: 'GEO Situation', path: '/geo' },
            { id: 'geo-models', label: 'Fiabilité modèles', path: '/geo/models' },
            { id: 'geo-continuous', label: 'Surveillance', path: '/geo/continuous' },
        ]
    },
    {
        label: 'Analyze',
        items: [
            { id: 'geo-crawlers', label: 'Crawlers IA', path: '/geo/crawlers' },
            { id: 'geo-schema', label: 'Schema & entité', path: '/geo/schema' },
            { id: 'geo-consistency', label: 'Cohérence marque', path: '/geo/consistency' },
            { id: 'geo-sources', label: 'Sources & Citations', path: '/geo/signals' },
            { id: 'geo-social', label: 'Intelligence sociale', path: '/geo/social' },
        ]
    },
    {
        label: 'Act',
        items: [
            { id: 'geo-readiness', label: 'Préparation GEO', path: '/geo/readiness' },
            { id: 'geo-alerts', label: 'Alertes GEO', path: '/geo/alerts' },
            { id: 'geo-actions', label: 'Actions GEO', path: '/geo/opportunities' },
            { id: 'geo-compare', label: 'Comparaison fournisseurs', path: '/geo/compare' },
        ]
    },
    {
        label: 'Configure',
        items: [
            { id: 'geo-prompts', label: 'Prompts', path: '/geo/prompts' },
            { id: 'geo-runs', label: 'Exécutions', path: '/geo/runs' },
            { id: 'geo-llms-txt', label: 'llms.txt', path: '/geo/llms-txt' },
        ]
    }
];

const AGENT_GROUPS = [
    {
        label: 'Observe',
        items: [
            { id: 'agent-vue', label: 'Vue Agent', path: '/agent' },
            { id: 'agent-visibility', label: 'Visibilité Agent', path: '/agent/visibility' },
        ]
    },
    {
        label: 'Analyze',
        items: [
            { id: 'agent-readiness', label: 'Préparation Agent', path: '/agent/readiness' },
            { id: 'agent-actionability', label: 'Actionnabilité', path: '/agent/actionability' },
            { id: 'agent-protocols', label: 'Protocoles', path: '/agent/protocols' },
            { id: 'agent-competitors', label: 'Concurrents Agent', path: '/agent/competitors' },
        ]
    },
    {
        label: 'Act',
        items: [
            { id: 'agent-fixes', label: 'Correctifs Agent', path: '/agent/fixes' },
        ]
    }
];

function NavLink({ href, active, children }) {
    return (
        <Link
            href={href}
            className={cn(
                "group flex items-center px-3 py-1.5 mx-2 rounded-[8px] transition-all duration-200 text-[12.5px] font-medium leading-relaxed",
                active 
                    ? "bg-[var(--service-accent-bg)] text-[var(--service-accent)] font-semibold" 
                    : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
            )}
        >
            {active && (
                <div className="absolute left-3 w-[2.5px] h-[14px] rounded-r-full bg-[var(--service-accent)]" />
            )}
            <span className={cn(active && "ml-2")}>{children}</span>
        </Link>
    );
}

function NavGroup({ label, items, activePath, clientBase }) {
    return (
        <div className="mb-6">
            <div className="px-5 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/25">
                {label}
            </div>
            <div className="flex flex-col gap-0.5">
                {items.map(item => (
                    <NavLink 
                        key={item.id} 
                        href={`${clientBase}${item.path}`}
                        active={activePath === item.path || (activePath === '/' && item.path === '/geo')}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </div>
        </div>
    );
}

export default function AdminTray({ client }) {
    const pathname = usePathname();

    const { activeWorld, activePath } = useMemo(() => {
        if (!client) return { activeWorld: null, activePath: null };
        const sub = pathname?.replace(`/admin/clients/${client.id}`, '') || '';
        
        let world = 'dossier';
        if (sub.startsWith('/seo')) world = 'seo';
        else if (sub.startsWith('/geo')) world = 'geo';
        else if (sub.startsWith('/agent')) world = 'agent';
        
        return { activeWorld: world, activePath: sub || '/' };
    }, [pathname, client]);

    if (!client) return null;

    const clientBase = `/admin/clients/${client.id}`;
    
    // Determine world styling
    let accentToken = 'var(--t-violet)';
    let bgToken = 'var(--t-violet-bg)';
    
    if (activeWorld === 'seo') {
        accentToken = 'var(--t-steel)';
        bgToken = 'var(--t-steel-bg)';
    } else if (activeWorld === 'agent') {
        accentToken = 'var(--t-orange)';
        bgToken = 'var(--t-orange-bg)';
    }

    let worldGroups = [];
    if (activeWorld === 'seo') worldGroups = SEO_GROUPS;
    else if (activeWorld === 'geo') worldGroups = GEO_GROUPS;
    else if (activeWorld === 'agent') worldGroups = AGENT_GROUPS;

    return (
        <aside 
            className="hidden lg:flex w-[var(--tray-w)] flex-col border-r border-white/[0.05] bg-[#080808] pt-4"
            style={{
                '--service-accent': accentToken,
                '--service-accent-bg': bgToken,
            }}
        >
            {/* Client Context Pill */}
            <div className="px-4 mb-6">
                <div className="flex items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-[#131319] p-2.5">
                    <div className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        client.attention === 'critical' ? 'bg-[#e06060]' :
                        client.attention === 'needs_attention' ? 'bg-[#d4a34a]' : 'bg-[#4ade80]'
                    )} />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold text-white/90">
                            {client.client_name}
                        </div>
                        <div className="truncate text-[10px] uppercase tracking-wider text-white/35 mt-0.5">
                            {client.lifecycle_status === 'prospect' ? 'Prospect' : 'Mandat Actif'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto geo-scrollbar pb-6">
                {/* Dossier Links Always Visible */}
                <div className="mb-6">
                    <div className="flex flex-col gap-0.5">
                        {DOSSIER_LINKS.map(item => (
                            <NavLink 
                                key={item.id} 
                                href={`${clientBase}${item.path}`}
                                active={activePath === item.path}
                            >
                                {item.label}
                            </NavLink>
                        ))}
                    </div>
                </div>

                {/* World Specific Links */}
                {worldGroups.map((group, idx) => (
                    <NavGroup 
                        key={idx} 
                        label={group.label} 
                        items={group.items} 
                        activePath={activePath} 
                        clientBase={clientBase} 
                    />
                ))}
            </div>
        </aside>
    );
}
