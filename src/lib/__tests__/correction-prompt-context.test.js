import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import {
    buildSeoHealthCorrectionPromptContext,
    getCorrectionPromptCategory,
} from '../correction-prompts/seo-health-context';

describe('getCorrectionPromptCategory', () => {
    it('classifies schema issues as schema readiness', () => {
        const category = getCorrectionPromptCategory({
            title: 'Schema manquant ou incoherent',
            description: 'Le JSON-LD est absent sur la page d entree.',
            category: 'technical',
            dimension: 'technical_seo',
        });

        expect(category).toBe('schema_readiness');
    });

    it('classifies crawler and robots issues as ai citation issues', () => {
        const category = getCorrectionPromptCategory({
            title: 'Robots access issue',
            description: 'Major AI crawlers are restricted by robots.txt rules.',
            category: 'technical',
            dimension: 'technical_seo',
        });

        expect(category).toBe('citation_ai');
    });
});

describe('buildSeoHealthCorrectionPromptContext', () => {
    it('assembles deterministic context from a real SEO health issue without inventing missing fields', () => {
        const context = buildSeoHealthCorrectionPromptContext({
            client: {
                id: 'client-1',
                client_name: 'Trouvable',
                website_url: 'https://example.com',
            },
            audit: {
                id: 'audit-1',
                created_at: '2026-04-16T12:00:00.000Z',
                resolved_url: 'https://example.com',
            },
            issue: {
                id: 'problem_schema',
                title: 'Schema manquant ou incoherent',
                description: 'Le JSON-LD LocalBusiness est absent ou incomplet.',
                priority: 'high',
                category: 'technical',
                dimension: 'technical_seo',
                truth_class: 'observed',
                confidence: 'high',
                evidence: 'Aucune entite Schema.org persistente n a ete detectee sur la page auditee.',
                recommendedFix: 'Ajouter un JSON-LD conforme aux donnees visibles.',
                sourceUrl: 'https://example.com',
            },
        });

        expect(context.problem.category).toBe('schema_readiness');
        expect(context.problem.truthState).toBe('observed');
        expect(context.evidence.summary).toContain('Schema.org');
        expect(context.inspectionTargets).toContain('src/features/public/shared/GeoSeoInjector.jsx');
        expect(context.inspectionTargets).toContain('src/app/layout.jsx');
        expect(context.missingFields).toContain('Fichier exact a modifier non confirme par les donnees detectees.');
        expect(context.missingFields).toContain(
            'Route ou page precise a confirmer humainement si le probleme n est pas sitewide.',
        );
        expect(context.constraints.absolute).toContain(
            'Ne pas inventer de preuve, de fichier ou de donnees manquantes.',
        );
    });

    it('adds repo-verified paths and validation hints for crawler blocking issues', () => {
        const context = buildSeoHealthCorrectionPromptContext({
            client: {
                id: 'client-2',
                client_name: 'Pulsefolio',
            },
            audit: {
                id: 'audit-2',
                created_at: '2026-04-17T17:51:46.216673+00:00',
                resolved_url: 'https://pulsefolio.app/',
            },
            issue: {
                id: 'problem_crawlers',
                title: 'Critical AI crawlers are blocked',
                description: '2 critical AI crawler(s) are blocked via robots.txt.',
                priority: 'medium',
                category: 'content',
                dimension: 'ai_answerability',
                truth_class: 'observed',
                confidence: 'high',
                evidence: 'Blocked: GPTBot, ClaudeBot.',
                recommendedFix: 'Review robots.txt directives for GPTBot and ClaudeBot.',
                sourceUrl: 'https://pulsefolio.app/',
            },
        });

        expect(context.problem.category).toBe('citation_ai');
        expect(context.verifiedPaths).toContain('src/app/robots.txt/route.js');
        expect(context.verifiedPaths).toContain('src/app/sitemap.js');
        expect(context.repoFacts.some((item) => item.includes('src/app/robots.txt/route.js'))).toBe(true);
        expect(context.repoFacts.some((item) => item.includes('public/robots.txt'))).toBe(true);
        expect(context.validationTargets.some((item) => item.includes('/robots.txt'))).toBe(true);
    });
});

describe('SEO correction paths after source relocation', () => {
    it.each([
        'Homepage canonical missing',
        'Structured data schema issue',
        'FAQ content issue',
        'New page coverage opportunity',
    ])('verifies repository-relative source paths for %s', (title) => {
        const context = buildSeoHealthCorrectionPromptContext({
            client: { id: 'fixture', client_name: 'Fixture locale QA' },
            audit: { resolved_url: 'https://fixture.invalid/' },
            issue: { title, sourceUrl: 'https://fixture.invalid/' },
        });
        expect(context.verifiedPaths).toContain('src/app/layout.jsx');
        expect(context.verifiedPaths.filter((file) => !fs.existsSync(path.resolve(process.cwd(), file)))).toEqual([]);
    });

    it('checks public robots at the repository root rather than under src', () => {
        const actualExists = fs.existsSync;
        const robots = path.resolve(process.cwd(), 'public/robots.txt');
        const probe = vi
            .spyOn(fs, 'existsSync')
            .mockImplementation((file) => path.resolve(String(file)) === robots || actualExists(file));
        try {
            const context = buildSeoHealthCorrectionPromptContext({
                client: {},
                audit: {},
                issue: { title: 'Robots crawler issue' },
            });
            expect(context.repoFacts.some((fact) => fact.startsWith('Aucun fichier public/robots.txt'))).toBe(false);
        } finally {
            probe.mockRestore();
        }
    });
});
