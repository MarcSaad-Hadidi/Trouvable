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

const SERVICE_META = {
    shared: { label: 'Dossier', chip: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
    seo: { label: 'Visibilite Google / SEO', chip: 'border-blue-200 bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
    geo: { label: 'Visibilite IA / GEO', chip: 'border-violet-200 bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
    agent: { label: 'Agent', chip: 'border-orange-200 bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
    onboarding: { label: 'Supervision', chip: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
    supervision: { label: 'Supervision', chip: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
    home: { label: 'Supervision', chip: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
};

function resolveContext(pathname) {
    if (pathname === '/admin/clients' || pathname === '/admin/clients/') {
        return { label: 'Clients', section: 'supervision' };
    }
    if (pathname?.startsWith('/admin/clients/new') || pathname?.startsWith('/admin/clients/create') || pathname?.startsWith('/admin/clients/onboarding')) {
        return { label: 'Nouveau mandat', section: 'onboarding' };
    }

    const clientMatch = pathname?.match(/\/admin\/clients\/([^/]+)/);
    if (!clientMatch) return { label: 'Centre de commande', section: 'home' };

    const parts = pathname.replace(`/admin/clients/${clientMatch[1]}`, '').split('/').filter(Boolean);
    const [sub, nested] = parts;

    if (sub === 'seo') {
        const labels = {
            visibility: 'Visibilite Google / SEO',
            health: 'Sante technique',
            'correction-prompts': 'Prompts correction IA',
            'on-page': 'Optimisation on-page',
            content: 'Inventaire contenu',
            cannibalization: 'Cannibalisation SEO',
        };
        return { label: labels[nested || 'visibility'] || 'Visibilite Google / SEO', section: 'seo' };
    }

    if (sub === 'geo') {
        const labels = {
            crawlers: 'Crawlers IA',
            schema: 'Schema & entite',
            readiness: 'Preparation GEO',
            consistency: 'Coherence marque',
            alerts: 'Alertes GEO',
            runs: 'Executions GEO',
            prompts: 'Prompts',
            compare: 'Provider compare',
            signals: 'Sources & citations',
            social: 'Veille sociale',
            opportunities: "File d'actions",
            'llms-txt': 'llms.txt',
            models: 'Fiabilite IA',
            continuous: 'Monitoring',
        };
        return { label: labels[nested] || 'Visibilite IA / GEO', section: 'geo' };
    }

    if (sub === 'agent') {
        const labels = {
            visibility: 'Visibilite Agent',
            readiness: 'Readiness Agent',
            actionability: 'Actionability Agent',
            protocols: 'Protocoles Agent',
            competitors: 'Competiteurs Agent',
            fixes: 'Correctifs Agent',
        };
        return { label: labels[nested] || 'Agent', section: 'agent' };
    }

    if (sub === 'dossier') {
        if (nested === 'activity') return { label: 'Activite du dossier', section: 'shared' };
        if (nested === 'connectors') return { label: 'Connecteurs', section: 'shared' };
        if (nested === 'settings') return { label: 'Settings', section: 'shared' };
        return { label: 'Client Overview / Dossier', section: 'shared' };
    }

    return { label: 'Client Overview / Dossier', section: 'shared' };
}

function StatusChip({ tone, label }) {
    const classes = {
        neutral: 'border-slate-200 bg-slate-50 text-slate-600',
        warning: 'border-amber-200 bg-amber-50 text-amber-700',
        info: 'border-blue-200 bg-blue-50 text-blue-700',
    };

    return (
        <span className={`hidden items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:inline-flex ${classes[tone] || classes.neutral}`}>
            {label}
        </span>
    );
}

export default function AdminTopCommandBar() {
    const pathname = usePathname();
    const time = useCurrentTime();
    const context = useMemo(() => resolveContext(pathname), [pathname]);
    const service = SERVICE_META[context.section] || SERVICE_META.home;

    return (
        <div className="cmd-topbar">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${service.dot}`} />
                <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${service.chip}`}>
                    {service.label}
                </span>
                <span className="hidden min-w-0 truncate text-[11px] font-semibold text-slate-500 sm:block">
                    {context.label}
                </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
                <StatusChip tone="info" label="Mode apercu" />
                <StatusChip tone="warning" label="Donnees partielles" />
                <StatusChip tone="neutral" label="Derniere collecte inconnue" />
                <span className="hidden rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 md:inline-flex">
                    30 derniers jours
                </span>
                {time ? (
                    <span className="hidden text-[10px] font-mono text-slate-400 tabular-nums sm:block">
                        {time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
