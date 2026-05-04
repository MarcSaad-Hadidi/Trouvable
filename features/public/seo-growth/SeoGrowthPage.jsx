import Navbar from '@/features/public/shared/Navbar';
import SiteFooter from '@/features/public/shared/SiteFooter';
import GeoSeoInjector from '@/features/public/shared/GeoSeoInjector';
import {
    buildSeoGrowthArticleSchema,
    buildSeoGrowthHowToSchema,
    buildSeoGrowthItemListSchema,
    buildSeoGrowthServiceSchema,
    getSeoGrowthKeyTakeaways,
    getSeoGrowthReferences,
} from '@/lib/data/seo-growth-pages';
import { SITE_URL } from '@/lib/site-config';

/* ── Per-page unique components ── */
import AgenceGeoMontrealPage from './pages/AgenceGeoMontrealPage';
import AuditVisibiliteIaPage from './pages/AuditVisibiliteIaPage';
import VisibiliteGoogleReponsesIaPage from './pages/VisibiliteGoogleReponsesIaPage';
import SeoIaReferencementGeneratifPage from './pages/SeoIaReferencementGeneratifPage';
import ChatgptPage from './pages/ChatgptPage';
import PerplexityPage from './pages/PerplexityPage';
import AiOverviewsPage from './pages/AiOverviewsPage';
import GeoVsSeoPage from './pages/GeoVsSeoPage';
import AgenceGeoQuebecPage from './pages/AgenceGeoQuebecPage';
import AccompagnementGeoPage from './pages/AccompagnementGeoPage';
import StrategieVisibiliteIaPage from './pages/StrategieVisibiliteIaPage';
import GeminiPage from './pages/GeminiPage';
import CopilotPage from './pages/CopilotPage';
import ClaudePage from './pages/ClaudePage';
import MesurerVisibiliteIaPage from './pages/MesurerVisibiliteIaPage';
import StructurerSiteMoteursIaPage from './pages/StructurerSiteMoteursIaPage';

const PAGE_COMPONENTS = {
    'agence-geo-montreal': AgenceGeoMontrealPage,
    'audit-visibilite-ia': AuditVisibiliteIaPage,
    'visibilite-google-reponses-ia': VisibiliteGoogleReponsesIaPage,
    'seo-ia-referencement-generatif': SeoIaReferencementGeneratifPage,
    'chatgpt': ChatgptPage,
    'perplexity': PerplexityPage,
    'ai-overviews': AiOverviewsPage,
    'geo-vs-seo': GeoVsSeoPage,
    'agence-geo-quebec': AgenceGeoQuebecPage,
    'accompagnement-geo': AccompagnementGeoPage,
    'strategie-visibilite-ia': StrategieVisibiliteIaPage,
    'gemini': GeminiPage,
    'copilot': CopilotPage,
    'claude': ClaudePage,
    'mesurer-visibilite-ia': MesurerVisibiliteIaPage,
    'structurer-site-moteurs-ia': StructurerSiteMoteursIaPage,
};

export default function SeoGrowthPage({ page }) {
    const breadcrumbs = [
        { name: 'Accueil', url: '/' },
        page.parent ? { name: page.parent.label, url: page.parent.href } : null,
        { name: page.shortTitle, url: page.path },
    ].filter(Boolean);
    const howTo = buildSeoGrowthHowToSchema(page);
    const article = buildSeoGrowthArticleSchema(page);
    const itemList = buildSeoGrowthItemListSchema(page);

    const UniquePageComponent = PAGE_COMPONENTS[page.slug];

    return (
        <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
            <Navbar />
            <GeoSeoInjector
                baseUrl={SITE_URL}
                faqs={page.faqs}
                breadcrumbs={breadcrumbs}
                service={page.type === 'service' ? buildSeoGrowthServiceSchema(page) : undefined}
                article={article}
                itemList={itemList}
                howTo={howTo || undefined}
            />
            {UniquePageComponent ? (
                <UniquePageComponent page={page} trustBrief={null} />
            ) : (
                <FallbackPage page={page} />
            )}

            <SeoGrowthTrustBrief page={page} />

            <SiteFooter />
        </div>
    );
}

function SeoGrowthTrustBrief({ page }) {
    const takeaways = getSeoGrowthKeyTakeaways(page);
    const references = getSeoGrowthReferences(page);

    return (
        <section className="border-b border-white/[0.06] bg-[#080808] px-6 py-7 sm:px-10">
            <div className="mx-auto grid max-w-[1120px] gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
                <div>
                    <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7b8fff]">À retenir</div>
                    <ul className="grid gap-3 text-[13.5px] leading-[1.65] text-white/68 md:grid-cols-3">
                        {takeaways.map((item) => (
                            <li key={item} className="border-l border-white/10 pl-4">
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
                <aside className="text-[12px] leading-[1.65] text-white/45">
                    <div className="font-semibold uppercase tracking-[0.12em] text-white/55">Par Trouvable</div>
                    <div className="mt-1">Sources et références techniques utilisées pour cadrer le contenu.</div>
                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                        {references.map((reference) => (
                            <a
                                key={reference.url}
                                href={reference.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#aebaff] underline decoration-white/10 underline-offset-4 transition hover:text-white"
                            >
                                {reference.name}
                            </a>
                        ))}
                    </div>
                </aside>
            </div>
        </section>
    );
}

/* ── Minimal fallback for safety ── */
function FallbackPage({ page }) {
    return (
        <main className="mx-auto max-w-[960px] px-6 pt-[140px] pb-20">
            <h1 className="text-4xl font-bold">{page.h1}</h1>
            <p className="mt-4 text-[#a0a0a0]">{page.summary}</p>
        </main>
    );
}
