import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('copilot');

export const metadata = buildSeoGrowthMetadata(page);

export default function CopilotPage() {
    return <SeoGrowthPage page={page} />;
}
