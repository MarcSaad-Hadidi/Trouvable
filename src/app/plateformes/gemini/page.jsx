import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('gemini');

export const metadata = buildSeoGrowthMetadata(page);

export default function GeminiPage() {
    return <SeoGrowthPage page={page} />;
}
