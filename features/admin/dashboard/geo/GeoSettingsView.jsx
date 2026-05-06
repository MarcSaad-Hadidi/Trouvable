// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { 
    Building2, 
    User, 
    ShieldCheckIcon, 
    GlobeIcon, 
    MailIcon, 
    ChevronRightIcon
} from 'lucide-react';

import { useGeoClient } from '@/features/admin/dashboard/shared/context/ClientContext';
import { SITE_CONTACT_EMAIL, SITE_PHONE_DISPLAY, SITE_PHONE_TEL } from '@/lib/site-contact';
import { 
    CommandHeader, 
    CommandPageShell, 
    COMMAND_BUTTONS, 
    COMMAND_PANEL, 
    COMMAND_SURFACE, 
    cn 
} from '@/features/admin/dashboard/shared/components/command';

/* ── Components ── */

function SettingRow({ label, value, hint }) {
    return (
        <div className="flex flex-col gap-2 py-5 border-b border-white/[0.04] last:border-0 group hover:bg-white/[0.01] transition-all px-4 -mx-4 rounded-xl">
            <div className="flex flex-wrap items-center justify-between">
                <span className="text-[13px] font-bold text-white/40 group-hover:text-white transition-colors uppercase tracking-widest">{label}</span>
                <span className="text-[12px] text-[#7c6aef] font-mono font-bold bg-[#7c6aef]/5 px-2 py-0.5 rounded border border-[#7c6aef]/20">{value}</span>
            </div>
            {hint && <p className="text-[11px] text-white/20 italic">"{hint}"</p>}
        </div>
    );
}

export default function GeoSettingsView() {
    const { user } = useUser();
    const { client, clientId } = useGeoClient();
    const [zone, setZone] = useState('operator');

    const editHref = clientId ? `/admin/clients/${clientId}/edit` : '/admin/clients';
    const dossierBase = clientId ? `/admin/clients/${clientId}/dossier` : '/admin/clients';

    const adminDisplayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Administrateur';
    const adminEmail = user?.primaryEmailAddress?.emailAddress || 'n.d.';

    const header = (
        <CommandHeader
            eyebrow="IA / GEO"
            title="Configuration Radar"
            subtitle="Réglages du plan de travail : opérateur d'un côté, paramètres du mandat de l'autre."
            actions={(
                <Link href={editHref} className={COMMAND_BUTTONS.primary}>
                    Modifier Profil Mandat
                </Link>
            )}
        />
    );

    return (
        <CommandPageShell header={header}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] h-[calc(100vh-220px)] min-h-[600px]">
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => setZone('operator')}
                        className={cn(
                            "flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all text-left",
                            zone === 'operator' 
                                ? "bg-[#7c6aef]/10 border-[#7c6aef]/30 text-[#b8adff] shadow-lg shadow-[#7c6aef]/5" 
                                : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                        )}
                    >
                        <User className="h-4 w-4" />
                        <div className="min-w-0">
                            <div className="text-[13px] font-bold">Profil Opérateur</div>
                            <div className="text-[10px] uppercase tracking-widest opacity-40">Compte personnel</div>
                        </div>
                    </button>
                    <button 
                        onClick={() => setZone('mandate')}
                        className={cn(
                            "flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all text-left",
                            zone === 'mandate' 
                                ? "bg-[#7c6aef]/10 border-[#7c6aef]/30 text-[#b8adff] shadow-lg shadow-[#7c6aef]/5" 
                                : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.04] hover:text-white/60"
                        )}
                    >
                        <Building2 className="h-4 w-4" />
                        <div className="min-w-0">
                            <div className="text-[13px] font-bold">Identité Mandat</div>
                            <div className="text-[10px] uppercase tracking-widest opacity-40">Configuration client</div>
                        </div>
                    </button>

                    <div className="mt-auto p-5 rounded-2xl bg-black/20 border border-white/5">
                        <div className="flex items-center gap-2 mb-3 text-white/20">
                            <ShieldCheckIcon className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Sécurité</span>
                        </div>
                        <p className="text-[11px] text-white/20 leading-relaxed italic">"L'authentification est gérée par Clerk. Les sessions sont persistées localement."</p>
                    </div>
                </div>

                <div className={cn(COMMAND_PANEL, "overflow-y-auto geo-scrollbar")}>
                    {zone === 'operator' ? (
                        <div className="p-8 space-y-10">
                            <section>
                                <div className="flex items-center gap-2 mb-6 text-[#7c6aef]">
                                    <User className="h-4 w-4" />
                                    <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]">Identité Administrateur</h3>
                                </div>
                                <div className={cn(COMMAND_SURFACE, "p-6")}>
                                    <SettingRow label="Nom de l'opérateur" value={adminDisplayName} hint="Nom utilisé dans les journaux d'activité" />
                                    <SettingRow label="Email principal" value={adminEmail} hint="Adresse de notification système" />
                                    <SettingRow label="Rôle système" value="GEO Analyst" hint="Niveau d'accès Enterprise" />
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 mb-6 text-white/30">
                                    <MailIcon className="h-4 w-4" />
                                    <h3 className="text-[12px] font-bold uppercase tracking-[0.14em]">Assistance Trouvable</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <a href={`mailto:${SITE_CONTACT_EMAIL}`} className={cn(COMMAND_SURFACE, "p-5 hover:bg-white/[0.04] transition-all")}>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Email Support</div>
                                        <div className="text-[14px] font-bold text-[#b8adff]">{SITE_CONTACT_EMAIL}</div>
                                    </a>
                                    <a href={`tel:${SITE_PHONE_TEL}`} className={cn(COMMAND_SURFACE, "p-5 hover:bg-white/[0.04] transition-all")}>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-1">Assistance Directe</div>
                                        <div className="text-[14px] font-bold text-[#b8adff] tabular-nums">{SITE_PHONE_DISPLAY}</div>
                                    </a>
                                </div>
                            </section>
                        </div>
                    ) : (
                        <div className="p-8 space-y-12">
                            <section>
                                <div className="flex items-center gap-2 mb-6 text-[#7c6aef]">
                                    <Building2 className="h-4 w-4" />
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-40">Paramètres du Mandat</h3>
                                </div>
                                <div className={cn(COMMAND_SURFACE, "p-8 bg-black/40")}>
                                    {client ? (
                                        <>
                                            <SettingRow label="Raison Sociale" value={client.client_name} />
                                            <SettingRow label="Type d'entité" value={client.business_type || 'LocalBusiness'} />
                                            <SettingRow label="Domaine racine" value={client.website_url} />
                                            <div className="py-5 border-b border-white/[0.04] flex items-center justify-between px-4 -mx-4 hover:bg-white/[0.01] transition-all rounded-xl">
                                                <span className="text-[13px] font-bold text-white/40 uppercase tracking-widest">Statut de Publication</span>
                                                <div className={cn("px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border", client.is_published ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-white/30 border-white/10")}>
                                                    {client.is_published ? 'Public' : 'Brouillon'}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <p className="text-[13px] text-white/30 italic">Aucun mandat chargé.</p>
                                    )}
                                </div>
                            </section>

                            <section>
                                <div className="flex items-center gap-2 mb-6 text-white/20">
                                    <GlobeIcon className="h-4 w-4" />
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] opacity-40">Navigation Rapide</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Link href={editHref} className={cn(COMMAND_SURFACE, "p-6 hover:bg-[#7c6aef]/5 hover:border-[#7c6aef]/20 transition-all flex items-center justify-between group bg-black/40")}>
                                        <span className="text-[13px] font-bold text-white/60 group-hover:text-white uppercase tracking-widest">Éditer le profil</span>
                                        <ChevronRightIcon className="h-4 w-4 text-white/10 group-hover:text-[#7c6aef] group-hover:translate-x-1 transition-all" />
                                    </Link>
                                    <Link href={dossierBase} className={cn(COMMAND_SURFACE, "p-6 hover:bg-[#7c6aef]/5 hover:border-[#7c6aef]/20 transition-all flex items-center justify-between group bg-black/40")}>
                                        <span className="text-[13px] font-bold text-white/60 group-hover:text-white uppercase tracking-widest">Dossier complet</span>
                                        <ChevronRightIcon className="h-4 w-4 text-white/10 group-hover:text-[#7c6aef] group-hover:translate-x-1 transition-all" />
                                    </Link>
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </CommandPageShell>
    );
}
