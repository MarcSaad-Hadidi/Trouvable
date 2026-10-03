import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('geo-vs-seo');

export const metadata = buildSeoGrowthMetadata(page);

export default function GeoVsSeoPage() {
    return <SeoGrowthPage page={page} />;
}

