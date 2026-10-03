import { SITE_URL } from '@/lib/site-config';

export const metadata = {
    title: 'Documentation API | Trouvable',
    description: 'Documentation concise des endpoints publics et des artefacts de decouverte pour agents.',
    alternates: {
        canonical: '/docs/api',
    },
};

export default function ApiDocsPage() {
    const items = [
        {
            title: 'API Catalog',
            href: '/.well-known/api-catalog',
            description: 'Catalogue machine-readable des APIs exposees.',
        },
        {
            title: 'OpenAPI',
            href: '/.well-known/openapi.json',
            description: 'Description OpenAPI du point de terminaison public.',
        },
        {
            title: 'Health Endpoint',
            href: '/api/health',
            description: 'Etat courant du service.',
        },
        {
            title: 'OAuth Authorization Server Metadata',
            href: '/.well-known/oauth-authorization-server',
            description: 'Metadonnees OAuth 2.0 pour la decouverte des flux d authentification.',
        },
        {
            title: 'OAuth Protected Resource Metadata',
            href: '/.well-known/oauth-protected-resource',
            description: 'Metadonnees du resource server pour agents OAuth.',
        },
    ];

    return (
        <main className="mx-auto max-w-4xl px-6 py-16">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Documentation API</h1>
            <p className="mt-3 text-zinc-600">
                Cette page regroupe les endpoints utilises pour la decouverte automatisee d API et l integration d agents.
            </p>

            <ul className="mt-10 space-y-4">
                {items.map((item) => (
                    <li key={item.href} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                        <h2 className="text-lg font-semibold text-zinc-900">{item.title}</h2>
                        <p className="mt-1 text-sm text-zinc-600">{item.description}</p>
                        <a
                            className="mt-3 inline-flex text-sm font-medium text-orange-700 hover:text-orange-800"
                            href={item.href}
                        >
                            {SITE_URL}
                            {item.href}
                        </a>
                    </li>
                ))}
            </ul>
        </main>
    );
}
