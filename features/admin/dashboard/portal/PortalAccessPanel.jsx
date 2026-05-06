'use client';

import { Check, Copy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

function statusLabel(status) {
    if (status === 'active') return { text: 'Actif', cls: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' };
    if (status === 'pending') return { text: 'En attente', cls: 'border-amber-400/25 bg-amber-400/10 text-amber-200' };
    if (status === 'revoked') return { text: 'Révoqué', cls: 'border-white/10 bg-white/[0.04] text-white/40' };
    return { text: status || 'n.d.', cls: 'border-white/10 bg-white/[0.04] text-white/50' };
}

const PORTAL_READY_STATES = new Set(['active', 'paused']);

export default function PortalAccessPanel({ clientId, clientName, clientSlug, lifecycleStatus, initialMembers = [] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [members, setMembers] = useState(initialMembers);
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [copiedPath, setCopiedPath] = useState(null);

    useEffect(() => {
        setMembers(initialMembers);
    }, [initialMembers]);

    const portalSignInPath = '/portal/sign-in';
    const portalDashboardPath = `/portal/${clientSlug}`;
    const isPortalReady = PORTAL_READY_STATES.has(lifecycleStatus);

    async function handleSave(event) {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        const trimmed = email.trim();
        if (!trimmed) {
            setError('Saisissez une adresse courriel.');
            return;
        }

        startTransition(async () => {
            try {
                const res = await fetch('/api/admin/clients/portal-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'upsert',
                        clientId,
                        contactEmail: trimmed,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

                setMembers(data.members || []);
                setSuccess(`Compte créé et accès activé pour ${data.access?.contact_email || trimmed}.`);
                setEmail('');
                router.refresh();
            } catch (e) {
                setError(e.message);
            }
        });
    }

    async function handleRevoke(accessId) {
        if (!window.confirm('Révoquer l’accès portail pour cette adresse ?')) return;
        setError(null);
        setSuccess(null);

        startTransition(async () => {
            try {
                const res = await fetch('/api/admin/clients/portal-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'revoke',
                        clientId,
                        accessId,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

                setMembers(data.members || []);
                setSuccess('Accès révoqué.');
                router.refresh();
            } catch (e) {
                setError(e.message);
            }
        });
    }

    async function handleActivate(accessId) {
        setError(null);
        setSuccess(null);

        startTransition(async () => {
            try {
                const res = await fetch('/api/admin/clients/portal-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'activate',
                        clientId,
                        accessId,
                    }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);

                setMembers(data.members || []);
                setSuccess('Accès activé.');
                router.refresh();
            } catch (e) {
                setError(e.message);
            }
        });
    }

    return (
        <div className="space-y-8">
            {!isPortalReady && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
                    <p className="text-sm font-semibold text-amber-200">
                        Le dossier est en statut «&nbsp;{lifecycleStatus || 'inconnu'}&nbsp;»
                    </p>
                    <p className="mt-1 text-sm text-amber-200/60">
                        Le portail fonctionne, mais certaines données peuvent être incomplètes tant que le dossier n&apos;est pas passé en «&nbsp;active&nbsp;».
                    </p>
                </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-6">
                <h2 className="text-base font-bold text-white">Ajouter un accès client</h2>
                <p className="mt-2 text-sm text-white/45">
                    Un compte Clerk sera créé automatiquement pour cette adresse. Le client recevra un lien de connexion par courriel et pourra consulter son tableau de bord sur l&apos;espace client.
                </p>

                <form onSubmit={handleSave} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                        <label htmlFor="portal-email" className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-white/45">
                            Courriel d’accès au tableau de bord client
                        </label>
                        <input
                            id="portal-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="contact@entreprise.com"
                            className="w-full rounded-xl border border-white/10 bg-[#161616] px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-[#5b73ff] focus:ring-1 focus:ring-[#5b73ff]"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isPending}
                        className="shrink-0 rounded-xl bg-[#5b73ff] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#4a62ee] disabled:opacity-50"
                    >
                        {isPending ? 'Création…' : 'Créer l\u2019accès'}
                    </button>
                </form>

                {error && (
                    <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-200">{error}</div>
                )}
                {success && (
                    <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">{success}</div>
                )}

                <div className="mt-4 space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <span className="text-emerald-400/50">✓</span> Compte Clerk créé
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <span className="text-emerald-400/50">✓</span> Accès portail activé
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-white/30">
                        <span className="text-emerald-400/50">✓</span> Courriel de bienvenue envoyé
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-6">
                <h2 className="text-base font-bold text-white">Parcours client</h2>
                <div className="mt-4 space-y-2">
                    {[
                        { label: 'Connexion', path: portalSignInPath },
                        { label: 'Tableau de bord', path: portalDashboardPath },
                        { label: 'Aide', path: `${portalDashboardPath}#aide-espace-client` },
                    ].map(({ label, path }) => (
                        <div key={path} className="flex items-center gap-3">
                            <span className="w-20 shrink-0 text-[12px] text-white/50">{label}</span>
                            <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/75">{path}</code>
                            <button
                                type="button"
                                onClick={() => {
                                    const full = window.location.origin + path;
                                    navigator.clipboard.writeText(full);
                                    setCopiedPath(path);
                                    setTimeout(() => setCopiedPath(null), 2000);
                                }}
                                className="shrink-0 rounded-md border border-white/10 p-1 text-white/35 transition-colors hover:bg-white/[0.06] hover:text-white/60"
                                title="Copier le lien"
                            >
                                {copiedPath === path ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-6 flex flex-col items-start min-h-0">
                <div className="flex items-start justify-between w-full">
                    <div>
                        <h2 className="text-base font-bold text-white">Accès enregistrés</h2>
                        <p className="mt-1 text-xs text-white/35">
                            Chaque adresse correspond à un compte invité. Seuls les accès actifs permettent la connexion au portail.
                        </p>
                    </div>
                </div>
                
                <div className="mt-4 pb-4 border-b border-white/10 w-full flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex flex-col">
                        <span className="text-xs font-semibold text-white/60 uppercase tracking-[0.05em] mb-1">Email de bienvenue</span>
                        <span className="text-[11px] text-white/40">Le dernier accès actif recevra l'invitation (incluant le lien GSC automatique).</span>
                    </div>
                    {members.length > 0 && <ResendInvitationButton clientId={clientId} />}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/60" />Actif : peut se connecter</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400/60" />En attente : doit être activé</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-white/20" />Révoqué : accès suspendu</span>
                </div>

                {members.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/40">
                        Aucun accès enregistré. Ajoutez un courriel ci-dessus.
                    </div>
                ) : (
                    <ul className="mt-4 divide-y divide-white/[0.06]">
                        {members.map((row) => {
                            const st = statusLabel(row.status);
                            const borderColor = row.status === 'active' ? 'border-l-emerald-400/40' : row.status === 'pending' ? 'border-l-amber-400/40' : 'border-l-white/10';
                            return (
                                <li key={row.id} className={`flex flex-wrap items-center justify-between gap-3 border-l-2 py-5 pl-4 first:pt-0 ${borderColor}`}>
                                    <div className="min-w-0">
                                        <div className="font-medium text-white">{row.contact_email}</div>
                                        <div className="mt-1 text-[11px] text-white/35">
                                            Rôle : {row.portal_role || 'viewer'}
                                            {row.clerk_user_id ? ' · Compte Clerk lié' : ''}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.text}</span>
                                        {row.status === 'pending' && (
                                            <button
                                                type="button"
                                                disabled={isPending}
                                                onClick={() => handleActivate(row.id)}
                                                className="rounded-lg border border-emerald-400/30 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"
                                            >
                                                Activer
                                            </button>
                                        )}
                                        {(row.status === 'active' || row.status === 'pending') && (
                                            <button
                                                type="button"
                                                disabled={isPending}
                                                onClick={() => handleRevoke(row.id)}
                                                className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/55 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
                                            >
                                                Révoquer
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

function ResendInvitationButton({ clientId }) {
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState(null);

    const handleSend = async () => {
        setIsLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/admin/clients/portal-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resend_invitation', clientId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Erreur d'envoi");
            setStatus('success');
        } catch (err) {
            setStatus(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center sm:flex-row sm:justify-start gap-3">
            <button
                type="button"
                onClick={handleSend}
                disabled={isLoading}
                className="shrink-0 rounded-xl bg-white/[0.05] border border-white/15 px-4 py-2 text-xs font-bold text-white hover:bg-white/[0.1] disabled:opacity-50 transition-colors"
            >
                {isLoading ? 'Envoi...' : 'Envoyer manuel'}
            </button>
            {status === 'success' && <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wider">Envoyé</span>}
            {status && status !== 'success' && <span className="text-[11px] text-red-400 font-semibold">{status}</span>}
        </div>
    );
}
