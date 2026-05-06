'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getAllowedNextStates, LIFECYCLE_META } from '@/lib/lifecycle';
import { transitionLifecycleAction } from './actions';

export default function ClientListActions({ client, showArchived }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [isPending, startTransition] = useTransition();

    const currentLifecycle = client.lifecycle_status || 'prospect';
    const allowedNext = getAllowedNextStates(currentLifecycle);

    function handleLifecycleTransition(targetState) {
        if (targetState === 'archived' && !window.confirm('Archiver ce client ?')) return;
        startTransition(async () => {
            setErr(null);
            const result = await transitionLifecycleAction(client.id, targetState);
            if (result?.error) {
                setErr(result.error);
            } else {
                router.refresh();
            }
        });
    }

    async function hardDelete() {
        const slug = window.prompt(
            `Suppression définitive : saisissez le slug exact du client pour confirmer.\n${client.client_slug}`
        );
        if (slug == null) return;
        if (slug.trim() !== client.client_slug) {
            setErr('Slug incorrect, suppression annulée.');
            return;
        }
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch('/api/admin/clients/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: client.id, confirmSlug: slug.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur');
            router.push('/admin/clients');
            router.refresh();
        } catch (e) {
            setErr(e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            {(err) && <span className="text-[10px] text-red-400 max-w-[140px] text-right">{err}</span>}
            <div className="flex flex-wrap justify-end gap-2">
                {(busy || isPending) && <Loader2 className="animate-spin text-white/40" size={16} />}
                <Link href={`/admin/clients/${client.id}/dossier`} className="text-white font-semibold hover:text-emerald-400 text-sm">
                    Ouvrir
                </Link>
                <Link href={`/admin/clients/${client.id}/edit`} className="text-violet-400 font-semibold hover:text-white text-sm">
                    Éditer
                </Link>
                {allowedNext.filter((s) => s !== 'archived').map((targetState) => (
                    <button
                        key={targetState}
                        type="button"
                        onClick={() => handleLifecycleTransition(targetState)}
                        disabled={busy || isPending}
                        className="text-[#7b8fff] text-sm font-semibold hover:underline disabled:opacity-50"
                    >
                        {LIFECYCLE_META[targetState]?.label || targetState}
                    </button>
                ))}
                {allowedNext.includes('archived') && (
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition('archived')}
                        disabled={busy || isPending}
                        className="text-amber-400 text-sm font-semibold hover:underline disabled:opacity-50"
                    >
                        Archiver
                    </button>
                )}
                {currentLifecycle === 'archived' && allowedNext.includes('active') && (
                    <button
                        type="button"
                        onClick={() => handleLifecycleTransition('active')}
                        disabled={busy || isPending}
                        className="text-emerald-400 text-sm font-semibold hover:underline disabled:opacity-50"
                    >
                        Restaurer
                    </button>
                )}
                <button type="button" onClick={hardDelete} disabled={busy || isPending} className="text-red-400/90 text-sm font-semibold hover:underline disabled:opacity-50">
                    Supprimer
                </button>
            </div>
        </div>
    );
}
