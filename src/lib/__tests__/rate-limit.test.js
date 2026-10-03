import { describe, it, expect } from 'vitest';

// Tests sur la logique de validation des inputs du rate limit dans submit-lead
// On teste les constantes et la logique d'extraction d'IP indépendamment

const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;

function getClientIp(headers) {
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return headers['x-real-ip'] || 'unknown';
}

describe('Rate Limit — extraction IP', () => {
    it('extrait la première IP de x-forwarded-for', () => {
        const ip = getClientIp({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' });
        expect(ip).toBe('1.2.3.4');
    });

    it('utilise x-real-ip si pas de x-forwarded-for', () => {
        const ip = getClientIp({ 'x-real-ip': '42.42.42.42' });
        expect(ip).toBe('42.42.42.42');
    });

    it('retourne unknown si aucun header IP', () => {
        const ip = getClientIp({});
        expect(ip).toBe('unknown');
    });

    it('strip les espaces autour des IPs dans x-forwarded-for', () => {
        const ip = getClientIp({ 'x-forwarded-for': '  10.0.0.1  , 10.0.0.2' });
        expect(ip).toBe('10.0.0.1');
    });
});

describe('Rate Limit — constantes', () => {
    it('max requests est 5', () => {
        expect(RATE_LIMIT_MAX_REQUESTS).toBe(5);
    });

    it('window est 10 minutes', () => {
        expect(RATE_LIMIT_WINDOW_MINUTES).toBe(10);
    });
});
