#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
APP_BASE_URL="${APP_BASE_URL:?Set APP_BASE_URL}"

APP_BASE_URL="${APP_BASE_URL%/}"

printf '[CABBA] Vérification HTTP: %s\n' "$APP_BASE_URL"
curl --fail --silent --show-error --max-time 15 "$APP_BASE_URL/api/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "$APP_BASE_URL/api/ready" >/dev/null

printf '[CABBA] Vérification Cloud Run services...\n'
gcloud run services describe cabba-web --project="$PROJECT_ID" --region="$REGION" >/dev/null
gcloud run services describe cabba-football-worker --project="$PROJECT_ID" --region="$REGION" >/dev/null

echo '[CABBA] Vérification post-release OK.'
