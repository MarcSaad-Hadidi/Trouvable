import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('chatgpt');

export const metadata = buildSeoGrowthMetadata(page);

export default function ChatgptPage() {
    return <SeoGrowthPage page={page} />;
}

