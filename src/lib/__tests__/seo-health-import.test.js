import { describe, it, expect, vi } from 'vitest';
vi.setConfig({ testTimeout: 60000 });

// Mock framer-motion
vi.mock('framer-motion', () => {
    const React = require('react');
    return {
        motion: new Proxy(
            {},
            {
                get(_, tag) {
                    return React.forwardRef(function MotionElement(props, ref) {
                        return React.createElement(tag, { ...props, ref });
                    });
                },
            },
        ),
    };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
    usePathname: () => '/admin/clients/test-id/seo/health',
    useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/link
vi.mock('next/link', () => ({
    default: (props) => {
        const React = require('react');
        return React.createElement('a', props, props.children);
    },
}));

describe('SeoHealthView module resolution', () => {
    it('should import SeoHealthView without errors', async () => {
        let mod;
        try {
            mod = await import('@/features/admin/seo/SeoHealthView');
        } catch (err) {
            console.error('IMPORT ERROR for SeoHealthView:', err.message);
            console.error('Stack:', err.stack);
            throw err;
        }
        expect(mod.default).toBeDefined();
        expect(typeof mod.default).toBe('function');
    });

    it('should import SeoLocalView without errors', async () => {
        const mod = await import('@/features/admin/seo/SeoLocalView');
        expect(mod.default).toBeDefined();
    });

    it('should import SeoActionsView without errors', async () => {
        const mod = await import('@/features/admin/seo/SeoActionsView');
        expect(mod.default).toBeDefined();
    });

    it('should import SeoOverviewView without errors', async () => {
        const mod = await import('@/features/admin/seo/SeoOverviewView');
        expect(mod.default).toBeDefined();
    });

    it('should import ScoreRing without errors', async () => {
        const mod = await import('@/components/shared/metrics/ScoreRing');
        expect(mod.default).toBeDefined();
    });

    it('should import GeoPremium components without errors', async () => {
        const mod = await import('@/features/admin/geo/components/GeoPremium');
        expect(mod.GeoEmptyPanel).toBeDefined();
        expect(mod.GeoSectionTitle).toBeDefined();
        expect(mod.GeoPremiumCard).toBeDefined();
    });
});
