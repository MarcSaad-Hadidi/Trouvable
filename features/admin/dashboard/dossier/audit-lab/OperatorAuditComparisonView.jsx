'use client';

import Link from 'next/link';

import { useGeoClient } from '@/features/admin/dashboard/shared/context/ClientContext';
import {
    COMMAND_BUTTONS,
    COMMAND_PANEL,
    CommandHeader,
    CommandPageShell,
    cn,
} from '@/features/admin/dashboard/shared/components/command';

import AuditLabComparison from './AuditLabComparison';

/**
 * Page interne opérateur — Comparaison d'audits (route dédiée).
 *
 * Trois modes : actuel vs précédent, actuel vs site externe, site A vs site B (dry-run).
 * La comparaison ne remplace pas le score Trouvable officiel du mandat.
 */
export default function OperatorAuditComparisonView() {
    const context = useGeoClient();
    const { client, audit, clientId } = context || {};
    const dossierAudit = clientId ? `/admin/clients/${clientId}/dossier/audit` : '/admin/clients';

    const header = (
        <CommandHeader
            eyebrow="Audit Trouvable · comparaison"
            title="Comparer deux audits ou deux sites"
            subtitle="Écarts sur les scores Trouvable, SEO, GEO, crawl, dimensions, problèmes et points forts. Lecture décisionnelle — aucune persistance du dry-run ni remplacement du score officiel."
            actions={(
                <>
                    <Link href={dossierAudit} className={COMMAND_BUTTONS.secondary}>
                        Retour à l&apos;audit
                    </Link>
                </>
            )}
        />
    );

    return (
        <CommandPageShell header={header}>
            <div className={cn(COMMAND_PANEL, 'mb-4 border-white/[0.06] bg-[#06070a]/80 px-4 py-3')}>
                <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/35">
                    Utilisation
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                    <span className="text-white/85">Actuel vs précédent</span>
                    {' — '}
                    évolution du mandat.
                    <span className="mx-1.5 text-white/25">·</span>
                    <span className="text-white/85">Actuel vs site externe</span>
                    {' — '}
                    benchmark rapide.
                    <span className="mx-1.5 text-white/25">·</span>
                    <span className="text-white/85">Site A vs Site B</span>
                    {' — '}
                    deux URLs en dry-run (rien n&apos;est enregistré).
                </p>
            </div>

            <AuditLabComparison
                clientId={clientId}
                currentAudit={audit}
                defaultUrl={client?.website_url}
                omitSectionHeader
            />
        </CommandPageShell>
    );
}
