# PRODUCTION_CHECKLIST — CABBA

Bilan de l'audit complet (7 passes, ~60 fichiers) appliqué sur cette branche.
Verdict : **PRÊTE POUR LA PRODUCTION** une fois les étapes A exécutées.

## A. Bloquants avant la première release

| # | Étape | Vérification |
|---|---|---|
| 1 | CI verte sur cette branche | tests + test:db (3 suites) + typecheck + build + docker |
| 2 | Merger la PR vers `main` | la CI repasse sur main |
| 3 | Secrets dans Secret Manager | liste B ci-dessous ; `SESSION_SECRET ≥ 32` caractères (`openssl rand -hex 48`) |
| 4 | PostgreSQL managé créé + accessible | Cloud SQL recommandé, PITR activé, sauvegardes testées |
| 5 | Build + push de l'image immuable | `docker build` → Artifact Registry, tag de release |
| 6 | Exécuter le job `cabba-migrations` | migrations 001→016 dans l'ordre (le runner est idempotent) |
| 7 | Déployer `cabba-web` | `FOOTBALL_SCHEDULER_ENABLED=false`, `TRUST_PROXY=1` |
| 8 | Déployer `cabba-football-worker` | singleton `maxScale=1`, ingress interne |
| 9 | `deploy/verify-release.sh` | liveness + readiness |
| 10 | `deploy/verify-audit.sh https://<domaine>` | sections 1→16 toutes PASS |
| 11 | Planifier `cabba-retention-daily` | Cloud Scheduler 03:00 Africa/Algiers |

## B. Variables d'environnement

**Vitales (absence = démarrage refusé en prod)**
- `DATABASE_URL`, `SESSION_SECRET`, `NODE_ENV=production`, `PORT`, `HOST=0.0.0.0`
- `TRUST_PROXY=1` — Cloud Run ajoute exactement un saut de proxy

**Fonctionnalités (absence = dégradation propre, jamais de crash)**
- `GEMINI_API_KEY` — assistant IA (503 explicite sinon ; route authentifiée + quota 10/min/compte)
- `API_FOOTBALL_KEY`, `API_FOOTBALL_LEAGUE_ID`, `API_FOOTBALL_TEAM_ID`, `API_FOOTBALL_SEASON`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npm run vapid:generate`)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- `RESEND_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`
- `REDIS_URL` — rate limiting partagé (obligatoire dès que cabba-web scale > 1)
- `PASSWORD_BREACH_CHECK` — défaut true (HIBP fail-open)
- `ANALYTICS_RETENTION_DAYS=90`, `PUSH_LOG_RETENTION_DAYS=90`
- `FOOTBALL_SCHEDULER_ENABLED` — false sur web, true sur worker

## C. Vérifications post-lancement (première semaine)

- [ ] Un vrai match : SSE Match Center, push but/fin, événements réels, votes MVP
- [ ] Fuseau : l'heure affichée d'un match = heure de Bordj (UTC+1), rappel push ~30 min avant
- [ ] Parcours RGPD complet sur compte test : consentement → export → suppression → réinscription
- [ ] Boutique : commande → email de confirmation → annulation par l'admin → stock restauré
- [ ] Cloud Monitoring : alertes de `deploy/monitoring.md` actives ; quota API-Football < 80/jour
- [ ] Lighthouse PWA ≥ 90 sur mobile 4G ; installation PWA (icônes 192/512 présentes)
- [ ] Test de restauration PITR PostgreSQL AVANT le premier match à affluence

## D. Dette connue, non bloquante (à planifier)

1. Billetterie : onglet التذاكر en placeholder (aucune API tickets)
2. `tw-animate-css` : les classes `animate-in` restent inertes tant que le
   paquet n'est pas ajouté (nécessite une mise à jour du lockfile en local :
   `npm i -D tw-animate-css` + `@import "tw-animate-css";` dans index.css)
3. `noUnusedLocals`/`noUnusedParameters` : à activer dans tsconfig quand
   `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` rend 0 en local
4. Layout tablette/desktop des écrans internes : la coquille est prête
   (rail latéral, mesure max-w-3xl), les grilles internes s'étirent proprement
5. E2E Playwright : à ajouter avec `npm i -D @playwright/test` (lockfile)
6. `d3` en dépendance directe : inutilisé (recharts suffit) — à retirer en
   local (`npm uninstall d3 @types/d3` met à jour le lockfile)
7. Templates email match_reminder/final_score : le push couvre ces cas ;
   l'email n'est câblé que pour les commandes (confirmation + statuts)
