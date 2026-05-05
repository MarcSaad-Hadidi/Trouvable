import { notFound } from "next/navigation";
import { EXPERTISES, VILLES } from "@/lib/data/geo-architecture";
import { resolveExpertiseComposition } from "@/lib/data/composition";
import { SITE_URL } from "@/lib/site-config";
import { fitMetaDescription, withPublicAuthor } from "@/lib/seo/metadata";
import ExpertisePageClient from "@/features/public/expertise/ExpertisePageClient";

export function generateStaticParams() {
    return EXPERTISES.map((e) => ({ expertiseSlug: e.slug }));
}

export async function generateMetadata({ params }) {
    const { expertiseSlug } = await params;
    const expertise = EXPERTISES.find((e) => e.slug === expertiseSlug);
    if (!expertise) return {};

    const title = `${expertise.name} | Visibilité IA | Trouvable`;
    const description = fitMetaDescription(expertise.description);

    return withPublicAuthor({
        title,
        description,
        alternates: { canonical: `${SITE_URL}/expertises/${expertise.slug}` },
        openGraph: {
            title,
            description,
            url: `${SITE_URL}/expertises/${expertise.slug}`,
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

export default async function ExpertisePage({ params }) {
    const { expertiseSlug } = await params;
    const expertise = EXPERTISES.find((e) => e.slug === expertiseSlug);
    if (!expertise) notFound();

    const composition = resolveExpertiseComposition(expertise);
    const linkedVilles = expertise.linkedVilles
        .map((s) => VILLES.find((v) => v.slug === s))
        .filter(Boolean);

    return (
        <ExpertisePageClient
            expertise={expertise}
            composition={composition}
            linkedVilles={linkedVilles}
        />
    );
}

