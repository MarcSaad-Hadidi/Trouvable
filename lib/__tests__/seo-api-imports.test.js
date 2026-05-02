import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const IMPORT_TIMEOUT_MS = 30000;

describe('SEO API route module imports', () => {
  it('should import seo-health', async () => {
    const mod = await import('@/lib/operator-intelligence/seo-health');
    expect(mod.getSeoHealthSlice).toBeDefined();
    expect(typeof mod.getSeoHealthSlice).toBe('function');
  }, IMPORT_TIMEOUT_MS);

  it('should import seo-categories', async () => {
    const mod = await import('@/lib/operator-intelligence/seo-categories');
    expect(mod.filterSeoRelevant).toBeDefined();
    expect(mod.filterLocalRelevant).toBeDefined();
  }, IMPORT_TIMEOUT_MS);

  it('should import seo-local', async () => {
    const mod = await import('@/lib/operator-intelligence/seo-local');
    expect(mod.getSeoLocalSlice).toBeDefined();
  }, IMPORT_TIMEOUT_MS);

  it('should import seo-actions', async () => {
    try {
      const mod = await import('@/lib/operator-intelligence/seo-actions');
      expect(mod.getSeoActionsSlice).toBeDefined();
    } catch (err) {
      console.error('IMPORT ERROR seo-actions:', err.message);
      throw err;
    }
  }, IMPORT_TIMEOUT_MS);

  it('should import seo-overview', async () => {
    try {
      const mod = await import('@/lib/operator-intelligence/seo-overview');
      expect(mod.getSeoOverviewSlice).toBeDefined();
    } catch (err) {
      console.error('IMPORT ERROR seo-overview:', err.message);
      throw err;
    }
  }, IMPORT_TIMEOUT_MS);

  it('should import visibility', async () => {
    try {
      const mod = await import('@/lib/operator-intelligence/visibility');
      expect(mod.getVisibilitySlice).toBeDefined();
    } catch (err) {
      console.error('IMPORT ERROR visibility:', err.message);
      throw err;
    }
  }, IMPORT_TIMEOUT_MS);

  it('should import seo-cannibalization', async () => {
    try {
      const mod = await import('@/lib/operator-intelligence/seo-cannibalization');
      expect(mod.getSeoCannibalizationSlice).toBeDefined();
      expect(typeof mod.getSeoCannibalizationSlice).toBe('function');
    } catch (err) {
      console.error('IMPORT ERROR seo-cannibalization:', err.message);
      throw err;
    }
  }, IMPORT_TIMEOUT_MS);

  it('getSeoHealthSlice returns empty state when no audit', async () => {
    const { getSeoHealthSlice } = await import('@/lib/operator-intelligence/seo-health');
    const result = await getSeoHealthSlice('test-id', { audit: null });
    expect(result.available).toBe(false);
    expect(result.emptyState).toBeDefined();
  }, 15000);

  it('getSeoHealthSlice returns empty state for pending audit', async () => {
    const { getSeoHealthSlice } = await import('@/lib/operator-intelligence/seo-health');
    const result = await getSeoHealthSlice('test-id', { audit: { scan_status: 'pending' } });
    expect(result.available).toBe(false);
  }, 15000);

  it('getSeoHealthSlice returns data for completed audit', async () => {
    const { getSeoHealthSlice } = await import('@/lib/operator-intelligence/seo-health');
    const result = await getSeoHealthSlice('test-id', {
      audit: {
        scan_status: 'completed',
        seo_score: 75,
        seo_breakdown: { overall: { deterministic_score: 70 } },
        issues: [
          { key: 'missing-alt', category: 'technical', severity: 'medium' },
          { key: 'no-local', category: 'geo', severity: 'low' },
        ],
        strengths: [
          { key: 'ssl', category: 'seo' },
          { key: 'local-schema', category: 'local' },
        ],
        created_at: '2026-01-01',
      },
    });
    expect(result.available).toBe(true);
    expect(result.seoScore).toBe(75);
    // Only SEO-relevant issues (technical, seo, trust, identity)
    expect(result.issues.length).toBe(1); // missing-alt is technical
    expect(result.strengths.length).toBe(1); // ssl is seo
  }, 15000);
});
