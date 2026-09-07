#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
WEB_REVISION="${WEB_REVISION:?Set WEB_REVISION}"
WORKER_REVISION="${WORKER_REVISION:?Set WORKER_REVISION}"

printf '[CABBA] Rollback web -> %s\n' "$WEB_REVISION"
gcloud run services update-traffic cabba-web \
  --project="$PROJECT_ID" --region="$REGION" \
  --to-revisions="${WEB_REVISION}=100"

printf '[CABBA] Rollback worker -> %s\n' "$WORKER_REVISION"
gcloud run services update-traffic cabba-football-worker \
  --project="$PROJECT_ID" --region="$REGION" \
  --to-revisions="${WORKER_REVISION}=100"

echo '[CABBA] Rollback applicatif terminé.'
echo '[CABBA] Si le schéma PostgreSQL est incompatible, restaurez la base selon votre procédure PITR/backups validée.'
