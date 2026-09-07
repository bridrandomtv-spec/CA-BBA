#!/usr/bin/env bash
set -euo pipefail

# CABBA — garde-fou avant release production.
# Ce script ne déploie rien et ne lit aucun secret applicatif.

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
APP_BASE_URL="${APP_BASE_URL:?Set APP_BASE_URL}"

command -v gcloud >/dev/null || { echo '[CABBA] gcloud est requis.' >&2; exit 1; }
command -v curl >/dev/null || { echo '[CABBA] curl est requis.' >&2; exit 1; }

echo '[CABBA] Vérification projet/région...'
ACTIVE_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [[ "$ACTIVE_PROJECT" != "$PROJECT_ID" ]]; then
  echo "[CABBA] Projet gcloud actif ($ACTIVE_PROJECT) différent de PROJECT_ID ($PROJECT_ID)." >&2
  exit 1
fi

echo '[CABBA] Vérification des services Cloud Run...'
gcloud run services describe cabba-web --project="$PROJECT_ID" --region="$REGION" >/dev/null
gcloud run services describe cabba-football-worker --project="$PROJECT_ID" --region="$REGION" >/dev/null

echo '[CABBA] Vérification des secrets attendus...'
for secret in \
  cabba-database-url \
  cabba-session-secret \
  cabba-api-football-key; do
  gcloud secrets describe "$secret" --project="$PROJECT_ID" >/dev/null
done

echo '[CABBA] Vérification HTTP de la version actuellement déployée...'
APP_BASE_URL="${APP_BASE_URL%/}"
curl --fail --silent --show-error --max-time 15 "$APP_BASE_URL/api/health" >/dev/null
curl --fail --silent --show-error --max-time 15 "$APP_BASE_URL/api/ready" >/dev/null

echo '[CABBA] PRE-FLIGHT OK — la release peut être lancée.'
