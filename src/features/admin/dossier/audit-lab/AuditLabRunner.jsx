'use client';

import { useEffect, useState } from 'react';

import { LabCollapsible, LabPill, LabSectionHeader } from './LabPrimitives';
import { formatDate, formatMs } from './audit-lab-model';

/**
 * Section 1 — on-demand audit runner.
 *
 * Calls the canonical `POST /api/admin/audits/run` endpoint (no new backend
 * contract) and surfaces the rich response payload (auditId, elapsedMs,
 * stepTimings). Pipeline mode indicator is sourced from
 * `GET /api/admin/audit/runtime-config` so operators know when the layered
 * pipeline is shadowed or fully active without inspecting environment.
 */
export default function AuditLabRunner({ clientId, clientName, defaultUrl, onRunComplete, latestAuditAt }) {
    const [scanUrl, setScanUrl] = useState(defaultUrl || '');
    const [running, setRunning] = useState(false);
    const [runError, setRunError] = useState(null);
    const [lastRun, setLastRun] = useState(null);
    const [runtime, setRuntime] = useState(null);
    const [runtimeError, setRuntimeError] = useState(null);

    const [previousDefaultUrl, setPreviousDefaultUrl] = useState(defaultUrl);
    if (previousDefaultUrl !== defaultUrl) {
        setPreviousDefaultUrl(defaultUrl);
        if (defaultUrl) setScanUrl(defaultUrl);
    }

    useEffect(() => {
        let cancelled = false;
        fetch('/api/admin/audit/runtime-config', { cache: 'no-store' })
            .then(async (response) => {
                const json = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
                if (!cancelled) setRuntime(json);
            })
            .catch((error) => {
                if (!cancelled) setRuntimeError(error.message || 'Erreur de configuration');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function handleRun() {
        if (!clientId || !scanUrl.trim() || running) return;
        setRunning(true);
        setRunError(null);
        const startedAt = Date.now();
        try {
            const response = await fetch('/api/admin/audits/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, websiteUrl: scanUrl.trim() }),
            });
            const payload = await response.json().catch(() => ({}));
            const elapsed = Date.now() - startedAt;

            if (!response.ok || payload.success === false) {
                setLastRun({
                    success: false,
                    error: payload.error || payload.message || `Erreur ${response.status}`,
                    auditId: payload.auditId || null,
                    elapsedMs: payload.elapsedMs || elapsed,
                    stepTimings: payload.stepTimings || [],
                    finishedAt: new Date().toISOString(),
                });
                setRunError(payload.error || payload.message || `Erreur ${response.status}`);
                return;
            }

            setLastRun({
                success: true,
                auditId: payload.auditId,
                elapsedMs: payload.elapsedMs || elapsed,
                stepTimings: payload.stepTimings || [],
                seoScore: payload.seo_score,
                geoScore: payload.geo_score,
                hybridScore: payload.overall_score,
                llmStatus: payload.llmStatus,
                finishedAt: new Date().toISOString(),
            });

            if (typeof onRunComplete === 'function') {
                await onRunComplete();
            }
        } catch (error) {
            setRunError(error.message || 'Erreur réseau');
            setLastRun({
                success: false,
                error: error.message || 'Erreur réseau',
                elapsedMs: Date.now() - startedAt,
                finishedAt: new Date().toISOString(),
            });
        } finally {
            setRunning(false);
        }
    }

    const modePill = runtime
        ? runtime.shadowMode
            ? { label: 'Pipeline en observation', tone: 'warn' }
            : runtime.layeredPipeline
              ? { label: 'Pipeline complet actif', tone: 'info' }
              : { label: 'Pipeline hérité', tone: 'neutral' }
        : null;

    return (
        <section className="rounded-2xl border border-white/[0.09] bg-gradient-to-br from-white/[0.045] via-white/[0.015] to-transparent p-5">
            <LabSectionHeader
                eyebrow="Lancer un audit"
                title={clientName ? `Lancer un audit — ${clientName}` : 'Lancer un audit'}
                subtitle="Déclenche l'exploration complète du site (exploration, vérifications, enrichissements experts, calcul du score Trouvable). Le résultat affiché ci-dessous se met à jour automatiquement à la fin."
                right={
                    <div className="flex flex-col items-end gap-1">
                        {modePill && <LabPill label={modePill.label} tone={modePill.tone} />}
                        {runtime?.auditVersion && (
                            <span className="text-[10px] text-white/35">version {runtime.auditVersion}</span>
                        )}
                        {runtime?.crawlBudget != null && (
                            <span className="text-[10px] text-white/35">
                                budget d&apos;exploration : {runtime.crawlBudget} pages
                            </span>
                        )}
                    </div>
                }
            />

            {runtimeError && (
                <p className="mb-3 text-[11px] text-amber-300/80">
                    Mode d&apos;audit indisponible ({runtimeError}). Le lancement reste possible.
                </p>
            )}

            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                    type="url"
                    className="geo-inp flex-1 px-4 py-2 text-sm"
                    value={scanUrl}
                    onChange={(event) => setScanUrl(event.target.value)}
                    placeholder="https://..."
                    disabled={running}
                />
                <button
                    type="button"
                    onClick={handleRun}
                    disabled={running || !clientId || !scanUrl.trim()}
                    className="geo-btn geo-btn-pri shrink-0 px-6 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {running ? 'Audit en cours…' : 'Lancer un audit'}
                </button>
            </div>

            {runError && !running && (
                <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/[0.05] px-3 py-2 text-[12px] text-red-300">
                    {runError}
                </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                        Dernier audit enregistré
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-white/80">{formatDate(latestAuditAt)}</div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">Ce lancement</div>
                    <div className="mt-1 text-[12px] font-semibold text-white/80">
                        {running
                            ? 'En cours…'
                            : lastRun
                              ? lastRun.success
                                  ? `Succès · ${formatMs(lastRun.elapsedMs)}`
                                  : `Échec · ${formatMs(lastRun.elapsedMs)}`
                              : 'Aucun lancement dans cette session'}
                    </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                        Identifiant de l&apos;audit
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-white/70">{lastRun?.auditId || '—'}</div>
                </div>
            </div>

            {lastRun?.success && lastRun.stepTimings?.length > 0 && (
                <div className="mt-4">
                    <LabCollapsible
                        label={`Détail par étape (${lastRun.stepTimings.length})`}
                        hint="Temps d'exécution de chaque étape du pipeline"
                    >
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                            {lastRun.stepTimings.map((step, index) => {
                                const isError = step.status === 'error';
                                return (
                                    <div
                                        key={`${step.step || 'step'}-${index}`}
                                        className={`flex items-center justify-between rounded-md border px-2 py-1 ${isError ? 'border-red-400/20 bg-red-400/[0.04]' : 'border-white/[0.04] bg-white/[0.02]'}`}
                                        title={isError ? step.error || 'Étape en erreur' : undefined}
                                    >
                                        <span
                                            className={`truncate text-[11px] ${isError ? 'text-red-300/80' : 'text-white/60'}`}
                                        >
                                            {step.step || 'étape'}
                                        </span>
                                        <span className="font-mono text-[11px] tabular-nums text-white/80">
                                            {formatMs(step.duration_ms ?? step.elapsed_ms ?? step.ms)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </LabCollapsible>
                </div>
            )}
        </section>
    );
}
