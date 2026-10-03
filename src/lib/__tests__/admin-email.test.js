import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const originalEnv = { ...process.env };

async function loadModule() {
    const mod = await import('../admin-email.js');
    return mod;
}

describe('admin-email', () => {
    beforeEach(() => {
        delete process.env.CLERK_ADMIN_EMAIL;
        delete process.env.ADMIN_PANEL_EMAIL;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('isAdminEmail', () => {
        it('retourne true pour un email admin exact', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'admin@trouvable.app';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('admin@trouvable.app')).toBe(true);
        });

        it('retourne false pour un email non-admin', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'admin@trouvable.app';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('hacker@evil.com')).toBe(false);
        });

        it('est insensible \u00e0 la casse', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'Admin@Trouvable.APP';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('admin@trouvable.app')).toBe(true);
        });

        it('retourne false pour un email vide ou null', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'admin@trouvable.app';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('')).toBe(false);
            expect(isAdminEmail(null)).toBe(false);
            expect(isAdminEmail(undefined)).toBe(false);
        });

        it('supporte une liste d\'emails s\u00e9par\u00e9s par virgule', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'alice@trouvable.app,bob@trouvable.app';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('alice@trouvable.app')).toBe(true);
            expect(isAdminEmail('bob@trouvable.app')).toBe(true);
            expect(isAdminEmail('charlie@trouvable.app')).toBe(false);
        });
    });

    describe('normalisation Gmail', () => {
        it('ignore les points dans la partie locale Gmail', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'marchadidi@gmail.com';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('marc.hadidi@gmail.com')).toBe(true);
            expect(isAdminEmail('m.a.r.c.h.a.d.i.d.i@gmail.com')).toBe(true);
        });

        it('googlemail.com: supprime les points mais domaine reste googlemail — diff\u00e9rent de gmail', async () => {
            // Le code supprime les points sur googlemail.com mais NE remplace PAS le domaine par gmail.com
            // donc marchadidi@googlemail.com !== marchadidi@gmail.com
            // Pour matcher, il faut enregistrer l'adresse googlemail dans la liste admin
            process.env.CLERK_ADMIN_EMAIL = 'marchadidi@googlemail.com';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('marc.hadidi@googlemail.com')).toBe(true);
            expect(isAdminEmail('marc.hadidi@gmail.com')).toBe(false);
        });

        it('ne supprime PAS les points pour les domaines non-Gmail', async () => {
            process.env.CLERK_ADMIN_EMAIL = 'marc.hadidi@trouvable.app';
            const { isAdminEmail } = await loadModule();
            expect(isAdminEmail('marchadidi@trouvable.app')).toBe(false);
        });
    });

    describe('getAdminEmailsNormalized', () => {
        it('throw si aucune env var configur\u00e9e', async () => {
            const { getAdminEmailsNormalized } = await loadModule();
            expect(() => getAdminEmailsNormalized()).toThrow('CLERK_ADMIN_EMAIL env var is required');
        });

        it('utilise ADMIN_PANEL_EMAIL comme fallback', async () => {
            process.env.ADMIN_PANEL_EMAIL = 'fallback@trouvable.app';
            const { getAdminEmailsNormalized } = await loadModule();
            expect(getAdminEmailsNormalized()).toContain('fallback@trouvable.app');
        });

        it('en developpement sans env, ne bypass pas implicitement', async () => {
            process.env.NODE_ENV = 'development';
            const { getAdminEmailsNormalized, isAdminEmail } = await loadModule();
            expect(getAdminEmailsNormalized()).toEqual([]);
            expect(isAdminEmail('anyone@example.com')).toBe(false);
        });
    });
});
