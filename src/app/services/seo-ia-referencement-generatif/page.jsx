import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('seo-ia-referencement-generatif');

export const metadata = buildSeoGrowthMetadata(page);

export default function SeoIaReferencementGeneratifPage() {
    return <SeoGrowthPage page={page} />;
}

