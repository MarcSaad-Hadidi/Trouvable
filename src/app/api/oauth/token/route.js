import { NextResponse } from 'next/server';

export async function POST() {
    return NextResponse.json(
        {
            error: 'unsupported_grant_type',
            status: 400,
            detail: 'Token issuance is not enabled on this public endpoint.',
        },
        { status: 400 },
    );
}
