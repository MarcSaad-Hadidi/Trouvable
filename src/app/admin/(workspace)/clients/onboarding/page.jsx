import ClientOnboardingPage from '@/features/admin/portfolio/ClientOnboardingPage';
import AdminPageViewport from '@/features/admin/shared/layout/AdminPageViewport';

export { metadata } from '@/features/admin/portfolio/ClientOnboardingPage';

export default function OnboardingPage() {
    return (
        <AdminPageViewport>
            <ClientOnboardingPage />
        </AdminPageViewport>
    );
}
