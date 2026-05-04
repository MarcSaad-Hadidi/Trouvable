import { load } from 'cheerio';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
    extractLocalSignals,
    extractSocialLinks,
    extractTrustSignals,
} from '../audit/extraction-helpers.js';

describe('audit extraction URL sanitization', () => {
    it('keeps social links for exact hosts and rejects domain substrings in attacker hosts', () => {
        const $ = load(`
            <a href="https://www.facebook.com/trouvable">Facebook</a>
            <a href="https://evil.example/?next=facebook.com">Fake</a>
            <a href="https://notinstagram.com/profile">Fake Instagram</a>
        `);

        expect(extractSocialLinks($)).toEqual(['https://www.facebook.com/trouvable']);
    });

    it('classifies social networks by hostname', () => {
        const result = extractTrustSignals('avis client', [
            'https://x.com/trouvable',
            'https://evil.example/?next=x.com',
        ]);

        expect(result.social_networks).toEqual(['x']);
    });

    it('keeps maps links for expected hosts and rejects substring matches', () => {
        const $ = load(`
            <a href="https://www.google.com/maps/place/Trouvable">Google Maps</a>
            <a href="https://maps.apple.com/?q=Trouvable">Apple Maps</a>
            <a href="https://evil.example/google.com/maps">Fake Maps</a>
        `);

        const result = extractLocalSignals($, '', [], 'https://trouvable.com');
        expect(result.maps_links).toEqual([
            'https://www.google.com/maps/place/Trouvable',
            'https://maps.apple.com/?q=Trouvable',
        ]);
    });
});
