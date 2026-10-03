import { NextResponse } from 'next/server';

export function GET() {
    return NextResponse.json(
        {
            error: 'unsupported_response_type',
            status: 400,
            detail: 'OAuth authorization is not enabled for interactive flows on this endpoint.',
        },
        { status: 400 },
    );
}
