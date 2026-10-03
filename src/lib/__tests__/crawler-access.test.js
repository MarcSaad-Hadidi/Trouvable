import { describe, it, expect } from 'vitest';
import { parseRobotsTxt, getCrawlerStatus, validateLlmsTxt, scoreLlmsTxt } from '../audit/crawler-access.js';

describe('parseRobotsTxt', () => {
    it('returns empty rules for null input', () => {
        const result = parseRobotsTxt(null);
        expect(result.rules).toEqual({});
        expect(result.hasSitemap).toBe(false);
    });

    it('parses wildcard disallow-all', () => {
        const robots = `User-agent: *\nDisallow: /`;
        const result = parseRobotsTxt(robots);
        expect(result.rules['*'].disallow).toContain('/');
    });

    it('detects sitemap directive', () => {
        const robots = `User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml`;
        const result = parseRobotsTxt(robots);
        expect(result.hasSitemap).toBe(true);
    });

    it('parses specific bot blocks', () => {
        const robots = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /private\nAllow: /public`;
        const result = parseRobotsTxt(robots);
        expect(result.rules.gptbot.disallow).toContain('/');
        expect(result.rules.claudebot.disallow).toContain('/private');
        expect(result.rules.claudebot.allow).toContain('/public');
    });

    it('ignores comments', () => {
        const robots = `# This is a comment\nUser-agent: *\nDisallow: /secret # inline comment`;
        const result = parseRobotsTxt(robots);
        expect(result.rules['*'].disallow).toContain('/secret');
    });

    it('parses crawl-delay', () => {
        const robots = `User-agent: GPTBot\nCrawl-delay: 10`;
        const result = parseRobotsTxt(robots);
        expect(result.rules.gptbot.crawlDelay).toBe(10);
    });

    it('normalizes crawler keys case-insensitively', () => {
        const robots = `User-agent: gptbot\nDisallow: /private`;
        const result = parseRobotsTxt(robots);
        expect(result.rules.gptbot.disallow).toContain('/private');
        expect(getCrawlerStatus('GPTBot', result)).toBe('restricted');
    });

    it('supports grouped user-agent blocks', () => {
        const robots = `User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /secret`;
        const result = parseRobotsTxt(robots);
        expect(getCrawlerStatus('GPTBot', result)).toBe('restricted');
        expect(getCrawlerStatus('ClaudeBot', result)).toBe('restricted');
    });
});

describe('getCrawlerStatus', () => {
    it('returns allowed when no rules exist', () => {
        const parsed = parseRobotsTxt('User-agent: *\nAllow: /');
        expect(getCrawlerStatus('GPTBot', parsed)).toBe('allowed');
    });

    it('returns blocked when root is disallowed for specific bot', () => {
        const parsed = parseRobotsTxt('User-agent: GPTBot\nDisallow: /');
        expect(getCrawlerStatus('GPTBot', parsed)).toBe('blocked');
    });

    it('returns restricted when root is disallowed but some paths allowed', () => {
        const parsed = parseRobotsTxt('User-agent: GPTBot\nDisallow: /\nAllow: /public');
        expect(getCrawlerStatus('GPTBot', parsed)).toBe('restricted');
    });

    it('returns restricted when specific paths are blocked', () => {
        const parsed = parseRobotsTxt('User-agent: GPTBot\nDisallow: /private');
        expect(getCrawlerStatus('GPTBot', parsed)).toBe('restricted');
    });

    it('falls back to wildcard rules', () => {
        const parsed = parseRobotsTxt('User-agent: *\nDisallow: /');
        expect(getCrawlerStatus('GPTBot', parsed)).toBe('blocked');
        expect(getCrawlerStatus('ClaudeBot', parsed)).toBe('blocked');
    });

    it('returns unknown when no relevant rules exist', () => {
        const parsed = parseRobotsTxt('User-agent: Googlebot\nDisallow: /');
        expect(getCrawlerStatus('GPTBot', parsed)).toBe('unknown');
    });
});

describe('validateLlmsTxt', () => {
    it('returns invalid for empty content', () => {
        expect(validateLlmsTxt(null)).toEqual({ valid: false, reason: 'empty' });
        expect(validateLlmsTxt('')).toEqual({ valid: false, reason: 'empty' });
    });

    it('returns invalid when H1 is missing', () => {
        const content = 'No heading here\nJust some text.';
        expect(validateLlmsTxt(content)).toEqual({ valid: false, reason: 'missing_h1' });
    });

    it('returns minimal when only H1 is present', () => {
        const content = '# My Company\nSome description text.';
        expect(validateLlmsTxt(content)).toEqual({ valid: true, reason: 'minimal' });
    });

    it('returns partial when H2 or links are present but not both', () => {
        const content = '# My Company\n## Services\nWe do things.';
        expect(validateLlmsTxt(content)).toEqual({ valid: true, reason: 'partial' });
    });

    it('returns complete when H1, H2, and links are present', () => {
        const content = '# My Company\n\n## About\nWe are a company.\n\n## Links\n- [Homepage](https://example.com)';
        expect(validateLlmsTxt(content)).toEqual({ valid: true, reason: 'complete' });
    });
});

describe('scoreLlmsTxt', () => {
    it('returns 0 when not found', () => {
        expect(scoreLlmsTxt({ found: false, hasFullVersion: false, validation: { valid: false, reason: 'absent' } })).toBe(0);
    });

    it('returns 30 for invalid format', () => {
        expect(scoreLlmsTxt({ found: true, hasFullVersion: false, validation: { valid: false, reason: 'missing_h1' } })).toBe(30);
    });

    it('returns 50 for minimal valid', () => {
        expect(scoreLlmsTxt({ found: true, hasFullVersion: false, validation: { valid: true, reason: 'minimal' } })).toBe(50);
    });

    it('returns 80 for complete without full version', () => {
        expect(scoreLlmsTxt({ found: true, hasFullVersion: false, validation: { valid: true, reason: 'complete' } })).toBe(80);
    });

    it('returns 95 for complete with full version', () => {
        expect(scoreLlmsTxt({ found: true, hasFullVersion: true, validation: { valid: true, reason: 'complete' } })).toBe(95);
    });
});
