# Déploiement production CABBA

## Architecture recommandée

CABBA est prévu pour une séparation nette entre :

1. **web** : Express + SPA, sans scheduler API-Football ;
2. **football-worker** : un seul processus dédié au scheduler API-Football et aux rappels push ;
3. **PostgreSQL managé** ;
4. **Cloudflare R2** pour les médias ;
5. **Resend** pour les e-mails transactionnels ;
6. **API-Football** pour les données sportives ;
7. HTTPS devant le service web.

Cette séparation évite que plusieurs instances web exécutent simultanément le scheduler et consomment plusieurs fois le quota API-Football.

## Variables de production

Copier `.env.example` vers `.env.production` puis renseigner au minimum :

- `NODE_ENV=production`
- `SESSION_SECRET` (32 caractères minimum ; une valeur aléatoire longue est recommandée)
- `DATABASE_URL`
- `APP_BASE_URL`
- `API_FOOTBALL_KEY`
- `API_FOOTBALL_LEAGUE_ID=187`
- `API_FOOTBALL_TEAM_ID=925`
- `API_FOOTBALL_SEASON` selon la saison réellement accessible par le plan API-Football
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` si les notifications push sont activées
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` si les médias R2 sont activés
- `RESEND_API_KEY`, `EMAIL_FROM` si les e-mails sont activés
- `TRUST_PROXY` selon le nombre de proxies de confiance devant Express

Ne jamais committer `.env.production`.

## Migrations PostgreSQL

Les migrations sont compilées dans `dist/migrate.cjs`. Le conteneur runtime n'a donc plus besoin de `tsx` pour appliquer les migrations.

Ordre de release recommandé :

1. construire et publier l'image ;
2. exécuter **une seule fois** `node dist/migrate.cjs` contre la base PostgreSQL de production ;
3. déployer/redéployer le service web ;
4. déployer/redémarrer le football worker.

Le runner crée `schema_migrations`, applique les fichiers SQL triés et journalise chaque migration dans une transaction.

> Ne lancez pas les migrations au démarrage et ne lancez pas le runner de migration en parallèle sur plusieurs instances.

### Docker local / serveur Docker

```bash
docker compose -f deploy/docker-compose.production.yml build
docker compose -f deploy/docker-compose.production.yml run --rm cabba-web node dist/migrate.cjs
docker compose -f deploy/docker-compose.production.yml up -d
```

Le service `cabba-web` force `FOOTBALL_SCHEDULER_ENABLED=false` et `cabba-football-worker` le force à `true`.

## Services Cloud Run / PaaS

Déployer **deux services** depuis la même image :

### `cabba-web`

- commande : `node dist/server.cjs`
- `FOOTBALL_SCHEDULER_ENABLED=false`
- `PORT=3000`
- `min instances=1` recommandé au début
- `max instances=5` dans le manifeste de référence ; peut être augmenté selon la charge, puisque le scheduler n'est plus dans le web

### `cabba-football-worker`

- commande : `node dist/football-worker.cjs`
- `FOOTBALL_SCHEDULER_ENABLED=true`
- **une seule instance active** (`max instances = 1`)
- aucune exposition publique nécessaire
- redémarrage automatique activé

Le worker contient une boucle temporisée et doit donc être déployé comme un service worker long-lived. Pour une architecture entièrement serverless, une évolution ultérieure peut remplacer cette boucle par Cloud Scheduler + Cloud Run Jobs/tasks.

## Migration release

Avec l'image produite par le Dockerfile :

```bash
node dist/migrate.cjs
```

La commande doit être exécutée dans un job/release environment qui possède les mêmes variables PostgreSQL que la production. Elle se termine après application des migrations.

## Vérifications après déploiement

Web :

```bash
curl -fsS https://VOTRE-DOMAINE/api/health
curl -fsS https://VOTRE-DOMAINE/api/ready
```

Vérifier ensuite :

- connexion utilisateur ;
- création de session ;
- accès aux matchs ;
- Match Center et SSE ;
- notifications push ;
- upload R2 ;
- e-mails ;
- analytics admin ;
- logs du worker et absence de double synchronisation.

## Rollback

1. conserver l'image précédente ;
2. revenir à cette image côté web **et** worker ;
3. ne pas tenter de supprimer une migration déjà appliquée ;
4. si une migration est irréversible, restaurer selon la procédure de sauvegarde PostgreSQL.

## Scaling

Le service web peut être horizontalement scalé indépendamment du worker. Le worker doit rester à **une seule instance** tant qu'il utilise cette boucle interne.

Pour plusieurs workers, il faudra introduire un mécanisme de lease/lock PostgreSQL ou Redis et une stratégie d'idempotence globale avant d'augmenter le nombre d'instances.


## Déploiement Google Cloud complet

L'étape 14 ajoute deux scripts reproductibles :

- `deploy/bootstrap-gcp.sh` : active les APIs nécessaires, crée le dépôt Artifact Registry, crée/met à jour les secrets Secret Manager et donne au compte de service runtime le rôle `roles/secretmanager.secretAccessor`.
- `deploy/deploy-cloudrun.sh` : construit l'image exacte de la release, exécute **la migration sur cette image**, puis déploie le web et le worker.

### 1. PostgreSQL managé

CABBA n'embarque volontairement aucun PostgreSQL dans l'image. Utilisez un PostgreSQL managé (Cloud SQL, Neon, Supabase ou autre fournisseur) et fournissez son URL complète via `CABBA_DATABASE_URL`.

Pour Cloud SQL, privilégiez une connexion privée/Cloud SQL Connector lorsque votre architecture réseau le permet. Si vous utilisez une URL TCP publique, activez TLS et restreignez les accès réseau ; ne mettez jamais le mot de passe dans Git.

### 2. Secret Manager

Avant le premier déploiement, définir les variables `CABBA_*` dans le shell de release puis exécuter :

```bash
export PROJECT_ID="mon-projet-gcp"
export REGION="europe-west1"
export CABBA_DATABASE_URL="postgresql://..."
export CABBA_SESSION_SECRET="..."
export CABBA_API_FOOTBALL_KEY="..."
export CABBA_GEMINI_API_KEY="..."
export CABBA_VAPID_PUBLIC_KEY="..."
export CABBA_VAPID_PRIVATE_KEY="..."
export CABBA_VAPID_SUBJECT="mailto:..."
export CABBA_R2_ACCOUNT_ID="..."
export CABBA_R2_ACCESS_KEY_ID="..."
export CABBA_R2_SECRET_ACCESS_KEY="..."
export CABBA_R2_PUBLIC_BASE_URL="https://..."
export CABBA_RESEND_API_KEY="..."
export CABBA_EMAIL_FROM="CABBA <noreply@votre-domaine>"
./deploy/bootstrap-gcp.sh
```

Le script n'écrit pas ces valeurs dans le dépôt ni dans `.env.production`.

En production, il est recommandé de remplacer le compte de service Compute par un **compte de service runtime dédié** via `RUNTIME_SERVICE_ACCOUNT` et de lui accorder uniquement les droits nécessaires.

### 3. Release

Définir l'URL publique du site puis lancer :

```bash
export APP_BASE_URL="https://cabba.example"
./deploy/deploy-cloudrun.sh
```

Le script suit cet ordre strict :

1. `gcloud builds submit` construit l'image avec un tag unique UTC ;
2. le Job `cabba-migrations` est remplacé par la configuration pointant vers **la même image** ;
3. le Job de migration est exécuté et doit réussir ;
4. le service `cabba-web` est remplacé ;
5. le service `cabba-football-worker` est remplacé.

Ainsi, une migration échouée bloque le déploiement des services applicatifs.

### 4. Permissions de déploiement

Le compte humain/CI qui exécute la release doit disposer des permissions Google Cloud permettant au minimum de construire/publier l'image, remplacer/exécuter le Job Cloud Run et remplacer les services Cloud Run. Le compte runtime, lui, n'a besoin que des accès à ses secrets et aux ressources auxquelles l'application se connecte.

### 5. Vérification

Après la release :

```bash
gcloud run services describe cabba-web --region="$REGION" --format='value(status.url)'
gcloud run services describe cabba-football-worker --region="$REGION" --format='value(status.conditions[0].status)'
gcloud run jobs executions list --job=cabba-migrations --region="$REGION" --limit=1
```

Puis vérifier `/api/health` et `/api/ready` sur l'URL du web. Le worker ne sert que `/api/health` et ne doit jamais servir l'application React.

### 6. Rollback

Le tag d'image est unique par release. Pour revenir à une version précédente, redéployez explicitement son tag **uniquement si le schéma PostgreSQL reste compatible**. Une migration déjà appliquée n'est jamais supprimée automatiquement.

## Sauvegardes PostgreSQL et reprise

La base de production n'est pas incluse dans l'image CABBA. Activez les sauvegardes automatiques et la récupération ponctuelle (PITR) sur le fournisseur PostgreSQL choisi. Pour Cloud SQL, configurez notamment une fenêtre de sauvegarde, la conservation des sauvegardes et les logs nécessaires à la restauration.

Avant une migration à risque :

1. vérifier qu'une sauvegarde récente existe ;
2. appliquer la migration sur une base de staging ;
3. exécuter le job `cabba-migrations` avec l'image exacte de la release ;
4. seulement ensuite basculer les services Web et Worker.

CABBA ne supprime ni ne recrée les tables pendant le déploiement : les migrations SQL sont versionnées et enregistrées dans `schema_migrations`.

## Garde-fou avant release

Le script `deploy/preflight-production.sh` vérifie le projet Google Cloud actif, les services Cloud Run, les secrets critiques et les endpoints de la version actuellement déployée. Il ne déploie rien et ne lit pas les valeurs des secrets.

```bash
PROJECT_ID=mon-projet REGION=europe-west1 \
APP_BASE_URL=https://VOTRE-DOMAINE.example \
bash deploy/preflight-production.sh
```

La CI GitHub (`.github/workflows/ci.yml`) exécute les tests, le typecheck, le build de production et le build Docker sur chaque push/PR.

## Surveillance production

Voir `deploy/monitoring.md` pour les métriques et alertes minimales recommandées. Le worker Cloud Run est configuré en ingress interne : il n'a pas besoin d'être publiquement accessible.

## Vérification post-release

Le script `deploy/verify-release.sh` vérifie les endpoints publics `/api/health` et `/api/ready`, puis vérifie que les deux services Cloud Run existent. Il ne nécessite aucun secret.

```bash
APP_BASE_URL=https://VOTRE-DOMAINE.example \
PROJECT_ID=mon-projet REGION=europe-west1 \
bash deploy/verify-release.sh
```

## Rollback applicatif

Le rollback Cloud Run doit réutiliser une révision connue comme saine ; il ne faut pas relancer automatiquement une migration inverse. Le script `deploy/rollback-cloudrun.sh` reçoit les noms de révision Web et Worker et rebascule les deux services vers ces révisions.

```bash
PROJECT_ID=mon-projet REGION=europe-west1 \
WEB_REVISION=cabba-web-00010-abc \
WORKER_REVISION=cabba-football-worker-00010-def \
bash deploy/rollback-cloudrun.sh
```

Si une migration de schéma est incompatible avec l'ancienne version, le rollback applicatif doit être précédé d'une procédure de restauration PostgreSQL validée.
