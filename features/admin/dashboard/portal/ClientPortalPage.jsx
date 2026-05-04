import Link from 'next/link';
import { notFound } from 'next/navigation';

import PortalDashboard from '@/features/portal/dashboard/PortalDashboard';
import { isCurrentRequestCloudflareBypassEnabled } from '@/lib/dev-bypass-server';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { listClientPortalMembers } from '@/features/portal/server/access';
import { getPortalDashboardData } from '@/features/portal/server/data';
import PortalAccessPanel from '@/features/admin/dashboard/portal/PortalAccessPanel';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
    return { title: 'Portail client | Trouvable OS' };
}

export default async function ClientPortalPage({ params }) {
    const { clientId } = await params;
    const supabase = getAdminSupabase();
    const cloudflareBypassEnabled = await isCurrentRequestCloudflareBypassEnabled();

    const { data: client, error } = await supabase
        .from('client_geo_profiles')
        .select('id, client_name, client_slug, lifecycle_status')
        .eq('id', clientId)
        .is('archived_at', null)
        .single();

    if (error || !client) notFound();

    let members = [];
    try {
        members = await listClientPortalMembers(clientId);
    } catch (e) {
        console.error('[ClientPortalPage] listClientPortalMembers', e);
    }

    let clientDashboard = null;
    try {
        clientDashboard = await getPortalDashboardData(clientId);
    } catch (e) {
        console.error('[ClientPortalPage] getPortalDashboardData', e);
    }

    const statusColors = {
        active: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
        paused: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
        draft: 'border-white/15 bg-white/[0.06] text-white/40',
    };
    const statusCls = statusColors[client.lifecycle_status] || 'border-white/10 bg-white/[0.04] text-white/25';

    return (
        <div className="mx-auto max-w-7xl space-y-8 p-4 pb-12 md:p-6">
            <div className="mx-auto max-w-3xl space-y-6">
                {/* Header */}
                <div className="space-y-3">
                    <Link
                        href={`/admin/clients/${clientId}/dossier`}
                        className="inline-flex items-center gap-1 text-[11px] text-white/40 transition-colors hover:text-white/70"
                    >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Retour
                    </Link>
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/30">Portail client</p>
                        <div className="mt-1 flex flex-wrap items-center gap-3">
                            <h1 className="text-lg font-bold text-white/95">{client.client_name}</h1>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusCls}`}>
                                {client.lifecycle_status || 'inconnu'}
                            </span>
                        </div>
                        <p className="mt-1 text-[12px] text-white/35">
                            {members.length} accès configuré{members.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {/* Quick actions */}
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/portal/${client.client_slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-white/12 px-3.5 py-1.5 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/85"
                    >
                        Ouvrir le portail en tant que client
                    </Link>
                    <Link
                        href={`/admin/clients/${clientId}/dossier`}
                        className="rounded-lg border border-white/12 px-3.5 py-1.5 text-[12px] font-semibold text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/85"
                    >
                        Retour au workspace
                    </Link>
                </div>

                <PortalAccessPanel clientId={client.id} clientName={client.client_name} clientSlug={client.client_slug} lifecycleStatus={client.lifecycle_status} initialMembers={members} />
            </div>

            <section className="rounded-[28px] border border-[#5b73ff]/25 bg-[#5b73ff]/[0.06] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-6">
                <div className="mb-6 border-b border-white/10 pb-5">
                    <h2 className="text-base font-bold text-white">Aperçu du tableau de bord client</h2>
                    <p className="mt-1 max-w-2xl text-sm text-white/50">
                        Rendu identique à ce qu&apos;un invité voit sur{' '}
                        <code className="rounded bg-black/30 px-1.5 py-0.5 text-[13px] text-white/70">
                            /portal/{client.client_slug}
                        </code>{' '}
                        (mêmes données lecture seule, sans en-tête portail ni sélection multi-dossiers).
                    </p>
                </div>

                {clientDashboard ? (
                    <div className="rounded-2xl border border-white/8 bg-[#000000]/80 p-4 md:p-6">
                        <PortalDashboard
                            dashboard={clientDashboard}
                            membershipsCount={1}
                            cloudflareBypassEnabled={cloudflareBypassEnabled}
                        />
                    </div>
                ) : (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 px-6 py-12 text-center text-sm text-white/45">
                        Aucune donnée portail disponible pour ce dossier (profil introuvable ou erreur de chargement).
                    </div>
                )}
            </section>
        </div>
    );
}

