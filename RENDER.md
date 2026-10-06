# Déploiement SOAR sur Render

Cette version utilise un serveur Node de production, SQLite et des photos sur disque persistant. Les migrations sont appliquées automatiquement au démarrage, dans des transactions. L'administration utilise une session privée et un mot de passe défini dans les secrets Render ; les en-têtes d'identité fournis par un visiteur sont ignorés.

## Configuration conseillée

Dans Render, créer un **Blueprint** depuis ce dépôt : `render.yaml` définit le service et le disque. Choisir un mot de passe unique d'au moins 16 caractères pour `ADMIN_PASSWORD`, et renseigner `ADMIN_EMAIL`. Aucun mot de passe par défaut n'est fourni.

Pour un Web Service créé manuellement :

| Champ | Valeur |
| --- | --- |
| Branch | `main` |
| Runtime | Node |
| Root Directory | vide |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Plan | une offre payante compatible avec les disques |
| Persistent Disk Mount Path | `/var/data` |
| Disk Size | 1 Go pour commencer |

Variables : `NODE_VERSION=22.22.0`, `DATA_DIR=/var/data`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (16 caractères minimum), `INDEXING_ENABLED=true`. Render fournit `PORT` et `RENDER_EXTERNAL_URL` automatiquement. Si tu ajoutes un domaine personnalisé, définir `SITE_ORIGIN=https://ton-domaine.fr` (sans barre finale).

**Il n'y a pas de Publish Directory : il faut un Web Service.** Le plan gratuit sans disque ne préserve pas les photos et les projets. Cette configuration est conçue pour une seule instance.

## Administration et données

Accéder à `/admin` et saisir l'e-mail et le mot de passe configurés. Les sessions expirent après 8 heures. Un changement de mot de passe suivi d'un redéploiement invalide automatiquement les sessions existantes. Les tentatives de connexion sont limitées et stockées dans SQLite.

La base et les photos de l'ancien hébergement ne sont pas automatiquement présentes sur Render : le dépôt contient le code, pas les contenus saisis dans l'admin. Faire une sauvegarde `.tar` depuis l'ancien admin avant de migrer. Le nouveau site commence avec les images d'inspiration et aucun projet réel. Les contenus peuvent être saisis dans le nouvel admin ; l'import technique d'une sauvegarde doit être effectué séparément.

Télécharger régulièrement une sauvegarde complète dans l'admin. Le disque conserve les données entre redémarrages et déploiements ; il ne remplace pas une sauvegarde externe.

## Développement

`npm run build` construit le serveur Render ; `npm start` le lance. En local : définir `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DATA_DIR` et `SITE_ORIGIN=http://localhost:3000` avant le lancement. `npm test` vérifie les validations et les archives. `npm run test:render` vérifie le serveur, l'authentification, les projets, les images et la persistance.

Le code de l'hébergement Sites d'origine est conservé : `npm run build:sites` construit cette variante. Les déploiements sont indépendants.
