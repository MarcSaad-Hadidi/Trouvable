'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import { useGeoClient } from '@/features/admin/dashboard/shared/context/ClientContext';
import { cn } from '@/features/admin/dashboard/shared/components/command';

export default function CommandStrip() {
    const pathname = usePathname();
    const { client } = useGeoClient() || {}; // Optional context if we're in a client route

    const { worldLabel, pageLabel, worldTone } = useMemo(() => {
        if (!pathname) return { worldLabel: 'Portfolio', pageLabel: 'Centre de commande', worldTone: 'neutral' };

        if (pathname === '/admin/clients') return { worldLabel: 'Portfolio', pageLabel: 'Portefeuille', worldTone: 'neutral' };
        if (pathname === '/admin') return { worldLabel: 'Portfolio', pageLabel: 'Cockpit', worldTone: 'neutral' };

        const clientMatch = pathname.match(/\/admin\/clients\/[^/]+/);
        if (clientMatch) {
            const sub = pathname.replace(clientMatch[0], '');
            
            if (sub.startsWith('/seo')) {
                const map = {
                    '/seo': 'Vue SEO',
                    '/seo/visibility': 'Visibilité organique',
                    '/seo/health': 'Santé SEO',
                    '/seo/on-page': 'Inspecteur on-page',
                    '/seo/content': 'Matrice contenu',
                    '/seo/cannibalization': 'Cannibalisation',
                    '/seo/opportunities': 'Opportunités SEO',
                    '/seo/correction-prompts': 'Prompts correction',
                    '/seo/local': 'Préparation locale'
                };
                return { worldLabel: 'SEO Ops', pageLabel: map[sub] || 'SEO Ops', worldTone: 'seo' };
            }

            if (sub.startsWith('/geo')) {
                const map = {
                    '/geo': 'GEO Situation',
                    '/geo/crawlers': 'Crawlers IA',
                    '/geo/schema': 'Schema & entité',
                    '/geo/consistency': 'Cohérence marque',
                    '/geo/signals': 'Sources & Citations',
                    '/geo/social': 'Intelligence sociale',
                    '/geo/readiness': 'Préparation GEO',
                    '/geo/alerts': 'Alertes GEO',
                    '/geo/opportunities': 'Actions GEO',
                    '/geo/compare': 'Comparaison fournisseurs',
                    '/geo/prompts': 'Prompts',
                    '/geo/runs': 'Exécutions',
                    '/geo/llms-txt': 'llms.txt',
                    '/geo/models': 'Fiabilité modèles',
                    '/geo/continuous': 'Surveillance',
                };
                return { worldLabel: 'GEO Ops', pageLabel: map[sub] || 'GEO Ops', worldTone: 'geo' };
            }

            if (sub.startsWith('/agent')) {
                const map = {
                    '/agent': 'Vue Agent',
                    '/agent/visibility': 'Visibilité Agent',
                    '/agent/readiness': 'Préparation Agent',
                    '/agent/actionability': 'Actionnabilité',
                    '/agent/protocols': 'Protocoles',
                    '/agent/competitors': 'Concurrents Agent',
                    '/agent/fixes': 'Correctifs Agent',
                };
                return { worldLabel: 'Agent Ops', pageLabel: map[sub] || 'Agent Ops', worldTone: 'agent' };
            }

            // Dossier
            const map = {
                '/dossier': 'Fiche mandat',
                '/dossier/activity': 'Journal',
                '/dossier/connectors': 'Sources',
                '/dossier/audit': 'Audit / Evidence',
                '/portal': 'Restitution',
                '/dossier/settings': 'Paramètres',
            };
            return { worldLabel: 'Dossier partagé', pageLabel: map[sub] || "Vue d'ensemble", worldTone: 'shared' };
        }

        return { worldLabel: 'Portfolio', pageLabel: 'Page', worldTone: 'neutral' };
    }, [pathname]);

    // Accent mappings for breadcrumbs
    const accentColors = {
        seo: 'text-[#6b9cc5]',
        geo: 'text-[#7c6aef]',
        agent: 'text-[#d4874a]',
        shared: 'text-white/60',
        neutral: 'text-white/60'
    };

    return (
        <div className="flex h-[var(--strip-h)] shrink-0 items-center justify-between border-b border-white/[0.05] bg-[#080808]/80 px-4 backdrop-blur-md sticky top-0 z-30">
            {/* Left: Breadcrumb */}
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide">
                <span className={accentColors[worldTone]}>{worldLabel}</span>
                <span className="text-white/20">/</span>
                <span className="text-white/80">{pageLabel}</span>
            </div>

            {/* Center: Client Name (if applicable) */}
            {client && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 hidden md:flex">
                    <span className="text-[12px] font-medium text-white/60">{client.client_name}</span>
                    <div className={cn(
                        "h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]",
                        client.attention === 'critical' ? 'bg-[#e06060] text-[#e06060]' :
                        client.attention === 'needs_attention' ? 'bg-[#d4a34a] text-[#d4a34a]' : 'bg-[#4ade80] text-[#4ade80]'
                    )} />
                </div>
            )}

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center rounded-md border border-white/[0.06] bg-white/[0.02] p-0.5 text-[10px] font-medium text-white/50">
                    <button className="rounded px-2 py-1 hover:text-white transition-colors">7j</button>
                    <button className="rounded bg-white/[0.06] px-2 py-1 text-white shadow-sm">30j</button>
                    <button className="rounded px-2 py-1 hover:text-white transition-colors">90j</button>
                </div>

                <div className="h-4 w-px bg-white/[0.08] mx-1 hidden sm:block" />

                <button className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 hover:bg-white/[0.06] hover:text-white transition-colors" aria-label="Rafraîchir">
                    <RefreshCw className="h-3.5 w-3.5" />
                </button>

                <button className="flex h-7 items-center gap-2 rounded-md border border-white/[0.08] bg-[#131319] pl-2 pr-1.5 text-[10px] text-white/40 hover:border-white/[0.15] hover:text-white transition-all">
                    <Search className="h-3 w-3" />
                    <span>Rechercher...</span>
                    <span className="rounded bg-white/[0.06] px-1 py-0.5 font-mono text-[9px]">⌘K</span>
                </button>
            </div>
        </div>
    );
}
