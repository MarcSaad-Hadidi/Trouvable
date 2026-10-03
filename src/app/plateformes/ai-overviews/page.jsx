import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('ai-overviews');

export const metadata = buildSeoGrowthMetadata(page);

export default function AiOverviewsPage() {
    return <SeoGrowthPage page={page} />;
}

