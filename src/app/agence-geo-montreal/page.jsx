import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('agence-geo-montreal');

export const metadata = buildSeoGrowthMetadata(page);

export default function AgenceGeoMontrealPage() {
    return <SeoGrowthPage page={page} />;
}

