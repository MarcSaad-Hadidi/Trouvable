# Security Policy

## Supported versions

Trouvable is currently maintained from the `main` branch.

Security fixes are applied to `main` first and deployed through the normal Vercel production pipeline.

## Reporting a vulnerability

Please do not open a public GitHub issue for security vulnerabilities.

Use GitHub Security Advisories when available:

- Repository → Security → Advisories → Report a vulnerability

If GitHub private vulnerability reporting is not available, contact the maintainer directly.

## What to include

Please include:

- A clear description of the issue
- Steps to reproduce
- Impact
- Affected routes, files or dependencies
- Whether any secret, token or customer data may be exposed
- Suggested remediation if known

## Secrets policy

Never commit:

- `.env`
- Supabase service role keys
- Clerk secret keys
- Resend API keys
- AI provider API keys
- Vercel tokens
- Cron secrets
- OAuth client secrets
- Private customer data
- Production database exports

Only sanitized placeholders belong in `.env.example`.

## If a secret is leaked

If a secret is committed or exposed:

1. Revoke or rotate the secret immediately.
2. Remove the secret from the code.
3. Check GitHub secret scanning alerts.
4. Review recent deployments and logs.
5. Redeploy with the rotated secret.
6. Document the incident privately.

Removing the secret from Git history is not enough. Always rotate it.

## Security controls

Trouvable uses or should use:

- GitHub secret scanning
- GitHub push protection
- Dependabot alerts
- Dependabot security updates
- Dependency Review on pull requests
- CodeQL code scanning
- Required pull requests before merge
- Required CI checks before merge
- Minimal GitHub Actions permissions
