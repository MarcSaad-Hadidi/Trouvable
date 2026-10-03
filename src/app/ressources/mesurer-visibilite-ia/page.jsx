import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('mesurer-visibilite-ia');

export const metadata = buildSeoGrowthMetadata(page);

export default function MesurerVisibiliteIaPage() {
    return <SeoGrowthPage page={page} />;
}
