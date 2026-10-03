import { EXPERTISES, VILLES } from '@/lib/data/geo-architecture';
import { SEO_GROWTH_PAGES } from '@/lib/data/seo-growth-pages';
import { SITE_URL } from '@/lib/site-config';
import { buildPublicMetadata } from '@/lib/seo/metadata';
import SearchClient from './search-client';

const STATIC_PAGES = [
    { title: 'Accueil', href: '/', description: 'Positionnement, mandats et FAQ.', isStatic: true },
    { title: 'À propos de Trouvable', href: '/a-propos', description: 'Identité, principes et signaux de confiance Trouvable.', isStatic: true },
    { title: 'Mandats', href: '/offres', description: 'Cartographie, implantation et pilotage continu.', isStatic: true },
    { title: 'Méthodologie', href: '/methodologie', description: 'Protocole d’exécution en 4 étapes.', isStatic: true },
    { title: 'Cadre de mesure', href: '/notre-mesure', description: 'Signal, présence et business sans confusion.', isStatic: true },
    { title: 'Études de cas', href: '/etudes-de-cas', description: 'Retours d’expérience et dossier-type.', isStatic: true },
    { title: 'Contact', href: '/contact', description: 'Démarrer un appel de cadrage.', isStatic: true },
];

export const metadata = buildPublicMetadata({
    title: 'Recherche | Trouvable',
    description: 'Recherchez les pages publiques Trouvable : mandats, méthodologie, services GEO, villes couvertes, expertises sectorielles et ressources IA.',
    canonical: `${SITE_URL}/recherche`,
});

function buildSearchIndex() {
    const seoGrowthItems = SEO_GROWTH_PAGES.map((page) => ({
        title: page.h1,
        href: page.path,
        description: page.description,
        keywords: `${page.keyword} ${page.secondaryKeywords.join(' ')} ${page.eyebrow}`,
        isStatic: false,
    }));

    const expertiseItems = EXPERTISES.map((expertise) => ({
        title: expertise.name,
        href: `/expertises/${expertise.slug}`,
        description: expertise.description,
        keywords: `expertise ${expertise.name} ${expertise.slug}`,
        isStatic: false,
    }));

    const cityItems = VILLES.map((city) => ({
        title: `Visibilité IA à ${city.name}`,
        href: `/villes/${city.slug}`,
        description: city.description,
        keywords: `ville ${city.name} ${city.slug}`,
        isStatic: false,
    }));

    return [...STATIC_PAGES, ...seoGrowthItems, ...expertiseItems, ...cityItems];
}

export default async function RecherchePage({ searchParams }) {
    const resolvedSearchParams = await searchParams;
    const rawQuery = typeof resolvedSearchParams?.q === 'string' ? resolvedSearchParams.q : '';

    const index = buildSearchIndex();

    return (
        <main className="min-h-screen bg-[#080808] px-4 py-20 text-[#f0f0f0] sm:px-6 lg:px-8 relative overflow-hidden">
            {/* Background elements for premium feel */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#5b73ff]/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 w-full max-w-[1200px] mx-auto">
                <SearchClient index={index} initialQuery={rawQuery} />
            </div>
        </main>
    );
}
