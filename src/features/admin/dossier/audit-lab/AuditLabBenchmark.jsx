'use client';

import { useState } from 'react';

import {
    JsonInspect,
    LabCollapsible,
    LabDebugSection,
    LabMetric,
    LabPill,
    LabSectionHeader,
} from './LabPrimitives';
import { formatDate, formatMs, getBenchmarkViewModel } from './audit-lab-model';
import { scanStatusFr } from './audit-lab-copy';

function TimingRow({ timing }) {
    const isError = timing?.status === 'error';
    return (
        <div className={`flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${isError ? 'border-red-400/15 bg-red-400/[0.03]' : 'border-white/[0.04] bg-white/[0.015]'}`}>
            <span className={`truncate font-mono text-[11px] ${isError ? 'text-red-300/80' : 'text-white/60'}`}>{timing.step || 'étape'}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/80">{formatMs(timing.duration_ms ?? timing.ms ?? timing.duration)}</span>
        </div>
    );
}

/**
 * Section 6 — Benchmark & debug (collapsed by default).
 *
 * Operator-only validation surface: audit version, persistence status, timings,
 * raw audit row. Never displayed as product truth.
 */
export default function AuditLabBenchmark({ audit }) {
    const [open, setOpen] = useState(false);

    if (!audit) return null;

    const model = getBenchmarkViewModel(audit);
    const persistenceLabel = model.hasCanonical
        ? 'Structure normalisée enregistrée'
        : 'Structure normalisée absente (mode ombre ou audit hérité)';
    const persistenceTone = model.hasCanonical ? 'good' : 'warn';

    return (
        <LabDebugSection>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex w-full items-start justify-between gap-3 text-left"
            >
                <div>
                    <LabSectionHeader
                        eyebrow="Section G · Débogage & benchmark"
                        title="Informations techniques d'exécution"
                        subtitle="Données réservées à l'opérateur : version d'audit, statut, durées par étape, payload brut. À ne pas communiquer au client."
                        variant="debug"
                    />
                </div>
                <span className={`mt-1 shrink-0 text-sm text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
            </button>

            {open && (
                <div className="mt-2 space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <LabMetric label="Version d'audit" value={model.auditVersion || '—'} />
                        <LabMetric label="Statut" value={scanStatusFr(model.scanStatus) || '—'} />
                        <LabMetric label="Identifiant" value={model.auditId ? `${model.auditId.slice(0, 8)}…` : '—'} />
                        <LabMetric label="Créé le" value={formatDate(model.createdAt)} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <LabPill label={persistenceLabel} tone={persistenceTone} />
                        {model.engineId && <LabPill label={`Moteur : ${model.engineId}`} />}
                    </div>

                    {(model.sourceUrl || model.resolvedUrl) && (
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3 text-[11px] text-white/60">
                            <div className="truncate font-mono" title={model.sourceUrl}>URL source : {model.sourceUrl || '—'}</div>
                            <div className="truncate font-mono" title={model.resolvedUrl}>URL résolue : {model.resolvedUrl || '—'}</div>
                        </div>
                    )}

                    {model.errorMessage && (
                        <div className="rounded-lg border border-red-400/20 bg-red-400/[0.05] p-3 text-[11px] text-red-300">
                            {model.errorMessage}
                        </div>
                    )}

                    {Array.isArray(model.timings) && model.timings.length > 0 && (
                        <div className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Durée par étape (enregistrée)</div>
                            <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-3">
                                {model.timings.map((timing, idx) => (
                                    <TimingRow key={`${timing.step || 'step'}-${idx}`} timing={timing} />
                                ))}
                            </div>
                        </div>
                    )}

                    <LabCollapsible label="Données brutes de l'audit (base de données)" hint="Réservé à la validation opérateur">
                        <JsonInspect value={audit} maxHeight={520} />
                    </LabCollapsible>
                </div>
            )}
        </LabDebugSection>
    );
}
