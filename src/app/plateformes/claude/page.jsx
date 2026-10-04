import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('claude');

export const metadata = buildSeoGrowthMetadata(page);

export default function ClaudeAppPage() {
    return <SeoGrowthPage page={page} />;
}
