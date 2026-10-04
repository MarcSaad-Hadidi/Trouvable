import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Créer un client - Admin',
};

export default function CreateClientPage() {
    redirect('/admin/clients/onboarding');
}
