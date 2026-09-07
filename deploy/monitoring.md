# CABBA — surveillance production

## Indicateurs minimum

Surveiller les services `cabba-web` et `cabba-football-worker` dans Cloud Run :

- taux de requêtes 5xx du Web ;
- latence p95/p99 du Web ;
- redémarrages du Worker ;
- erreurs du Worker dans Cloud Logging ;
- disponibilité de `/api/health` et `/api/ready` ;
- erreurs PostgreSQL ;
- erreurs API-Football et consommation du quota ;
- échecs d'e-mails Resend ;
- échecs d'upload R2 ;
- échecs Web Push.

## Alertes recommandées

Créer au minimum :

1. une alerte si le taux HTTP 5xx du Web dépasse 2 % pendant 5 minutes ;
2. une alerte si le Worker redémarre plusieurs fois en 15 minutes ;
3. une alerte si la readiness PostgreSQL échoue plusieurs fois ;
4. une alerte si les erreurs API-Football deviennent continues ;
5. une alerte de budget Google Cloud.

Les seuils doivent être ajustés après observation de la charge réelle.

## Avant chaque release

```bash
PROJECT_ID=mon-projet \
REGION=europe-west1 \
APP_BASE_URL=https://cabba.example \
bash deploy/preflight-production.sh
```

Puis lancer `deploy-cloudrun.sh`.

## Après chaque release

```bash
PROJECT_ID=mon-projet \
REGION=europe-west1 \
APP_BASE_URL=https://cabba.example \
bash deploy/verify-release.sh
```

Conserver le tag d'image et les noms des révisions Web/Worker dans le journal de release afin de pouvoir effectuer un rollback déterministe.
