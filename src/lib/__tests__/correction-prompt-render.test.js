import { describe, expect, it } from 'vitest';

import {
    assertCorrectionPromptPayload,
    finalizeCorrectionPromptPayload,
    renderCorrectionPromptVariant,
} from '../correction-prompts/render';

describe('renderCorrectionPromptVariant', () => {
    it('renders the required premium prompt sections in a stable order', () => {
        const text = renderCorrectionPromptVariant({
            mission: 'Corriger un probleme technique SEO reel.',
            contexte: 'Le probleme vient du dernier audit stocke dans Trouvable.',
            problemeDetecte: 'Le schema JSON-LD attendu est absent.',
            preuveDisponible: [
                'Aucune entite Schema.org persistente n a ete detectee sur la page auditee.',
            ],
            impactAttendu: 'Ameliorer la lisibilite machine de la page et la coherence SEO technique.',
            fichiersOuSurfacesAInspecter: [
                'app/layout.jsx',
                'features/public/shared/GeoSeoInjector.jsx',
            ],
            contraintesAbsolues: [
                'Ne pas inventer de donnees.',
                'Faire un fix minimal.',
            ],
            ceQueLiaDoitFaire: [
                'Inspecter les surfaces existantes avant de modifier le code.',
                'Corriger seulement la generation de schema concernee.',
            ],
            ceQueLiaNeDoitPasFaire: [
                'Ne pas refondre le SEO global.',
            ],
            validationAttendue: [
                'Verifier la presence du JSON-LD apres correction.',
            ],
            formatDuLivrableFinal: [
                'Resume bref des changements.',
            ],
            donneesManquantes: [
                'Le fichier exact n est pas confirme par la preuve actuelle.',
            ],
        });

        expect(text).toContain('Mission');
        expect(text).toContain('Contexte');
        expect(text).toContain('Probleme detecte');
        expect(text).toContain('Preuve disponible');
        expect(text).toContain('Validation attendue');
        expect(text).toContain('Format du livrable final');
    });
});

describe('assertCorrectionPromptPayload', () => {
    it('accepts a payload with both standard and strict variants', () => {
        const payload = {
            standard: {
                mission: 'Corriger un probleme technique SEO reel.',
                contexte: 'Contexte.',
                problemeDetecte: 'Probleme.',
                preuveDisponible: ['Preuve.'],
                impactAttendu: 'Impact.',
                fichiersOuSurfacesAInspecter: ['app/layout.jsx'],
                contraintesAbsolues: ['Ne pas inventer.'],
                ceQueLiaDoitFaire: ['Inspecter avant de modifier.'],
                ceQueLiaNeDoitPasFaire: ['Ne pas refondre.'],
                validationAttendue: ['Verifier le fix.'],
                formatDuLivrableFinal: ['Resume.'],
                donneesManquantes: [],
            },
            strict: {
                mission: 'Corriger le probleme sans sortir du perimetre.',
                contexte: 'Contexte strict.',
                problemeDetecte: 'Probleme.',
                preuveDisponible: ['Preuve.'],
                impactAttendu: 'Impact.',
                fichiersOuSurfacesAInspecter: ['app/layout.jsx'],
                contraintesAbsolues: ['Fix minimal.'],
                ceQueLiaDoitFaire: ['Inspect-first.'],
                ceQueLiaNeDoitPasFaire: ['Pas de refactor.'],
                validationAttendue: ['Validation obligatoire.'],
                formatDuLivrableFinal: ['Resume.'],
                donneesManquantes: [],
            },
        };

        expect(() => assertCorrectionPromptPayload(payload)).not.toThrow();
    });

    it('rejects payloads when a critical section is missing', () => {
        const payload = {
            standard: {
                mission: 'Mission.',
                contexte: 'Contexte.',
                problemeDetecte: 'Probleme.',
                preuveDisponible: [],
                impactAttendu: 'Impact.',
                fichiersOuSurfacesAInspecter: ['app/layout.jsx'],
                contraintesAbsolues: ['Ne pas inventer.'],
                ceQueLiaDoitFaire: ['Inspecter.'],
                ceQueLiaNeDoitPasFaire: ['Ne pas refondre.'],
                validationAttendue: ['Verifier.'],
                formatDuLivrableFinal: ['Resume.'],
                donneesManquantes: [],
            },
            strict: {
                mission: 'Mission.',
                contexte: 'Contexte.',
                problemeDetecte: 'Probleme.',
                preuveDisponible: ['Preuve.'],
                impactAttendu: 'Impact.',
                fichiersOuSurfacesAInspecter: ['app/layout.jsx'],
                contraintesAbsolues: ['Ne pas inventer.'],
                ceQueLiaDoitFaire: ['Inspecter.'],
                ceQueLiaNeDoitPasFaire: ['Ne pas refondre.'],
                validationAttendue: ['Verifier.'],
                formatDuLivrableFinal: ['Resume.'],
                donneesManquantes: [],
            },
        };

        expect(() => assertCorrectionPromptPayload(payload)).toThrow(/preuve/i);
    });
});

describe('finalizeCorrectionPromptPayload', () => {
    const context = {
        source: {
            surface: 'seo_health',
            auditCreatedAt: '2026-04-17T17:51:46.216673+00:00',
            clientName: 'Pulsefolio',
        },
        problem: {
            issueId: 'problem_crawlers',
            title: 'Critical AI crawlers are blocked',
            description: '2 critical AI crawler(s) are blocked via robots.txt.',
            category: 'citation_ai',
            severity: 'medium',
            type: 'content',
            dimension: 'ai_answerability',
            truthState: 'observed',
            confidence: 'high',
        },
        evidence: {
            summary: 'Blocked: GPTBot, ClaudeBot.',
            recommendedFix: 'Review robots.txt directives for GPTBot and ClaudeBot.',
            sourceUrl: 'https://pulsefolio.app/',
        },
        inspectionTargets: [
            'app/robots.txt/route.js',
            'app/sitemap.js',
            'URL observee: https://pulsefolio.app/',
        ],
        verifiedPaths: [
            'app/robots.txt/route.js',
            'app/sitemap.js',
        ],
        repoFacts: [
            'Chemin verifie present dans le repo: app/robots.txt/route.js.',
            'Aucun fichier public/robots.txt n a ete detecte dans le repo au moment de la generation.',
        ],
        validationTargets: [
            'Verifier la reponse generee sur /robots.txt apres correction.',
            'Lancer npm run lint.',
        ],
        missingFields: [
            'Fichier exact a modifier non confirme par les donnees detectees.',
        ],
        constraints: {
            absolute: [
                'Ne pas inventer de preuve, de fichier ou de donnees manquantes.',
                'Inspect-first: comprendre les surfaces existantes avant de modifier le code.',
            ],
            categoryInstruction: 'Verifier d abord les regles robots et les routes techniques qui conditionnent l acces des crawlers.',
        },
    };

    it('rescues partial AI output with deterministic repo-backed sections', () => {
        const payload = finalizeCorrectionPromptPayload({
            standard: {
                mission: 'Corriger le blocage des crawlers IA.',
                contexte: 'Contexte.',
                problemeDetecte: 'Probleme.',
                preuveDisponible: {
                    crawlersBloques: ['GPTBot', 'ClaudeBot'],
                    sourceUrl: 'https://pulsefolio.app/',
                },
                impactAttendu: 'Impact.',
                fichiersOuSurfacesAInspecter: ['public/robots.txt'],
                contraintesAbsolues: ['Fix minimal.'],
                ceQueLiaDoitFaire: ['Inspecter public/robots.txt avant toute modification.'],
                ceQueLiaNeDoitPasFaire: ['Ne pas refondre.'],
                validationAttendue: ['Tester via https://technicalseo.com/tools/robots-txt/.'],
                formatDuLivrableFinal: {
                    type: 'rapport',
                    sectionsObligatoires: ['fichiers_modifies'],
                },
                donneesManquantes: ['Le contenu exact du fichier n est pas fourni.'],
            },
            strict: {
                mission: 'Corriger strictement le blocage des crawlers IA.',
                contexte: 'Contexte strict.',
                problemeDetecte: 'Probleme strict.',
                preuveDisponible: 'Blocked: GPTBot, ClaudeBot.',
                impactAttendu: 'Impact strict.',
                fichiersOuSurfacesAInspecter: ['public/robots.txt'],
                contraintesAbsolues: ['Fix minimal.'],
                ceQueLiaDoitFaire: ['Inspecter public/robots.txt avant toute modification.'],
                ceQueLiaNeDoitPasFaire: ['Ne pas refondre.'],
                validationAttendue: ['Tester via https://technicalseo.com/tools/robots-txt/.'],
                formatDuLivrableFinal: {
                    type: 'rapport',
                },
                donneesManquantes: [],
            },
        }, context);

        expect(payload.standard.fichiersOuSurfacesAInspecter).toEqual(expect.arrayContaining([
            'app/robots.txt/route.js',
            'app/sitemap.js',
        ]));
        expect(payload.standard.fichiersOuSurfacesAInspecter).not.toContain('public/robots.txt');
        expect(payload.standard.ceQueLiaDoitFaire.some((item) => item.includes('public/robots.txt'))).toBe(false);
        expect(payload.standard.validationAttendue.some((item) => item.includes('/robots.txt'))).toBe(true);
        expect(payload.standard.formatDuLivrableFinal.every((item) => typeof item === 'string')).toBe(true);
        expect(payload.standard.text).toContain('Fichiers / surfaces a inspecter');
    });
});
