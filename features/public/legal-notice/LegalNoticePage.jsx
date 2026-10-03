import React from "react";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";

export const metadata = {
  title: "Mentions légales | Trouvable",
  description: "Mentions légales de l'application Trouvable.app",
};

export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.04)_0%,rgba(91,115,255,0.04)_50%,transparent_70%),linear-gradient(to_bottom,#080808,#080808)]" />

      <main className="relative mt-[58px] px-6 py-20 sm:px-10 lg:py-28 mx-auto max-w-3xl">
        <div className="mb-14">
          <h1 className="text-[clamp(32px,5vw,56px)] font-bold tracking-[-0.04em] mb-4">Mentions Légales</h1>
          <p className="text-[17px] text-[#a0a0a0]">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <div className="space-y-12 text-[15px] leading-[1.7] text-[#a0a0a0]">

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-[-0.02em]">1. Éditeur du site</h2>
            <p>Le site <strong>Trouvable.app</strong> est édité par <strong>Trouvable</strong>, firme québécoise domiciliée dans la région du Grand Montréal, Québec, Canada.</p>
            <p>Email de contact : <a href="mailto:contact@trouvable.app" className="text-[#5b73ff] hover:underline">contact@trouvable.app</a></p>
            <p>Téléphone : <a href="tel:5147152421" className="text-[#5b73ff] hover:underline">514-715-2421</a></p>
            <p>Directeur de la publication : Marc Hadidi</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-[-0.02em]">2. Hébergement</h2>
            <p>Le site est hébergé par <strong>Vercel Inc.</strong></p>
            <p>440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
            <p>L&#39;infrastructure de base de données est opérée par <strong>Supabase</strong> et l&#39;authentification par <strong>Clerk</strong>.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-[-0.02em]">3. Propriété intellectuelle</h2>
            <p>
              L&#39;ensemble de ce site relève des législations canadiennes, québécoises et internationales sur le droit d&#39;auteur
              et la propriété intellectuelle. Tous les droits de reproduction sont réservés, y compris pour
              les documents iconographiques et photographiques.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-white tracking-[-0.02em]">4. Responsabilité</h2>
            <p>
              L&#39;éditeur s&#39;efforce de fournir des informations précises et à jour sur ce site,
              mais ne saurait garantir l&#39;exactitude, la complétude ou l&#39;actualité des informations diffusées.
              Le site peut inclure des liens vers des services externes (Google Search Console, réseaux sociaux)
              pour lesquels il n&#39;assume aucune responsabilité quant aux contenus.
            </p>
          </section>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
