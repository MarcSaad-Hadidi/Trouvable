import 'server-only';

const DEFAULT_INTERVAL_MS = 1000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MistralRateLimiter {
    constructor(intervalMs = DEFAULT_INTERVAL_MS) {
        this.intervalMs = intervalMs;
        this.nextAllowedAt = 0;
        this.queue = Promise.resolve();
    }

    schedule(task) {
        const run = async () => {
            const now = Date.now();
            const waitMs = Math.max(0, this.nextAllowedAt - now);
            if (waitMs > 0) {
                await sleep(waitMs);
            }

            this.nextAllowedAt = Date.now() + this.intervalMs;
            return task();
        };

        const next = this.queue.then(run, run);
        this.queue = next.catch(() => undefined);
        return next;
    }
}

const mistralRateLimiter = new MistralRateLimiter(DEFAULT_INTERVAL_MS);

export function scheduleMistralRequest(task) {
    return mistralRateLimiter.schedule(task);
}
