import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Nouveau client - Admin',
};

export default function NewClientHubPage() {
    redirect('/admin/clients/onboarding');
}
