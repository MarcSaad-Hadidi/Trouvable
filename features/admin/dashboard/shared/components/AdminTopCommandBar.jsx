'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useState, useEffect } from 'react';

function useCurrentTime() {
    const [time, setTime] = useState(null);
    useEffect(() => {
        setTime(new Date());
        const id = setInterval(() => setTime(new Date()), 30000);
        return () => clearInterval(id);
    }, []);
    return time;
}

export default function AdminTopCommandBar() {
    const pathname = usePathname();
    const time = useCurrentTime();

    const context = useMemo(() => {
        if (pathname === '/admin/clients' || pathname === '/admin/clients/')
            return { label: 'Portefeuille', section: 'supervision', sectionLabel: 'Supervision' };
        if (pathname?.startsWith('/admin/clients/new') || pathname?.startsWith('/admin/clients/create') || pathname?.startsWith('/admin/clients/onboarding'))
            return { label: 'Nouveau mandat', section: 'onboarding', sectionLabel: 'Supervision' };

        const clientMatch = pathname?.match(/\/admin\/clients\/([^/]+)/);
        if (clientMatch) {
            const parts = pathname.replace(`/admin/clients/${clientMatch[1]}`, '').split('/').filter(Boolean);
            const [sub, nested] = parts;

            if (sub === 'seo') {
                const seoMap = {
                    visibility: { label: 'Visibilité SEO', section: 'seo', sectionLabel: 'SEO Ops' },
                    health: { label: 'Santé SEO', section: 'seo', sectionLabel: 'SEO Ops' },
                    'correction-prompts': { label: 'Prompts correction IA', section: 'seo', sectionLabel: 'SEO Ops' },
                    'on-page': { label: 'Optimisation on-page', section: 'seo', sectionLabel: 'SEO Ops' },
                    content: { label: 'Contenu SEO', section: 'seo', sectionLabel: 'SEO Ops' },
                    cannibalization: { label: 'Cannibalisation SEO', section: 'seo', sectionLabel: 'SEO Ops' },
                };

                return seoMap[nested || 'visibility'] || { label: 'SEO Ops', section: 'seo', sectionLabel: 'SEO Ops' };
            }

            if (sub === 'geo') {
                const geoMap = {
                    undefined: { label: 'Situation GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                    crawlers: { label: 'Crawlers IA', section: 'geo', sectionLabel: 'GEO Ops' },
                    schema: { label: 'Schema & entité', section: 'geo', sectionLabel: 'GEO Ops' },
                    readiness: { label: 'Préparation GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                    runs: { label: 'Exécutions GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                    prompts: { label: 'Requêtes GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                    signals: { label: 'Signaux GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                    social: { label: 'Veille sociale', section: 'geo', sectionLabel: 'GEO Ops' },
                    opportunities: { label: "File d'actions", section: 'geo', sectionLabel: 'GEO Ops' },
                    models: { label: 'Fiabilité IA', section: 'geo', sectionLabel: 'GEO Ops' },
                    continuous: { label: 'Suivi continu', section: 'geo', sectionLabel: 'GEO Ops' },
                    compare: { label: 'GEO Compare', section: 'geo', sectionLabel: 'GEO Ops' },
                    'llms-txt': { label: 'llms.txt', section: 'geo', sectionLabel: 'GEO Ops' },
                    alerts: { label: 'Alertes GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                };

                return geoMap[nested] || geoMap.undefined;
            }

            const map = {
                dossier: nested === 'activity' ? { label: 'Activité du dossier', section: 'shared', sectionLabel: 'Dossier partagé' }
                    : nested === 'connectors' ? { label: 'Connecteurs du dossier', section: 'shared', sectionLabel: 'Dossier partagé' }
                    : { label: 'Dossier partagé', section: 'shared', sectionLabel: 'Dossier partagé' },
                overview: { label: 'Situation GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                crawlers: { label: 'Crawlers IA', section: 'geo', sectionLabel: 'GEO Ops' },
                schema: { label: 'Schema & entité', section: 'geo', sectionLabel: 'GEO Ops' },
                runs: { label: 'Exécutions GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                audit: { label: 'Santé SEO', section: 'seo', sectionLabel: 'SEO Ops' },
                signals: { label: 'Signaux GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                social: { label: 'Veille communautaire', section: 'geo', sectionLabel: 'GEO Ops' },
                opportunities: { label: 'File d\'actions', section: 'geo', sectionLabel: 'GEO Ops' },
                portal: { label: 'Restitution', section: 'shared', sectionLabel: 'Dossier partagé' },
                settings: { label: 'Paramètres mandat', section: 'shared', sectionLabel: 'Dossier partagé' },
                'geo-compare': { label: 'GEO Compare', section: 'geo', sectionLabel: 'GEO Ops' },
                prompts: { label: 'Requêtes GEO', section: 'geo', sectionLabel: 'GEO Ops' },
                visibility: { label: 'Visibilité SEO', section: 'seo', sectionLabel: 'SEO Ops' },
                continuous: { label: 'Suivi continu', section: 'geo', sectionLabel: 'GEO Ops' },
                'llms-txt': { label: 'llms.txt', section: 'geo', sectionLabel: 'GEO Ops' },
                models: { label: 'Fiabilité IA', section: 'geo', sectionLabel: 'GEO Ops' },
                edit: { label: 'Édition', section: 'shared', sectionLabel: 'Dossier partagé' },
            };
            return map[sub] || { label: 'Pilotage mission', section: 'shared', sectionLabel: 'Dossier partagé' };
        }
        return { label: 'Centre de commande', section: 'home', sectionLabel: 'Supervision' };
    }, [pathname]);

    const sectionClasses = {
        shared: 'border-white/[0.08] bg-white/[0.04] text-white/70',
        seo: 'border-sky-400/20 bg-sky-400/12 text-sky-100',
        geo: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
        onboarding: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
        supervision: 'border-white/[0.08] bg-white/[0.03] text-white/55',
        home: 'border-white/[0.08] bg-white/[0.03] text-white/55',
    };

    const dotClasses = {
        shared: 'bg-white/40',
        seo: 'bg-sky-400',
        geo: 'bg-violet-400',
        onboarding: 'bg-amber-400',
        supervision: 'bg-white/30',
        home: 'bg-white/30',
    };

    const mobileLabelMap = {
        'Dossier partagé': 'Dossier',
        'Activité du dossier': 'Activité',
        'Connecteurs du dossier': 'Connecteurs',
        'Paramètres mandat': 'Paramètres',
        Restitution: 'Restitution',
        'Pilotage mission': 'Mission',
    };

    const mobileLabel = mobileLabelMap[context.label] || context.label;

    return (
        <div className="cmd-topbar">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className={`w-1.5 h-1.5 rounded-full cmd-health-dot shrink-0 ${dotClasses[context.section] || dotClasses.home}`} />
                <span className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${sectionClasses[context.section] || sectionClasses.home}`}>
                    {context.sectionLabel || 'Supervision'}
                </span>
                <span className="sm:hidden text-[10px] font-semibold text-white/55 tracking-wide leading-none min-w-0">
                    {mobileLabel}
                </span>
                <span className="hidden sm:block text-[11px] font-semibold text-white/55 truncate tracking-wide min-w-0">
                    {context.label}
                </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
                {time && (
                    <span className="text-[10px] font-mono text-white/20 tabular-nums hidden sm:block">
                        {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                )}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.025] border border-white/[0.05]">
                    <div className={`w-1.5 h-1.5 rounded-full ${dotClasses[context.section] || dotClasses.home}`} />
                    <span className="text-[9px] font-bold text-white/35 uppercase tracking-[0.08em]">Vue opérateur</span>
                </div>
            </div>
        </div>
    );
}

