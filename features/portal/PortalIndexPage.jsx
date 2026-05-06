import Link from 'next/link';
import { SignOutButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

import { resolvePortalMembership } from '@/features/portal/server/access';
import { SITE_CONTACT_EMAIL } from '@/lib/site-contact';

export const dynamic = 'force-dynamic';

const ISSUE_LABEL = (() => {
    try {
        const date = new Date();
        const month = date.toLocaleDateString('fr-CA', { month: 'long' });
        const year = date.getFullYear();
        return `Édition · ${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
    } catch {
        return 'Édition courante';
    }
})();

export default async function PortalIndexPage() {
    const membershipState = await resolvePortalMembership();
    const memberships = membershipState.memberships || [];

    if (memberships.length === 1) {
        redirect(`/portal/${memberships[0].client_slug}`);
    }

    if (memberships.length === 0) {
        return (
            <article className="mx-auto max-w-3xl">
                <header className="border-b border-white/[0.07] pb-6">
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                        <span>Trouvable · Restitution</span>
                        <span>{ISSUE_LABEL}</span>
                    </div>
                    <h1 className="mt-6 font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.045em] text-white">
                        Votre dossier n'est pas encore relié à ce compte.
                    </h1>
                    <p className="mt-5 max-w-2xl text-[15px] leading-[1.78] text-white/55">
                        L'espace de restitution se débloque dès qu'un accès actif existe pour votre identifiant Clerk
                        ou pour une adresse vérifiée présente dans votre compte. Notre équipe peut établir le lien
                        sur demande, en quelques minutes.
                    </p>
                </header>

                <section className="mt-8 rounded-[20px] border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                        Adresse vérifiée détectée
                    </div>
                    <div className="mt-3 font-mono text-[14px] text-white/85">
                        {membershipState.primaryVerifiedEmail || 'Aucune adresse vérifiée disponible dans ce compte.'}
                    </div>
                </section>

                <footer className="mt-10 flex flex-wrap gap-3">
                    <a
                        href={`mailto:${SITE_CONTACT_EMAIL}`}
                        className="inline-flex items-center rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black transition hover:bg-[#dadada]"
                    >
                        Contacter Trouvable
                    </a>
                    <SignOutButton redirectUrl="/portal/sign-in">
                        <button
                            type="button"
                            className="inline-flex items-center rounded-full border border-white/[0.10] bg-white/[0.03] px-5 py-2.5 text-[13px] font-semibold text-white/65 transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white"
                        >
                            Changer de compte
                        </button>
                    </SignOutButton>
                </footer>
            </article>
        );
    }

    return (
        <article className="space-y-10">
            <header className="border-b border-white/[0.07] pb-8">
                <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                    <span>Trouvable · Restitution</span>
                    <span>{ISSUE_LABEL}</span>
                </div>
                <h1 className="mt-6 font-display text-[clamp(36px,5vw,56px)] font-semibold leading-[1.04] tracking-[-0.045em] text-white">
                    Sommaire des dossiers à votre nom.
                </h1>
                <p className="mt-5 max-w-2xl text-[15px] leading-[1.78] text-white/55">
                    Chaque entrée ouvre une lecture en restitution stricte du mandat correspondant.
                    Aucune action opérationnelle n'est exécutée depuis cet espace : tout y est observé,
                    pour comprendre où en est votre visibilité.
                </p>
            </header>

            <section className="space-y-3">
                {memberships.map((membership, index) => {
                    const order = String(index + 1).padStart(2, '0');
                    return (
                        <Link
                            key={membership.id}
                            href={`/portal/${membership.client_slug}`}
                            className="group block rounded-[20px] border border-white/[0.07] bg-white/[0.015] p-6 transition-all duration-300 hover:border-white/[0.18] hover:bg-white/[0.04]"
                        >
                            <div className="grid grid-cols-[auto_1fr_auto] items-start gap-6">
                                <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-white/30">
                                    {order}
                                </div>
                                <div className="min-w-0">
                                    <div className="font-display text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white transition group-hover:text-white">
                                        {membership.client_name}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-white/45">
                                        <span>{membership.business_type || 'Entreprise locale'}</span>
                                        {membership.website_url ? (
                                            <>
                                                <span className="text-white/15">·</span>
                                                <span className="font-mono text-[11.5px]">
                                                    {membership.website_url.replace(/^https?:\/\//, '')}
                                                </span>
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 text-right">
                                    <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                                        {membership.portal_role}
                                    </span>
                                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/35 transition group-hover:text-white/80">
                                        Ouvrir →
                                    </span>
                                </div>
                            </div>
                        </Link>
                    );
                })}
            </section>
        </article>
    );
}
