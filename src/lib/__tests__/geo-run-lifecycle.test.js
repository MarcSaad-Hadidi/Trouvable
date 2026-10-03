import { describe, expect, it } from 'vitest';

import {
    getRunDiagnostic,
    isRunFailureStatus,
    needsRunOperatorReview,
    normalizeRunParseStatus,
} from '../operator-intelligence/run-lifecycle';

describe('run lifecycle helpers', () => {
    it('does not report legacy in-flight parse defaults as parse failures', () => {
        expect(normalizeRunParseStatus({
            status: 'running',
            parse_status: 'parsed_failed',
            provider: 'pending',
            model: 'pending',
            raw_analysis: {},
        })).toBeNull();
    });

    it('keeps execution failures separate from extraction notes', () => {
        expect(getRunDiagnostic({
            status: 'completed',
            parse_status: 'parsed_success',
            parse_warnings: ['Analyse sans businesses - extraction heuristique activee.'],
        })).toMatchObject({
            kind: 'parse_note',
            title: "Note d'extraction",
        });

        expect(getRunDiagnostic({
            status: 'failed',
            parse_status: 'parsed_failed',
            parse_warnings: ['timeout provider'],
        })).toMatchObject({
            kind: 'execution_failure',
            title: "Diagnostic d'execution",
        });
    });

    it('treats partial_error as a failure status and preserves operator review signals', () => {
        expect(isRunFailureStatus('partial_error')).toBe(true);
        expect(needsRunOperatorReview({
            status: 'partial',
            parse_status: 'parsed_success',
            parse_confidence: 0.42,
        })).toBe(true);
    });
});