import Link from "next/link";
import ContactButton from "./ContactButton";
import NavbarMobileMenu from "./NavbarMobileMenu";

export default function Navbar() {
    return (
        <>
            <header
                className="fixed left-0 right-0 top-0 z-50 flex h-[58px] items-center gap-8 border-b border-white/7 bg-[#080808]/88 px-7 backdrop-blur-2xl transition"
                data-agent-surface="primary-nav"
            >
                <Link href="/" className="-ml-2 flex min-h-12 shrink-0 items-center gap-2 rounded-lg px-2 text-[15px] font-semibold tracking-[-0.025em] text-white outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]" data-agent-action="nav-home">
                    <img
                        src="/logos/trouvable_logo_blanc1.png"
                        alt="Logo Trouvable"
                        width="22"
                        height="22"
                        className="h-[22px] w-[22px] object-contain"
                    />
                    Trouvable
                </Link>

                <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
                    <Link href="/offres" className="rounded-[7px] px-3 py-1.5 text-[13.5px] font-[450] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-offres">Mandats</Link>
                    <Link href="/services/audit-visibilite-ia" className="rounded-[7px] px-3 py-1.5 text-[13.5px] font-[450] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-audit-ia">Audit IA</Link>
                    <Link href="/methodologie" className="rounded-[7px] px-3 py-1.5 text-[13.5px] font-[450] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-methodologie">Méthodologie</Link>
                    <Link href="/etudes-de-cas" className="rounded-[7px] px-3 py-1.5 text-[13.5px] font-[450] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-case-studies">Cas clients</Link>
                    <Link href="/a-propos" className="rounded-[7px] px-3 py-1.5 text-[13.5px] font-[450] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-about" toolname="navigate_page" tooldescription="Ouvrir la page À propos de Trouvable pour vérifier l'identité et les signaux de confiance.">À propos</Link>
                    <Link href="/recherche" className="rounded-[7px] px-3 py-1.5 text-[13.5px] font-[450] text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-search" toolname="navigate_page" tooldescription="Ouvrir la recherche publique Trouvable.">Recherche</Link>
                </nav>

                <div className="flex-1" />
                <div className="hidden items-center gap-2 sm:flex">
                    <Link href="/espace" className="rounded-[7px] px-3.5 py-1.5 text-[13.5px] font-medium text-[#a0a0a0] transition hover:bg-white/5 hover:text-white" data-agent-action="nav-client-space">Espace client</Link>
                    <ContactButton className="rounded-[7px] bg-white px-4 py-1.5 text-[13.5px] font-medium text-black transition hover:bg-[#d6d6d6]" data-agent-action="open-contact-modal-nav">
                        Planifier un appel
                    </ContactButton>
                </div>
                <NavbarMobileMenu />
            </header>

            <div className="h-[58px]" />
        </>
    );
}
