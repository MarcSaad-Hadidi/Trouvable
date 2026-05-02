## Résumé

Décris clairement ce que cette PR change.

## Type de changement

- [ ] Bug fix
- [ ] Feature
- [ ] Refactor
- [ ] UI / UX
- [ ] Documentation
- [ ] Dépendances
- [ ] Sécurité
- [ ] CI/CD / Infra

## Zone touchée

- [ ] Public site
- [ ] Admin
- [ ] Portal client
- [ ] API routes
- [ ] Supabase / migrations
- [ ] Auth / Clerk
- [ ] Cron / jobs
- [ ] AI / providers
- [ ] GitHub / CI
- [ ] Vercel / deployment

## Risque

- [ ] Faible — changement isolé
- [ ] Moyen — impact possible sur une surface importante
- [ ] Élevé — auth, données, production, sécurité ou build

## Validation effectuée

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Preview Vercel vérifié
- [ ] Aucun secret ajouté dans le code ou les logs
- [ ] Les variables d’environnement nécessaires sont documentées
- [ ] Les changements sensibles sont expliqués

## Screenshots / Preview

Ajoute les captures ou le lien Vercel Preview si pertinent.

## Sécurité / données

- [ ] Ne touche pas aux secrets
- [ ] Ne change pas les permissions d’accès
- [ ] Ne modifie pas les règles Supabase/RLS
- [ ] Ne touche pas aux routes protégées
- [ ] Ne log pas d’information sensible

## Notes de déploiement

Indique ici les actions manuelles requises après merge :

- Variables Vercel à ajouter :
- Migration Supabase à appliquer :
- Cron à vérifier :
- Autre :

## Rollback

Explique comment revenir en arrière si problème en production.
