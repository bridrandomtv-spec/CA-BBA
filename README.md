# شباب أهلي برج بوعريريج - المنصة الرقمية

هذا المشروع هو تجسيد للمنصة الرقمية الرسمية لنادي CABBA، مصمم ليكون منصة متكاملة وطويلة المدى لربط النادي بجمهوره العريض في الداخل والخارج.

## الميزات الرئيسية:
- **الرئيسية**: آخر الأخبار والمباريات القادمة.
- **مركز المباريات**: تغطية حية، إحصائيات، التشكيلة، واختيار رجل المباراة.
- **CABBA TV**: مكتبة الأغاني والأهازيج (مع كلمات الأغاني) وملخصات الفيديو.
- **المتجر والتذاكر**: شراء منتجات النادي الرسمية وتذاكر المباريات.
- **العضوية والملف الشخصي**: بطاقة الانخراط الرقمية (QR)، نقاط الولاء، ولعبة التوقعات.
- **المساعد الذكي**: مساعد يعتمد على Gemini AI للإجابة على استفسارات الأنصار.

---

# Documentation technique

Application React 19 + Vite 6 + Tailwind 4, servie par un serveur Express qui
expose aussi le point d'entrée Gemini. Interface en arabe, mise en page RTL,
pensée mobile d'abord et installable comme PWA.

## Démarrage

```bash
npm install
cp .env.example .env      # puis renseigner GEMINI_API_KEY
npm run dev               # http://localhost:3000
```

Le serveur de développement monte Vite en mode middleware : une seule commande
sert le front et l'API, sans problème de CORS.

## Scripts

| Script | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (Express + Vite middleware) |
| `npm run build` | Build du front dans `dist/` + bundle du serveur en `dist/server.cjs` |
| `npm start` | Lance le build de production (nécessite `NODE_ENV=production`) |
| `npm run lint` / `npm run typecheck` | Vérification TypeScript (`tsc --noEmit`) |
| `npm run tidy` | Archive dans `scripts/legacy/` les scripts de génération de la racine, ainsi que les anciens `manifest.json` et `sw.js` désormais remplacés par ceux de `public/` |

## Structure

```
index.html            Point d'entrée, métadonnées PWA et sociales
server.ts             Express : POST /api/chat (Gemini), GET /api/health, statiques
public/               Servi tel quel et copié dans dist/ au build
  manifest.json       Manifeste PWA
  sw.js               Service worker
  icon.svg            Icône vectorielle (source des PNG)
src/
  main.tsx            Montage React, ErrorBoundary, enregistrement du SW
  App.tsx             Coquille : en-tête, navigation, panneau assistant
  types.ts            Types partagés (Tab, ChatMessage, Product…)
  ThemeContext.tsx    Thème sombre/clair
  index.css           Tailwind, utilitaires safe-area, variables du thème clair
  lib/storage.ts      Accès localStorage centralisé et tolérant aux erreurs
  hooks/              useFavorites, useNotificationSettings
  components/         34 écrans et composants
scripts/
  generate-icons.html Génère icon-192.png et icon-512.png
  tidy-root.mjs       Rangement de la racine
```

## Icônes PWA

Le manifeste attend `public/icon-192.png` et `public/icon-512.png`, absents du
dépôt. Ouvre `scripts/generate-icons.html` dans un navigateur, clique sur le
bouton, puis dépose les deux fichiers dans `public/`. Si tu obtiens le logo
officiel du club, remplace-les en conservant les mêmes noms et dimensions.

## Thème clair

Plutôt que de conditionner chaque composant, `.theme-light` (posé sur `<html>`)
redéfinit les variables de couleur de Tailwind dans `src/index.css` : les classes
`bg-zinc-900`, `text-white`, `bg-black` s'inversent d'elles-mêmes. En ajoutant
une nuance de gris à un composant, vérifie qu'elle est bien déclarée dans le bloc
`.theme-light`, sinon elle restera sombre en mode clair.

## Service worker

`public/sw.js` applique « réseau d'abord » à la navigation, `stale-while-revalidate`
aux fichiers statiques, et ne met jamais `/api/` en cache. Incrémente
`CACHE_VERSION` à chaque déploiement qui modifie l'app shell. Le worker n'est
enregistré qu'en production (`import.meta.env.PROD`) pour ne pas gêner le
rechargement à chaud.

## Intégration API-Football

Le serveur peut synchroniser les matchs de la Ligue 2 algérienne depuis API-Football.
Le navigateur ne contacte jamais directement le fournisseur : les données sont
stockées dans PostgreSQL puis servies par l’API Express et le Match Center.

La configuration se fait dans `.env` avec `API_FOOTBALL_KEY`,
`API_FOOTBALL_LEAGUE_ID`, `API_FOOTBALL_TEAM_ID` et `API_FOOTBALL_SEASON`.

Avant les appels coûteux, CABBA met en cache pendant 24 h la couverture
Ligue/Saison retournée par API-Football. Les fonctionnalités non couvertes
(Events, Lineups, Statistics, Standings, etc.) sont alors ignorées sans consommer
de quota. Si le fournisseur refuse la saison à cause du plan courant, cette
information est mémorisée et le scheduler suspend les appels concernés au lieu
de répéter l’erreur toutes les quelques minutes.

Après avoir créé ou modifié les variables API-Football, exécuter :

```bash
npm run migrate
npm run football:verify -- --league "Ligue 2" --team "Bordj" --check
npm run football:sync
```

Pour l’administration, `GET /api/football/coverage` expose l’état de couverture
mis en cache. `GET /api/football/coverage?refresh=1` force un nouveau contrôle et
réinitialise le blocage de plan mémorisé.

## Données et limites actuelles

Les contenus (matchs, joueurs, produits, sondages, commentaires live) sont des
données de démonstration codées en dur dans les composants. `MATCHES_DATA` est
exporté depuis `components/MatchCalendar.tsx` et réutilisé par `Profile.tsx`.

Points restants à traiter, par ordre d'utilité :

1. **Notifications réelles.** `MatchAlert` simule une alerte toutes les 60 s à
   partir des préférences. Un vrai système demande la Push API, un abonnement
   `pushManager.subscribe()`, un stockage côté serveur et un déclencheur.
2. **Source de données.** Extraire les données de démonstration des composants
   vers un module ou une API, pour que les écrans cessent de dupliquer les mêmes
   listes.
3. **Historique de l'assistant.** Le contexte est renvoyé à chaque requête et
   borné à 20 tours ; il n'est pas persisté entre deux ouvertures du panneau.
4. **Tests.** Aucun test pour l'instant. `lib/storage.ts` et
   `hooks/useNotificationSettings.ts` (migration du schéma) sont les premiers
   candidats.
5. **Fichiers de verrouillage.** `bun.lock` et `package-lock.json` coexistent :
   garder celui du gestionnaire réellement utilisé.
## Étape 4 — Match Center temps réel

Le Match Center est maintenant alimenté par PostgreSQL et SSE : le navigateur ne contacte jamais API-Football.

- `GET /api/matches/:id/center` fournit une vue consolidée d'une rencontre (match, événements, compositions, statistiques).
- `GET /api/matches/:id/stream` ouvre un flux Server-Sent Events avec une raison de changement (`fixture`, `events`, `lineups`, `statistics`).
- Le scheduler synchronise les données côté serveur puis émet les changements vers les clients connectés.
- Le navigateur utilise `EventSource` et ne fait aucun polling pour le direct.
- Le détail d'une rencontre affiche score, minute, événements, statistiques et compositions lorsqu'ils existent en base.
- Le système reste compatible avec la couche de couverture API-Football de l'étape 3 : aucune donnée non couverte n'est sollicitée.


## Étape 5 — Web Push

Les notifications Push Web sont désormais gérées côté serveur avec VAPID et PostgreSQL. Les abonnements sont liés aux comptes utilisateurs et les préférences sont persistées par appareil. Le service worker affiche les notifications reçues et gère le clic.

Variables `.env` requises pour activer Push en production : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

Pour générer une paire VAPID : `npm run vapid:generate`. Ne publiez jamais la clé privée.

Le serveur peut envoyer :
- objectifs détectés par la synchronisation API-Football ;
- résultats finaux ;
- rappels environ 30 minutes avant une rencontre.

Sans VAPID configuré, l'application continue de fonctionner et les autres fonctionnalités restent disponibles.

## Étape 6 — stockage média Cloudflare R2

Les images, vidéos et fichiers audio peuvent désormais être envoyés directement
vers Cloudflare R2 avec des URLs PUT pré-signées. Le serveur Express ne reçoit
pas les octets du fichier.

Variables `.env` : `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET` et, pour exposer les fichiers publiquement, `R2_PUBLIC_BASE_URL`.

Flux recommandé :
1. `POST /api/media/presign` (session authentifiée) ;
2. `PUT` du navigateur vers `uploadUrl` avec le `Content-Type` annoncé ;
3. `POST /api/media/:id/complete` ;
4. utiliser `publicUrl` dans les contenus qui référencent le média.

Limites : image 10 Mo, audio 50 Mo, vidéo 250 Mo. Les types MIME acceptés sont
volontairement restreints. Les fichiers restent sous le préfixe du compte qui
les a déposés.

## Étape 7 — intégration des médias R2

Les écrans d'administration Vidéos, Aha­ziges et Boutique utilisent désormais l'upload direct Cloudflare R2 via URL pré-signée. Les utilisateurs authentifiés peuvent également ajouter une photo dans « عدسة الجماهير ». Les secrets R2 restent côté serveur.

Variables nécessaires pour afficher les fichiers publiquement : `R2_PUBLIC_BASE_URL` en plus des variables R2 déjà documentées.


## Étape 8 — emails transactionnels

CABBA dispose maintenant d'une couche email côté serveur basée sur l'API HTTP
de Resend (aucune clé email n'est exposée au navigateur). L'inscription envoie
un email de bienvenue de façon asynchrone : une panne du fournisseur ne fait
pas échouer la création du compte. Les envois avec une clé `eventKey` sont
dédupliqués dans PostgreSQL et un envoi précédemment échoué peut être retenté.

Variables `.env` : `RESEND_API_KEY`, `EMAIL_FROM` et `APP_BASE_URL`. Sans ces
variables, les emails sont désactivés proprement. L'administration peut vérifier
l'état avec `GET /api/email/status` et envoyer un test avec
`POST /api/email/test` (admin uniquement).

## Analytics / observabilité

CABBA dispose d'une télémétrie interne PostgreSQL sans fournisseur analytics externe.
Le navigateur envoie uniquement une liste blanche d'événements utiles (`page_view`, `feature_use`, `match_view`, etc.) vers `/api/analytics/event`.
Un identifiant anonyme aléatoire est stocké dans un cookie HTTP-only afin d'estimer les visiteurs récurrents. Les adresses IP ne sont pas enregistrées et les métadonnées sont limitées à 4 Ko.
Le tableau de bord administrateur est disponible dans le module **التحليلات** et expose les agrégats sur 7, 30 ou 90 jours.

## Étape 10 — préparation production / sécurité

Le serveur applique désormais des protections HTTP sans dépendance de middleware supplémentaire :
`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy` et, en production, CSP + HSTS.

Le proxy de confiance est explicite via `TRUST_PROXY` (`true`, `false` ou nombre de sauts) afin que les
limiteurs de débit utilisent l'adresse IP correctement lorsqu'un reverse proxy est réellement configuré.
Aucun CORS permissif n'est activé : le front et l'API sont servis par le même serveur.

Un limiteur mémoire protège toutes les routes `/api` (120 requêtes/minute/IP) et l'inscription/connexion
(20 requêtes/15 minutes/IP). Cette protection est adaptée à une instance unique ; pour plusieurs instances,
remplacer le stockage mémoire par Redis/Upstash.

Deux sondes sont disponibles :
- `GET /api/health` = liveness, sans dépendance PostgreSQL ;
- `GET /api/ready` = readiness, avec `SELECT 1` sur PostgreSQL.

Chaque requête reçoit un `X-Request-ID`. Les arrêts `SIGTERM`/`SIGINT` ferment le scheduler, le serveur HTTP
puis le pool PostgreSQL avec un délai de grâce de 10 secondes.

Variables supplémentaires : `TRUST_PROXY=false` par défaut. Ne l'activez que si le nombre de proxies de
confiance est connu et correctement configuré.

## Étape 11 — déploiement production

CABBA est maintenant livrable sous forme d'image Docker multi-stage : le front Vite est compilé et le serveur Express est bundlé pendant le build, puis l'image runtime conserve uniquement les dépendances nécessaires à l'exécution.

Le fichier `deploy/docker-compose.production.yml` permet un lancement local de l'image. `deploy/README.md` décrit la procédure de release, les health checks, les migrations, le rollback et la contrainte actuelle d'une seule instance tant que le scheduler football reste embarqué dans le serveur.

Les migrations ne sont volontairement **pas** exécutées automatiquement au démarrage du conteneur : elles doivent être lancées une seule fois par release pour éviter les courses entre instances.

## Étape 12 — production : worker football + migrations compilées

Le déploiement sépare désormais le serveur web du scheduler API-Football. Le web utilise `FOOTBALL_SCHEDULER_ENABLED=false` en production et le processus `dist/football-worker.cjs` exécute seul le scheduler et les rappels push.

Le runner PostgreSQL est aussi compilé en `dist/migrate.cjs`, ce qui permet d'appliquer les migrations avec Node sans dépendre de `tsx` dans l'image runtime.

Voir `deploy/README.md` et `deploy/docker-compose.production.yml`.

## Étape 13 — Déploiement Cloud Run + PostgreSQL production

L'architecture de production est maintenant explicitement séparée en trois rôles :

1. **cabba-web** : service HTTP, `FOOTBALL_SCHEDULER_ENABLED=false`.
2. **cabba-football-worker** : service HTTP minimal servant uniquement de health endpoint, avec le scheduler API-Football activé, `minScale=1` et `maxScale=1`.
3. **cabba-migrations** : Cloud Run Job exécutant `node dist/migrate.cjs` une fois par release.

Fichiers :
- `deploy/cloudrun-web.yaml`
- `deploy/cloudrun-worker.yaml`
- `deploy/cloudrun-migrations-job.yaml`

Les secrets doivent être placés dans Secret Manager et injectés dans les services. Le fichier YAML contient des placeholders `PROJECT_ID`, `REGION` et `TAG` à remplacer par l'image publiée.

Ordre de release recommandé :

1. Construire et pousser l'image immuable de la release.
2. Exécuter le Job `cabba-migrations` avec cette même image.
3. Déployer `cabba-web`.
4. Déployer `cabba-football-worker`.
5. Vérifier `/api/health`, les logs du worker et l'état des synchronisations.
6. En rollback applicatif, conserver les migrations déjà appliquées et redéployer une image compatible avec le schéma courant.

Le worker possède un endpoint HTTP minimal car Cloud Run Service attend un conteneur HTTP ; cela ne change pas son rôle : aucune route applicative n'y est servie et seul le scheduler y tourne.


## Étape 14 — production Google Cloud

- Bootstrap Google Cloud : Artifact Registry + Secret Manager.
- PostgreSQL reste managé et externe à l'image.
- Release Cloud Run reproductible : build → migration → web → worker.
- Secrets injectés uniquement côté serveur.
- Worker API-Football singleton séparé du service web.
- Scripts : `deploy/bootstrap-gcp.sh` et `deploy/deploy-cloudrun.sh`.
- 40 tests d'intégrité passent.


## Étape 15 — préparation finale de production

La version actuelle ajoute une vérification post-release, un rollback Cloud Run par révisions explicites et la documentation de sauvegarde/PITR PostgreSQL. Le service Web peut scaler indépendamment du worker football ; le worker reste limité à une instance pour éviter les synchronisations API-Football en double.


## Étape 16 — validation continue et surveillance production

- CI GitHub : tests, typecheck, build Vite/Express et build Docker.
- Preflight production avant chaque release.
- Worker Cloud Run en ingress interne.
- Métriques et alertes production documentées dans `deploy/monitoring.md`.
