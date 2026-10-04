import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listOperatorClients } from '@/lib/operator-data';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    try {
        const clients = await listOperatorClients();
        return NextResponse.json({ clients });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
