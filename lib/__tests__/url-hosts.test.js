import { describe, expect, it } from 'vitest';

import {
    hasBlockedNavigationScheme,
    hostnameFromInput,
    hostnameMatches,
    inputMatchesHostname,
} from '../audit/url-hosts.js';

describe('url host helpers', () => {
    it('blocks executable navigation schemes with whitespace obfuscation', () => {
        expect(hasBlockedNavigationScheme(' javascript:alert(1)')).toBe(true);
        expect(hasBlockedNavigationScheme('da ta:text/html,<script>')).toBe(true);
        expect(hasBlockedNavigationScheme('\nVBScript:msgbox(1)')).toBe(true);
        expect(hasBlockedNavigationScheme('/contact')).toBe(false);
    });

    it('matches exact hosts and subdomains only', () => {
        expect(hostnameMatches('www.reddit.com', 'reddit.com')).toBe(true);
        expect(inputMatchesHostname('https://maps.apple.com/place', 'maps.apple.com')).toBe(true);
        expect(inputMatchesHostname('https://evil.com/?next=reddit.com', 'reddit.com')).toBe(false);
        expect(inputMatchesHostname('https://notreddit.com/path', 'reddit.com')).toBe(false);
    });

    it('normalizes hostnames from URLs and raw domains', () => {
        expect(hostnameFromInput('https://www.Example.com/path')).toBe('example.com');
        expect(hostnameFromInput('www.Example.com/path')).toBe('example.com');
    });
});
