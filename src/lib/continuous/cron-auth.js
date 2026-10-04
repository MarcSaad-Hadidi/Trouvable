import 'server-only';

export function assertCronAuthorized(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        throw new Error('CRON_SECRET is missing. Cron endpoints are disabled until it is configured.');
    }

    const authHeader = request.headers.get('authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
    const headerToken = request.headers.get('x-cron-secret') || '';

    const isAuthorized = bearerToken === secret || headerToken === secret;
    if (!isAuthorized) {
        const error = new Error('Unauthorized cron request');
        error.code = 'CRON_UNAUTHORIZED';
        throw error;
    }
}
