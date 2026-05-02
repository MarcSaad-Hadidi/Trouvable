import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { EXPERTISES, VILLES } from "@/lib/data/geo-architecture";
import { SITE_CONTACT_EMAIL, SITE_PHONE_DISPLAY as CONTACT_PHONE_DISPLAY, SITE_PHONE_TEL as CONTACT_PHONE_TEL } from '@/lib/site-contact';

export default function SiteFooter() {
    return (
      <footer className="border-t border-white/7 bg-[#080808] px-6 pb-9 pt-16 sm:px-10">
        {/* Main layout using Flex to prevent unwanted wrapping */}
        <div className="mx-auto mb-14 flex max-w-[1120px] flex-col gap-y-10 lg:flex-row lg:justify-between lg:gap-x-8">
          {/* Brand */}
          <div className="lg:w-[28%] shrink-0">
            <Link href="/" className="mb-4 inline-flex min-h-[48px] items-center gap-2 text-[15px] font-semibold tracking-[-0.02em] text-white">
              Trouvable
            </Link>
            <p className="max-w-[260px] text-[13px] leading-[1.65] text-[#9a9a9a]">Firme québécoise : mandats de visibilité organique Google et de cohérence dans les réponses IA, avec exécution faite pour vous.</p>
            <div className="mt-5 space-y-2.5 text-[13px] text-[#b7b7b7]">
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#5b73ff]" /> Interventions sur le Grand Montréal et Québec</div>
              <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="flex items-center gap-2 text-[#c9c9c9] transition-colors hover:text-white">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#5b73ff]" />
                {SITE_CONTACT_EMAIL}
              </a>
              <a href={`tel:${CONTACT_PHONE_TEL}`} className="flex items-center gap-2 text-[#c9c9c9] transition-colors hover:text-white">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[#5b73ff]" />
                {CONTACT_PHONE_DISPLAY}
              </a>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap lg:flex-nowrap gap-y-10 gap-x-8 lg:gap-x-4 xl:gap-x-8">
            {/* Mandats */}
            <div className="w-[45%] sm:w-[30%] lg:flex-1">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">Mandats</div>
              <ul className="space-y-2.5 list-outside list-disc ml-4 marker:text-white/30">
                <li><Link href="/agence-geo-montreal" className="text-sm text-[#9a9a9a] transition hover:text-white">Agence GEO Montréal</Link></li>
                <li><Link href="/agence-geo-quebec" className="text-sm text-[#9a9a9a] transition hover:text-white">Agence GEO Québec</Link></li>
                <li><Link href="/services/audit-visibilite-ia" className="text-sm text-[#9a9a9a] transition hover:text-white">Audit visibilité IA</Link></li>
                <li><Link href="/services/accompagnement-geo" className="text-sm text-[#9a9a9a] transition hover:text-white">Accompagnement GEO</Link></li>
                <li><Link href="/services/strategie-visibilite-ia" className="text-sm text-[#9a9a9a] transition hover:text-white">Stratégie IA</Link></li>
                <li className="list-none -ml-4"><div className="my-2 h-px bg-white/5" /></li>
                <li><Link href="/offres" className="text-sm text-[#9a9a9a] transition hover:text-white">Tous les mandats</Link></li>
                <li><Link href="/methodologie" className="text-sm text-[#9a9a9a] transition hover:text-white">Méthode d&apos;exécution</Link></li>
              </ul>
            </div>

            {/* Expertises */}
            <div className="w-[45%] sm:w-[30%] lg:flex-1">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">Expertises</div>
              <ul className="space-y-2.5 list-outside list-disc ml-4 marker:text-white/30">
                {EXPERTISES.slice(0, 5).map((exp) => (
                  <li key={exp.slug}><Link href={`/expertises/${exp.slug}`} className="text-sm text-[#9a9a9a] transition hover:text-white">{exp.name}</Link></li>
                ))}
              </ul>
            </div>

            {/* Marchés locaux */}
            <div className="w-[45%] sm:w-[30%] lg:flex-1">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">Marchés locaux</div>
              <ul className="space-y-2.5 list-outside list-disc ml-4 marker:text-white/30">
                {VILLES.slice(0, 5).map((ville) => (
                  <li key={ville.slug}><Link href={`/villes/${ville.slug}`} className="text-sm text-[#9a9a9a] transition hover:text-white">{ville.name}</Link></li>
                ))}
              </ul>
            </div>

            {/* Plateformes IA */}
            <div className="w-[45%] sm:w-[30%] lg:flex-1">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">Plateformes IA</div>
              <ul className="space-y-2.5 list-outside list-disc ml-4 marker:text-white/30">
                <li><Link href="/plateformes/chatgpt" className="text-sm text-[#9a9a9a] transition hover:text-white">ChatGPT</Link></li>
                <li><Link href="/plateformes/claude" className="text-sm text-[#9a9a9a] transition hover:text-white">Claude</Link></li>
                <li><Link href="/plateformes/perplexity" className="text-sm text-[#9a9a9a] transition hover:text-white">Perplexity</Link></li>
                <li><Link href="/plateformes/gemini" className="text-sm text-[#9a9a9a] transition hover:text-white">Gemini</Link></li>
                <li><Link href="/plateformes/copilot" className="text-sm text-[#9a9a9a] transition hover:text-white">Copilot</Link></li>
                <li><Link href="/plateformes/ai-overviews" className="text-sm text-[#9a9a9a] transition hover:text-white">AI Overviews</Link></li>
                <li className="list-none -ml-4"><div className="my-2 h-px bg-white/5" /></li>
                <li><Link href="/ressources/geo-vs-seo" className="text-sm text-[#9a9a9a] transition hover:text-white">GEO vs SEO</Link></li>
                <li><Link href="/ressources/mesurer-visibilite-ia" className="text-sm text-[#9a9a9a] transition hover:text-white">Mesurer visibilité IA</Link></li>
                <li><Link href="/ressources/structurer-site-moteurs-ia" className="text-sm text-[#9a9a9a] transition hover:text-white">Structurer site IA</Link></li>
              </ul>
            </div>

            {/* Entreprise */}
            <div className="w-[45%] sm:w-[30%] lg:flex-1">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.1em] text-white/50">Entreprise</div>
              <ul className="space-y-2.5 list-outside list-disc ml-4 marker:text-white/30">
                <li><Link href="/a-propos" className="text-sm text-[#9a9a9a] transition hover:text-white">À propos</Link></li>
                <li><Link href="/notre-mesure" className="text-sm text-[#9a9a9a] transition hover:text-white">Cadre de mesure</Link></li>
                <li><Link href="/etudes-de-cas" className="text-sm text-[#9a9a9a] transition hover:text-white">Cas Clients</Link></li>
                <li><Link href="/etudes-de-cas/dossier-type" className="text-sm text-[#9a9a9a] transition hover:text-white">Dossier-type</Link></li>
                <li><Link href="/contact" className="text-sm text-[#9a9a9a] transition hover:text-white">Contact</Link></li>
                <li className="list-none -ml-4"><div className="my-2 h-px bg-white/5" /></li>
                <li><Link href="/espace" className="text-sm text-[#9a9a9a] transition hover:text-white">Espace client</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mx-auto max-w-[1120px] border-t border-white/7 pt-6">
          <div className="flex flex-col gap-y-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: copyright + legal */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-[#9a9a9a]">
              <span className="whitespace-nowrap">&copy; {new Date().getFullYear()} Trouvable. Mandats de visibilité.</span>
              <span className="hidden opacity-20 sm:inline">|</span>
              <Link href="/mentions-legales" className="whitespace-nowrap text-[#a0a0a0] underline decoration-white/10 underline-offset-4 transition-colors hover:text-white hover:decoration-white/30">Mentions légales</Link>
              <span className="hidden opacity-20 sm:inline">|</span>
              <Link href="/politique-confidentialite" className="whitespace-nowrap text-[#a0a0a0] underline decoration-white/10 underline-offset-4 transition-colors hover:text-white hover:decoration-white/30">Confidentialité (Google)</Link>
            </div>

            {/* Right: contact + status */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-[#a0a0a0] transition-colors hover:text-white">
                <Mail className="h-3.5 w-3.5 shrink-0 text-[#5b73ff]" />
                {SITE_CONTACT_EMAIL}
              </a>
              <span className="hidden opacity-20 sm:inline">|</span>
              <a href={`tel:${CONTACT_PHONE_TEL}`} className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] text-[#a0a0a0] transition-colors hover:text-white">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[#5b73ff]" />
                {CONTACT_PHONE_DISPLAY}
              </a>
              <span className="hidden opacity-20 sm:inline">|</span>
              <div className="flex items-center gap-2 whitespace-nowrap text-[13px] text-[#9a9a9a]">
                <div className="h-[7px] w-[7px] rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(34,197,94)] animate-pulse" />
                Accompagnement en cours
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
}
