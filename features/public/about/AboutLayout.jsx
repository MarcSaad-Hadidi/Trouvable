import GeoSeoInjector from '@/features/public/shared/GeoSeoInjector';
import { SITE_URL } from '@/lib/site-config';
import { buildPublicMetadata } from '@/lib/seo/metadata';

export const metadata = buildPublicMetadata({
    title: 'À propos de Trouvable | Firme d\'exécution en visibilité organique',
    description:
        'Trouvable est une firme québécoise d’exécution en visibilité Google, SEO local et réponses IA, avec mandats cadrés et livrables vérifiables.',
    canonical: '/a-propos',
    openGraph: {
        title: 'À propos de Trouvable | Firme d\'exécution en visibilité organique',
        description:
            'Firme d’exécution basée au Québec : visibilité Google, cohérence dans les réponses IA, cartographie, implantation et pilotage continu.',
        url: '/a-propos',
    },
});

export default function AboutLayout({ children }) {
    return (
        <>
            <GeoSeoInjector
                organization={true}
                baseUrl={SITE_URL}
                breadcrumbs={[
                    { name: 'Accueil', url: '/' },
                    { name: 'À propos', url: '/a-propos' },
                ]}
            />
            {children}
        </>
    );
}
