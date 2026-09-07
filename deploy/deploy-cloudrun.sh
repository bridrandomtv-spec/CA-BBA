#!/usr/bin/env bash
set -euo pipefail

# CABBA — release atomique en trois phases : image -> migration -> services.
# Le script suppose que bootstrap-gcp.sh a déjà été exécuté.

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
REPOSITORY="${REPOSITORY:-cabba}"
IMAGE_TAG="${IMAGE_TAG:-$(date -u +%Y%m%d-%H%M%S)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPOSITORY}/cabba:${IMAGE_TAG}"
APP_BASE_URL="${APP_BASE_URL:?Set APP_BASE_URL}"

printf '[CABBA] Build %s\n' "$IMAGE"
gcloud builds submit . --project="$PROJECT_ID" --tag="$IMAGE"

rendered_migrations="$(mktemp)"
rendered_web="$(mktemp)"
rendered_worker="$(mktemp)"
trap 'rm -f "$rendered_migrations" "$rendered_web" "$rendered_worker"' EXIT

# Run the migration from the exact image that will be released.
sed "s#REGION-docker.pkg.dev/PROJECT_ID/cabba/cabba:TAG#${IMAGE}#g" \
  deploy/cloudrun-migrations-job.yaml > "$rendered_migrations"
gcloud run jobs replace "$rendered_migrations" \
  --project="$PROJECT_ID" --region="$REGION" >/dev/null
gcloud run jobs execute cabba-migrations --project="$PROJECT_ID" --region="$REGION" --wait
sed -e "s#REGION-docker.pkg.dev/PROJECT_ID/cabba/cabba:TAG#${IMAGE}#g" \
    -e "s#https://YOUR-DOMAIN.example#${APP_BASE_URL}#g" deploy/cloudrun-web.yaml > "$rendered_web"
sed "s#REGION-docker.pkg.dev/PROJECT_ID/cabba/cabba:TAG#${IMAGE}#g" \
    deploy/cloudrun-worker.yaml > "$rendered_worker"

gcloud run services replace "$rendered_web" --project="$PROJECT_ID" --region="$REGION"
gcloud run services replace "$rendered_worker" --project="$PROJECT_ID" --region="$REGION"

echo '[CABBA] Release terminée.'
echo "[CABBA] Image: $IMAGE"
