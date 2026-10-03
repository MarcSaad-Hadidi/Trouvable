import { describe, expect, it } from 'vitest';

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
        expect(context.inspectionTargets).toContain('features/public/shared/GeoSeoInjector.jsx');
        expect(context.inspectionTargets).toContain('app/layout.jsx');
        expect(context.missingFields).toContain('Fichier exact a modifier non confirme par les donnees detectees.');
        expect(context.missingFields).toContain('Route ou page precise a confirmer humainement si le probleme n est pas sitewide.');
        expect(context.constraints.absolute).toContain('Ne pas inventer de preuve, de fichier ou de donnees manquantes.');
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
        expect(context.verifiedPaths).toContain('app/robots.txt/route.js');
        expect(context.verifiedPaths).toContain('app/sitemap.js');
        expect(context.repoFacts.some((item) => item.includes('app/robots.txt/route.js'))).toBe(true);
        expect(context.repoFacts.some((item) => item.includes('public/robots.txt'))).toBe(true);
        expect(context.validationTargets.some((item) => item.includes('/robots.txt'))).toBe(true);
    });
});
