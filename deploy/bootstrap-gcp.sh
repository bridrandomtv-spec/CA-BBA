#!/usr/bin/env bash
set -euo pipefail

# CABBA — bootstrap Google Cloud resources.
# Prerequisites: gcloud authenticated, billing enabled, and a production
# PostgreSQL instance already provisioned (Cloud SQL or another managed provider).
# Secret values are read from environment variables and never written to files.

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-cabba}"

: "${CABBA_DATABASE_URL:?Set CABBA_DATABASE_URL}"
: "${CABBA_SESSION_SECRET:?Set CABBA_SESSION_SECRET}"
: "${CABBA_API_FOOTBALL_KEY:?Set CABBA_API_FOOTBALL_KEY}"
: "${CABBA_GEMINI_API_KEY:?Set CABBA_GEMINI_API_KEY}"
: "${CABBA_VAPID_PUBLIC_KEY:?Set CABBA_VAPID_PUBLIC_KEY}"
: "${CABBA_VAPID_PRIVATE_KEY:?Set CABBA_VAPID_PRIVATE_KEY}"
: "${CABBA_VAPID_SUBJECT:?Set CABBA_VAPID_SUBJECT}"
: "${CABBA_R2_ACCOUNT_ID:?Set CABBA_R2_ACCOUNT_ID}"
: "${CABBA_R2_ACCESS_KEY_ID:?Set CABBA_R2_ACCESS_KEY_ID}"
: "${CABBA_R2_SECRET_ACCESS_KEY:?Set CABBA_R2_SECRET_ACCESS_KEY}"
: "${CABBA_R2_PUBLIC_BASE_URL:?Set CABBA_R2_PUBLIC_BASE_URL}"
: "${CABBA_RESEND_API_KEY:?Set CABBA_RESEND_API_KEY}"
: "${CABBA_EMAIL_FROM:?Set CABBA_EMAIL_FROM}"

printf '[CABBA] project=%s region=%s repository=%s\n' "$PROJECT_ID" "$REGION" "$REPOSITORY"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com >/dev/null

gcloud artifacts repositories describe "$REPOSITORY" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$REPOSITORY" --repository-format=docker --location="$REGION" --description='CABBA production images'

put_secret() {
  local name="$1" value="$2"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic >/dev/null
  fi
  printf '%s' "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
}

put_secret cabba-database-url "$CABBA_DATABASE_URL"
put_secret cabba-session-secret "$CABBA_SESSION_SECRET"
put_secret cabba-api-football-key "$CABBA_API_FOOTBALL_KEY"
put_secret cabba-gemini-api-key "$CABBA_GEMINI_API_KEY"
put_secret cabba-vapid-public-key "$CABBA_VAPID_PUBLIC_KEY"
put_secret cabba-vapid-private-key "$CABBA_VAPID_PRIVATE_KEY"
put_secret cabba-vapid-subject "$CABBA_VAPID_SUBJECT"
put_secret cabba-r2-account-id "$CABBA_R2_ACCOUNT_ID"
put_secret cabba-r2-access-key-id "$CABBA_R2_ACCESS_KEY_ID"
put_secret cabba-r2-secret-access-key "$CABBA_R2_SECRET_ACCESS_KEY"
put_secret cabba-r2-public-base-url "$CABBA_R2_PUBLIC_BASE_URL"
put_secret cabba-resend-api-key "$CABBA_RESEND_API_KEY"
put_secret cabba-email-from "$CABBA_EMAIL_FROM"

# Grant the default Compute service account access to the secrets. For a
# dedicated runtime service account, replace this principal before production.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${RUNTIME_SERVICE_ACCOUNT:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
for secret in cabba-database-url cabba-session-secret cabba-api-football-key cabba-gemini-api-key \
  cabba-vapid-public-key cabba-vapid-private-key cabba-vapid-subject cabba-r2-account-id \
  cabba-r2-access-key-id cabba-r2-secret-access-key cabba-r2-public-base-url cabba-resend-api-key cabba-email-from; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role='roles/secretmanager.secretAccessor' >/dev/null
done

echo '[CABBA] Bootstrap terminé. Les secrets sont dans Secret Manager.'
