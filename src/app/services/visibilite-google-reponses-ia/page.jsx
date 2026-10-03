import SeoGrowthPage from '@/features/public/seo-growth/SeoGrowthPage';
import { buildSeoGrowthMetadata, getSeoGrowthPage } from '@/lib/data/seo-growth-pages';

const page = getSeoGrowthPage('visibilite-google-reponses-ia');

export const metadata = buildSeoGrowthMetadata(page);

export default function VisibiliteGoogleReponsesIaPage() {
    return <SeoGrowthPage page={page} />;
}

