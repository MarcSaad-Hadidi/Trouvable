import { NextResponse } from 'next/server';

export function GET() {
    return NextResponse.json(
        {
            ok: true,
            status: 'healthy',
            service: 'trouvable',
            time: new Date().toISOString(),
        },
        {
            status: 200,
        },
    );
}
