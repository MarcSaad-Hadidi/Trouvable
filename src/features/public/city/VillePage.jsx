import { notFound } from "next/navigation";
import { VILLES, EXPERTISES } from "@/lib/data/geo-architecture";
import { resolveVilleComposition } from "@/lib/data/composition";
import { SITE_URL } from "@/lib/site-config";
import { fitMetaDescription, withPublicAuthor } from "@/lib/seo/metadata";
import VillePageClient from "@/features/public/city/VillePageClient";

export function generateStaticParams() {
    return VILLES.map((v) => ({ villeSlug: v.slug }));
}

export async function generateMetadata({ params }) {
    const { villeSlug } = await params;
    const ville = VILLES.find((v) => v.slug === villeSlug);
    if (!ville) return {};

    const title = `Visibilité IA à ${ville.name} | Trouvable`;
    const composition = resolveVilleComposition(ville);
    const description = fitMetaDescription(composition?.metaDescription || ville.description);

    return withPublicAuthor({
        title,
        description,
        alternates: { canonical: `${SITE_URL}/villes/${ville.slug}` },
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/villes/${ville.slug}`,
            siteName: "Trouvable",
            type: "website",
            images: [
                {
                    url: `${SITE_URL}/opengraph-image`,
                    width: 1200,
                    height: 630,
                    alt: title,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [`${SITE_URL}/twitter-image`],
        },
        robots: { index: true, follow: true },
    });
}

export default async function VillePage({ params }) {
    const { villeSlug } = await params;
    const ville = VILLES.find((v) => v.slug === villeSlug);
    if (!ville) notFound();

    const composition = resolveVilleComposition(ville);
    const linkedExpertises = ville.linkedExpertises
        .map((s) => EXPERTISES.find((e) => e.slug === s))
        .filter(Boolean);

    return (
        <VillePageClient
            ville={ville}
            composition={composition}
            linkedExpertises={linkedExpertises}
        />
    );
}

