import React from 'react';
import { notFound } from 'next/navigation';
import GeoSeoInjector from '@/features/public/shared/GeoSeoInjector';
import { getClientProfile } from '@/lib/supabase/server';
import Navbar from '@/features/public/shared/Navbar';
import SiteFooter from '@/features/public/shared/SiteFooter';
import ContactButton from '@/features/public/shared/ContactButton';
import { SITE_URL } from '@/lib/site-config';
import { fitMetaDescription, withPublicAuthor } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
    const resolvedParams = await params;
    const { clientSlug } = resolvedParams;
    const profile = await getClientProfile(clientSlug);

    if (!profile) {
        return { title: 'Page Introuvable', description: "Ce profil client n'existe pas." };
    }
    let seoTitle = profile.seo_title || profile.client_name;
    if (!profile.seo_title) {
        if (profile.business_type && profile.business_type !== 'LocalBusiness' && profile.address?.city) {
            seoTitle = profile.client_name + ' - ' + profile.business_type + ' à ' + profile.address.city + ' | Trouvable';
        } else if (profile.address?.city) {
            seoTitle = profile.client_name + ' - ' + profile.address.city + ' | Trouvable';
        } else {
            seoTitle = profile.client_name + ' - Profil Local | Trouvable';
        }
    }

    const description = fitMetaDescription(profile.seo_description || ('Profil local de ' + profile.client_name + ' sur Trouvable.'));

    return withPublicAuthor({
        title: seoTitle,
        description,
        metadataBase: new URL(SITE_URL),
        alternates: { canonical: '/clients/' + clientSlug },
        openGraph: {
            title: seoTitle,
            description,
            url: '/clients/' + clientSlug,
            siteName: 'Trouvable',
            locale: 'fr_CA',
            type: 'website',
        }
    });
}

export default async function ClientPage({ params }) {
    const resolvedParams = await params;
    const { clientSlug } = resolvedParams;
    const profile = await getClientProfile(clientSlug);

    if (!profile) {
        notFound();
    }

    return (
        <>
            <Navbar />
            <main className="min-h-screen bg-[#080808] pt-24 pb-16 px-4 sm:px-6 lg:px-8">
                <GeoSeoInjector clientProfile={profile} />

                <nav className="max-w-3xl mx-auto mb-8" aria-label="Fil d'Ariane">
                    <a href="/" className="text-[#7b8fff] hover:text-white font-medium text-sm flex items-center gap-2 transition-colors">
                        ← Retour à Trouvable
                    </a>
                </nav>

                <article className="max-w-3xl mx-auto bg-[#0f0f0f] rounded-2xl p-8 md:p-12 border border-white/10">
                    <header className="mb-10 border-b border-white/10 pb-8 text-center md:text-left">
                        <span className="inline-block px-4 py-1.5 bg-[#5b73ff]/10 text-[#7b8fff] rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-[#5b73ff]/20">
                            Profil AEO Vérifié
                        </span>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
                            {profile.client_name}
                        </h1>
                        {profile.seo_description && (
                            <p className="text-lg text-[#a0a0a0] max-w-2xl leading-relaxed">
                                {profile.seo_description}
                            </p>
                        )}
                        <div className="mt-4 text-xs uppercase tracking-[0.08em] text-white/35">
                            Par Trouvable
                        </div>
                    </header>

                    <div className="mb-12 grid md:grid-cols-2 gap-8">
                        <section aria-labelledby="client-info-heading" className="bg-white/[0.03] rounded-xl p-6 border border-white/[0.07]">
                            <h2 id="client-info-heading" className="text-xs font-bold text-white/30 uppercase tracking-widest mb-6 border-b border-white/[0.07] pb-2">
                                Aperçu de l’entreprise
                            </h2>
                            <ul className="space-y-4 text-[#a0a0a0] text-sm">
                                <li className="flex flex-col">
                                    <span className="text-white/30 font-medium text-xs uppercase mb-1">Catégorie</span>
                                    <span className="font-semibold text-white">{profile.business_type}</span>
                                </li>

                                {profile.address && Object.keys(profile.address).length > 0 && (
                                    <li className="flex flex-col">
                                        <span className="text-white/30 font-medium text-xs uppercase mb-1">Service Local</span>
                                        <address className="not-italic text-white">
                                            {profile.address.street && <span className="block">{profile.address.street}</span>}
                                            {profile.address.city && <span>{profile.address.city}</span>}
                                            {profile.address.postalCode && <span> ({profile.address.postalCode})</span>}
                                            {profile.address.region && <span>, {profile.address.region}</span>}
                                        </address>
                                    </li>
                                )}

                                {profile.website_url && (
                                    <li className="flex flex-col pt-2 block">
                                        <a href={profile.website_url} className="inline-flex items-center text-[#7b8fff] hover:text-white font-bold transition-colors" target="_blank" rel="noopener noreferrer">
                                            Visiter le site officiel →
                                        </a>
                                    </li>
                                )}
                            </ul>
                        </section>

                        <section aria-labelledby="trouvable-tech-heading" className="rounded-xl p-6 border border-[#5b73ff]/20 bg-[#5b73ff]/[0.02] shadow-[0_10px_30px_rgba(91,115,255,0.03)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-[80px] font-bold leading-none">AEO</div>
                            <h2 id="trouvable-tech-heading" className="text-xs font-bold text-[#5b73ff]/80 uppercase tracking-widest mb-6 border-b border-[#5b73ff]/20 pb-2 relative z-10">
                                Intégration par Trouvable
                            </h2>
                            <ul className="space-y-5 text-sm relative z-10">
                                <li className="flex gap-3 items-start">
                                    <div className="mt-0.5 rounded-full bg-emerald-500/20 p-0.5">
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white/90">Ingénierie de la donnée</div>
                                        <div className="text-[13px] text-[#888] mt-1 leading-relaxed">Profil injecté avec un balisage Schema.org LocalBusiness conforme aux exigences de Google.</div>
                                    </div>
                                </li>
                                <li className="flex gap-3 items-start">
                                    <div className="mt-0.5 rounded-full bg-emerald-500/20 p-0.5">
                                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-white/90">Alignement IA (GEO)</div>
                                        <div className="text-[13px] text-[#888] mt-1 leading-relaxed">Les signaux sémantiques de la marque sont structurés pour optimiser la reconnaissance par ChatGPT et Gemini.</div>
                                    </div>
                                </li>
                            </ul>
                        </section>
                    </div>

                    {profile.geo_faqs && profile.geo_faqs.length > 0 && (
                        <section aria-labelledby="faq-heading" className="mt-8 border-t border-white/10 pt-8">
                            <h2 id="faq-heading" className="text-2xl font-bold text-white mb-8 tracking-tight">
                                Questions fréquentes traitées par l’IA
                            </h2>
                            <div className="space-y-8">
                                {profile.geo_faqs.map((faq, i) => (
                                    <div key={i}>
                                        <h3 className="text-lg font-bold text-white mb-2">{faq.question}</h3>
                                        <p className="text-[#a0a0a0] leading-relaxed">{faq.answer}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <footer className="mt-16 pt-8 border-t border-white/10 text-center">
                        <p className="text-[#a0a0a0] mb-4">Vous repérez une information manquante ou vous souhaitez revendiquer ce profil ?</p>
                        <ContactButton className="inline-block px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-[#d6d6d6] transition-colors">
                            Contacter l'équipe Trouvable
                        </ContactButton>
                    </footer>
                </article>
            </main>
            <SiteFooter />
        </>
    );
}

