import GeoSeoInjector from '@/features/public/shared/GeoSeoInjector';
import TrouvableLandingPage from '@/features/public/home/TrouvablePremiumPreview';
import { HOME_QUICK_ANSWERS } from '@/features/public/home/home-faqs';
import { SITE_URL } from '@/lib/site-config';

export default function HomePage() {
    return (
        <>
            <GeoSeoInjector
                organization={true}
                baseUrl={SITE_URL}
                faqs={HOME_QUICK_ANSWERS}
                includeWebsite={true}
                includeProfessionalService={true}
                includeHomepageItemList={true}
            />
            <TrouvableLandingPage />
        </>
    );
}
