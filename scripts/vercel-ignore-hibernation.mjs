const ref = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
const allowedRefs = new Set(['main', 'chore/hibernate-trouvable']);

if (allowedRefs.has(ref)) {
    console.log(`Vercel build allowed for ${ref || 'unknown ref'}.`);
    process.exit(1);
}

console.log(`Vercel build ignored for ${ref || 'unknown ref'} while Trouvable is hibernating.`);
process.exit(0);
