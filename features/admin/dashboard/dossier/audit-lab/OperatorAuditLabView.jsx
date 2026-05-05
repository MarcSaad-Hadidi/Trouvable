'use client';

import Link from 'next/link';

import { useGeoClient } from '@/features/admin/dashboard/shared/context/ClientContext';
import {
    COMMAND_BUTTONS,
    CommandHeader,
    CommandPageShell,
} from '@/features/admin/dashboard/shared/components/command';

import AuditLabBenchmark from './AuditLabBenchmark';
import AuditLabCanonical from './AuditLabCanonical';
import AuditLabGeoScan from './AuditLabGeoScan';
import AuditLabLayer2Diagnostic from './AuditLabLayer2Diagnostic';
import AuditLabRunner from './AuditLabRunner';
import AuditLabSeoGeoInterpretation from './AuditLabSeoGeoInterpretation';
import AuditLabStableResult from './AuditLabStableResult';

const SECTION_NAV = [
    { id: 'audit-runner', label: 'Lancer' },
    { id: 'audit-section-a', label: 'A · Trouvable' },
    { id: 'audit-section-b', label: 'B · SEO vs GEO' },
    { id: 'audit-section-c', label: 'C · Scan brut' },
    { id: 'audit-section-d', label: 'D · Experts' },
    { id: 'audit-section-e', label: 'E · Normalisée' },
    { id: 'audit-section-f', label: 'F · Débogage' },
];

/**
 * Page interne opérateur — Audit Trouvable.
 *
 * Architecture d'information (après le split de la comparaison) :
 *
 *   Runner  — lancer un audit manuel.
 *   A.      — Résultat final Trouvable (vérité produit communiquée au client).
 *   B.      — Lecture SEO vs GEO.
 *   C.      — Scan GEO brut (console diagnostique couche 1).
 *   D.      — Enrichissements experts GEO (diagnostic couche 2).
 *   E.      — Vérité normalisée (objet interne couches 3–4).
 *   F.      — Débogage (timings, payload brut).
 *
 * Règle non négociable : la Section A est la seule vérité partagée avec le
 * client.
 */
export default function OperatorAuditLabView() {
    const context = useGeoClient();
    const { client, audit, clientId, refetch } = context || {};
    const geoBase = clientId ? `/admin/clients/${clientId}/geo` : '/admin/clients';
    const dossierBase = clientId ? `/admin/clients/${clientId}/dossier` : '/admin/clients';

    const header = (
        <CommandHeader
            eyebrow="Audit Trouvable · espace opérateur"
            title="Audit du mandat"
            subtitle="Lancez un audit, lisez le résultat Trouvable final, puis descendez dans l’interprétation SEO vs GEO et les diagnostics techniques si besoin. Un seul score fait foi pour le client : le score Trouvable de la Section A."
            actions={(
                <>
                    <Link href="#audit-runner" className={COMMAND_BUTTONS.primary}>
                        Lancer un audit
                    </Link>
                    <Link href={`${geoBase}/opportunities`} className={COMMAND_BUTTONS.secondary}>
                        File d’opportunités
                    </Link>
                    <Link href={`${dossierBase}/audit/comparison`} className={COMMAND_BUTTONS.subtle}>
                        Comparaison audits
                    </Link>
                    <Link href={dossierBase} className={COMMAND_BUTTONS.subtle}>
                        Vue dossier
                    </Link>
                </>
            )}
        />
    );

    return (
        <CommandPageShell header={header}>
            <nav
                aria-label="Sections de l’audit"
                className="sticky top-2 z-20 -mx-2 overflow-x-auto rounded-full border border-white/[0.06] bg-[rgba(10,12,16,0.72)] px-2 py-1.5 backdrop-blur-md"
            >
                <ul className="flex items-center gap-1 whitespace-nowrap">
                    {SECTION_NAV.map((item) => (
                        <li key={item.id}>
                            <a
                                href={`#${item.id}`}
                                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
                            >
                                {item.label}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
                    Comment lire cette page
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-white/60">
                    <span className="text-white/85">A. Résultat Trouvable</span> : vérité produit partagée avec le client.
                    <span className="mx-1 text-white/20">·</span>
                    <span className="text-white/80">B. Lecture SEO vs GEO</span> : pourquoi chaque côté est haut ou bas.
                    <span className="mx-1 text-white/20">·</span>
                    <span className="text-white/70">C. Scan GEO brut</span> : console diagnostique sur le crawl et les contrôles.
                    <span className="mx-1 text-white/20">·</span>
                    <span className="text-white/70">D. Enrichissements experts</span> : modules IA, marque, confiance.
                    <span className="mx-1 text-white/20">·</span>
                    <span className="text-white/55">E. Vérité normalisée</span> : objet interne technique.
                    <span className="mx-1 text-white/20">·</span>
                    <span className="text-white/50">F. Débogage</span> : timings &amp; payload.
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/45">
                    Les scores des sections B, C, D et E sont des lectures internes — elles n’écrasent jamais le score Trouvable de la Section A.
                </p>
            </div>

            <section id="audit-runner" className="scroll-mt-24">
                <AuditLabRunner
                    clientId={clientId}
                    clientName={client?.client_name}
                    defaultUrl={client?.website_url}
                    latestAuditAt={audit?.created_at}
                    onRunComplete={refetch}
                />
            </section>

            <section id="audit-section-a" className="scroll-mt-24">
                <AuditLabStableResult audit={audit} clientId={clientId} />
            </section>

            <section id="audit-section-b" className="scroll-mt-24">
                <AuditLabSeoGeoInterpretation audit={audit} />
            </section>

            <section id="audit-section-c" className="scroll-mt-24">
                <AuditLabGeoScan audit={audit} clientId={clientId} />
            </section>

            <section id="audit-section-d" className="scroll-mt-24">
                <AuditLabLayer2Diagnostic audit={audit} clientId={clientId} />
            </section>

            <section id="audit-section-e" className="scroll-mt-24">
                <AuditLabCanonical audit={audit} />
            </section>

            <section id="audit-section-f" className="scroll-mt-24">
                <AuditLabBenchmark audit={audit} />
            </section>
        </CommandPageShell>
    );
}
