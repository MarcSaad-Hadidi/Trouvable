# Compatibilité SQL et reconstruction

Les migrations ordonnées dans [supabase/migrations](../supabase/migrations/) décrivent l'évolution du schéma. Les anciens `schema.sql` et `setup_*.sql` restent des références de reconstruction. Leur remplacement n'est pas démontré par un build ou des mocks : il faut reconstruire une base locale jetable et comparer son catalogue, ses contraintes, fonctions, triggers, index et politiques RLS avant de les retirer.

Cette note conserve les raisons de la réconciliation du 20 mars 2026. Le [diagnostic historique complet](https://github.com/MarcSaad-Hadidi/Trouvable/blob/6c06ad4c11ac795ccf0fb485933721867c98a320/docs/db-reconciliation-audit.md) reste consultable dans Git ; ses chemins et propositions sont historiques. Aucun état actuel du catalogue distant n'est attesté. L'application et les services restent en hibernation ; aucune migration ou écriture distante n'est autorisée pour valider une consolidation.

## Pourquoi les migrations additives ne suffisent pas

Des environnements créés avec les anciens scripts peuvent posséder les tables attendues avec des colonnes, defaults ou contraintes anciens. `CREATE TABLE IF NOT EXISTS` et `ADD COLUMN IF NOT EXISTS` préservent ces objets : ils ne réparent pas une clé étrangère existante visant la mauvaise table.

Le diagnostic historique rapporte notamment un insert `opportunities` refusé parce que `client_id` visait encore `public.clients`. Le contrat applicatif utilise `public.client_geo_profiles(id)`. Cette observation explique la réparation explicite des relations ; elle ne prouve pas leur état actuel.

| Migration                                                                                                               | Rôle                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [Réconciliation DB](../supabase/migrations/20260320143000_db_reconciliation.sql)                                        | Réaffirme colonnes/defaults/checks, normalise les anciennes données, ajoute triggers de compatibilité, index et permissions nécessaires. |
| [Réparation des clés étrangères](../supabase/migrations/20260321003000_repair_legacy_foreign_keys.sql)                  | Remplace les relations anciennes par les liens vers clients, audits, prompts et runs canoniques.                                         |
| [Réconciliation du type de prompt](../supabase/migrations/20260321113000_tracked_queries_query_type_reconciliation.sql) | Conserve la lecture des classifications historiques.                                                                                     |

Les accès actuels sont dans [src/lib/db](../src/lib/db/) et les loaders portail dans [src/features/portal/server](../src/features/portal/server/). Ne pas déduire la forme complète du schéma d'un seul consommateur : les migrations ultérieures étendent notamment prompts, captures et preuves.

## Compatibilités à préserver

| Contrat       | Compatibilité et limite                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Profil client | `publication_status/is_published`, `contact_info.public_email/email`, `business_details.short_desc/short_description` restent pris en charge par les écritures et lecteurs concernés.                                                |
| Prompts       | `category/query_type` et les formes historiques de metadata restent lisibles selon le [contrat prompt](prompt-contract-unification.md). Une normalisation conservatrice peut perdre une nuance d'intention à revoir par l'opérateur. |
| Runs          | `query_text` conserve le prompt au moment du run. Un ancien run sans référence ni texte exploitable ne permet pas de reconstruire le prompt exact.                                                                                   |
| Opportunités  | `priority/severity` préserve les formats historiques ; l'équivalence des anciennes significations reste une hypothèse de compatibilité à vérifier avant retrait.                                                                     |
| Audits        | Les JSON conservent les formes attendues, notamment un tableau pour `prefill_suggestions`.                                                                                                                                           |
| Portail       | Email normalisé, membership actif et identité Clerk vérifiée définissent le scope serveur. L'authentification seule n'autorise pas un client.                                                                                        |

## Vérification avant une reprise autorisée

1. Reconstruire une base locale jetable avec l'ordre réel des migrations ; comparer également un schéma issu des anciens setup scripts.
2. Vérifier contraintes étrangères et checks, defaults JSON, triggers de compatibilité/updated-at, fonctions de rate limit, permissions et RLS.
3. Exercer lectures/écritures des formats anciens et actuels, puis accès anonyme/interdit et isolation client A/client B, avec des données de test.
4. Identifier les consommateurs externes éventuels avant de retirer une colonne ou un alias de compatibilité. Ne retirer aucun historique SQL appliqué.

Ces contrôles sont requis avant de déclarer la reconstruction équivalente. Les tests applicatifs locaux vérifient les contrats avec IO simulées ; ils ne valident ni les politiques d'une base réelle ni l'application distante des migrations. La [procédure d'hibernation et reprise](operations/trouvable-hibernation.md) reste la référence pour les opérations distantes.
