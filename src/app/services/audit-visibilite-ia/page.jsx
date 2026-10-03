import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('audit-visibilite-ia');

export const metadata = buildSeoGrowthMetadata(page);

export default function AuditVisibiliteIaPage() {
    return <SeoGrowthPage page={page} />;
}

