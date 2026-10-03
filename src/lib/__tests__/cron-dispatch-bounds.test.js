import { describe, it, expect } from 'vitest';

// Teste la logique des bornes sur les params cron dispatch
function toInteger(value, fallback) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDispatchParams(searchParams) {
    let maxJobsToQueue = toInteger(searchParams.get('maxJobsToQueue'), 24);
    let maxRunsToExecute = toInteger(searchParams.get('maxRunsToExecute'), 8);
    maxJobsToQueue = Math.min(maxJobsToQueue, 100);
    maxRunsToExecute = Math.min(maxRunsToExecute, 50);
    return { maxJobsToQueue, maxRunsToExecute };
}

function makeParams(obj) {
    return { get: (k) => obj[k] ?? null };
}

describe('Cron dispatch — bornes des paramètres', () => {
    it('utilise les valeurs par défaut si params absents', () => {
        const { maxJobsToQueue, maxRunsToExecute } = parseDispatchParams(makeParams({}));
        expect(maxJobsToQueue).toBe(24);
        expect(maxRunsToExecute).toBe(8);
    });

    it('cap maxJobsToQueue à 100 max', () => {
        const { maxJobsToQueue } = parseDispatchParams(makeParams({ maxJobsToQueue: '9999' }));
        expect(maxJobsToQueue).toBe(100);
    });

    it('cap maxRunsToExecute à 50 max', () => {
        const { maxRunsToExecute } = parseDispatchParams(makeParams({ maxRunsToExecute: '9999' }));
        expect(maxRunsToExecute).toBe(50);
    });

    it('accepte des valeurs valides sous le cap', () => {
        const { maxJobsToQueue, maxRunsToExecute } = parseDispatchParams(
            makeParams({ maxJobsToQueue: '10', maxRunsToExecute: '5' })
        );
        expect(maxJobsToQueue).toBe(10);
        expect(maxRunsToExecute).toBe(5);
    });

    it('retourne le fallback pour une valeur non-numérique', () => {
        const { maxJobsToQueue } = parseDispatchParams(makeParams({ maxJobsToQueue: 'abc' }));
        expect(maxJobsToQueue).toBe(24);
    });

    it('accepte exactement la valeur cap', () => {
        const { maxJobsToQueue, maxRunsToExecute } = parseDispatchParams(
            makeParams({ maxJobsToQueue: '100', maxRunsToExecute: '50' })
        );
        expect(maxJobsToQueue).toBe(100);
        expect(maxRunsToExecute).toBe(50);
    });
});
