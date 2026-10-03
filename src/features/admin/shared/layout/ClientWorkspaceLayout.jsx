import ClientWorkspaceShell from '@/features/admin/shared/layout/ClientWorkspaceShell';

export const dynamic = 'force-dynamic';

export default async function ClientLayout({ children, params }) {
    const { clientId } = await params;
    return <ClientWorkspaceShell clientId={clientId}>{children}</ClientWorkspaceShell>;
}

