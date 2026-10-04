import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('strategie-visibilite-ia');

export const metadata = buildSeoGrowthMetadata(page);

export default function StrategieVisibiliteIaPage() {
    return <SeoGrowthPage page={page} />;
}
