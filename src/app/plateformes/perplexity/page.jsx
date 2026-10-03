import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('perplexity');

export const metadata = buildSeoGrowthMetadata(page);

export default function PerplexityPage() {
    return <SeoGrowthPage page={page} />;
}

