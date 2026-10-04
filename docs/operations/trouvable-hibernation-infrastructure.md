# Trouvable — Verrous d’infrastructure

## Déploiements Git Vercel

`vercel.json` impose `git.deploymentEnabled: false`. Un push GitHub ne doit pas créer automatiquement un Preview ou un déploiement production. Le script `scripts/vercel-ignore-hibernation.mjs` reste une défense supplémentaire lorsqu’un déploiement évalue encore l’Ignored Build Step.

Le parking a été déployé avant l’activation du verrou. Les métadonnées d’un déploiement existant renseignent cet ancien état ; elles ne prouvent pas que le code d’une PR récente a été construit ou exécuté. Vérifier les réglages distants accessibles en lecture seule et rapporter toute limite d’accès.

Toute reprise exige une branche dédiée, une modification relue de ces verrous et une autorisation distincte avant déploiement ; voir la [procédure d’hibernation et reprise](trouvable-hibernation.md).

## Injection Cloudflare observée historiquement

Lors de la validation initiale du parking, Cloudflare injectait à l’edge un script sous `/cdn-cgi/challenge-platform/` sur l’accueil. La source statique du dépôt ne contient aucun script. La CSP du parking conserve `default-src 'none'` et ne permet aucun script ; une telle injection est bloquée et peut produire une violation CSP dans la console.

Cette observation historique ne constitue pas une vérification des réglages actuels de Cloudflare. Si elle se reproduit, distinguer le contenu du dépôt de la réponse edge. Désactiver les fonctions JavaScript Detections/Bot concernées, ou modifier le mode DNS après contrôle DNS/TLS, constitue une opération distante qui nécessite un mandat distinct. Ne pas affaiblir la CSP pour autoriser une injection.

## Supabase

Le code conserve ses contrats, migrations et données historiques. La présence de variables d’environnement ou d’un connecteur implémenté ne prouve pas la disponibilité du projet distant. Pauser Supabase uniquement après validation du site statique de production ; restaurer le projet et vérifier son état avant toute promotion d’une application dynamique. Aucune consolidation locale ne modifie ces états distants.
