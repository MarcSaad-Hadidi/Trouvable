import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('structurer-site-moteurs-ia');

export const metadata = buildSeoGrowthMetadata(page);

export default function StructurerSiteMoteursIaPage() {
    return <SeoGrowthPage page={page} />;
}
