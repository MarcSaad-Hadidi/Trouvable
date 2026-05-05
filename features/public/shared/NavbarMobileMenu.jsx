"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import ContactButton from "./ContactButton";

export default function NavbarMobileMenu() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="-mr-3 flex h-12 w-12 items-center justify-center rounded-lg text-white/70 outline-none transition hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808] lg:hidden"
                aria-label={isMenuOpen ? "Fermer le menu principal" : "Ouvrir le menu principal"}
                aria-expanded={isMenuOpen}
                aria-controls="mobile-site-menu"
                type="button"
                data-agent-action="toggle-mobile-menu"
            >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            {isMenuOpen && (
                <div id="mobile-site-menu" className="fixed inset-0 z-[60] bg-[#080808]/98 backdrop-blur-xl lg:hidden">
                    <div className="flex h-[58px] items-center justify-between px-7">
                        <Link href="/" className="-ml-2 flex min-h-12 items-center gap-2 rounded-lg px-2 text-[15px] font-semibold tracking-[-0.025em] text-white outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]" data-agent-action="nav-home-mobile">
                            <img
                                src="/logos/trouvable_logo_blanc1.png"
                                alt="Logo Trouvable"
                                width="22"
                                height="22"
                                className="h-[22px] w-[22px] object-contain"
                            />
                            Trouvable
                        </Link>
                        <button
                            onClick={() => setIsMenuOpen(false)}
                            className="-mr-3 flex h-12 w-12 items-center justify-center rounded-lg text-white/70 outline-none transition hover:bg-white/5 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
                            aria-label="Fermer le menu principal"
                            type="button"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                    <nav className="flex flex-col gap-1 px-7 py-6" aria-label="Navigation mobile">
                        <Link href="/offres" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/80 transition hover:bg-white/5" data-agent-action="nav-offres-mobile">Mandats</Link>
                        <Link href="/services/audit-visibilite-ia" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/80 transition hover:bg-white/5" data-agent-action="nav-audit-ia-mobile">Audit IA</Link>
                        <Link href="/methodologie" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/80 transition hover:bg-white/5" data-agent-action="nav-methodologie-mobile">Méthodologie</Link>
                        <Link href="/etudes-de-cas" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/80 transition hover:bg-white/5" data-agent-action="nav-case-studies-mobile">Cas clients</Link>
                        <Link href="/a-propos" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/80 transition hover:bg-white/5" data-agent-action="nav-about-mobile" toolname="navigate_page" tooldescription="Ouvrir la page À propos de Trouvable.">À propos</Link>
                        <Link href="/recherche" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/80 transition hover:bg-white/5" data-agent-action="nav-search-mobile" toolname="navigate_page" tooldescription="Ouvrir la recherche publique Trouvable.">Recherche</Link>
                        <hr className="my-4 border-white/8" />
                        <Link href="/espace" onClick={() => setIsMenuOpen(false)} className="rounded-lg px-4 py-3 text-lg font-medium text-white/50 transition hover:bg-white/5" data-agent-action="nav-client-space-mobile">Espace client</Link>
                        <ContactButton className="mt-2 rounded-lg bg-white px-4 py-3 text-center text-lg font-medium text-black transition hover:bg-[#d6d6d6]" data-agent-action="open-contact-modal-mobile-nav">
                            Planifier un appel
                        </ContactButton>
                    </nav>
                </div>
            )}
        </>
    );
}
