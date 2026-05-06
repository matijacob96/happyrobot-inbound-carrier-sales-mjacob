#!/usr/bin/env bash
# Deploy hr-api and hr-dashboard to Google Cloud Run.
#
# Usage:
#   PROJECT_ID=my-project REGION=us-central1 ./infra/deploy.sh
#
# Both services are built with `gcloud builds submit` using the monorepo root as
# context (required by the workspace-aware Dockerfiles), then deployed with
# `gcloud run deploy --image` pointing at gcr.io.

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID env var}"
REGION="${REGION:-us-central1}"
API_SERVICE="${API_SERVICE:-hr-api}"
DASHBOARD_SERVICE="${DASHBOARD_SERVICE:-hr-dashboard}"
# FMCSA_MOCK=true keeps verify_carrier in mock mode (default while FMCSA key is being sorted out).
# Flip with: gcloud run services update $API_SERVICE --region $REGION --update-env-vars FMCSA_MOCK=false
FMCSA_MOCK="${FMCSA_MOCK:-true}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Project: $PROJECT_ID  Region: $REGION  FMCSA_MOCK=$FMCSA_MOCK"
gcloud config set project "$PROJECT_ID" >/dev/null

# 1. Enable required services (idempotent)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com >/dev/null

# 2. Make sure the secrets exist. Bootstrap them once with:
#    echo -n "$(openssl rand -hex 32)" | gcloud secrets create hr-api-key   --data-file=-
#    echo -n "<FMCSA_KEY>"             | gcloud secrets create hr-fmcsa-key --data-file=-
for s in hr-api-key hr-fmcsa-key; do
  if ! gcloud secrets describe "$s" >/dev/null 2>&1; then
    echo "ERROR: secret '$s' missing. Create it first:"
    echo "  echo -n '<value>' | gcloud secrets create $s --data-file=-"
    exit 1
  fi
done

# 2b. Grant the Cloud Run runtime service account access to the secrets.
# By default, Cloud Run uses {PROJECT_NUMBER}-compute@developer.gserviceaccount.com
# unless overridden. The role binding is idempotent.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "==> Granting $RUNTIME_SA access to secrets"
for s in hr-api-key hr-fmcsa-key; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
done

# 3. Build the API image with the monorepo root as build context
echo "==> Building $API_SERVICE image (context: repo root)"
gcloud builds submit . \
  --config=infra/cloudbuild.api.yaml \
  --region="$REGION"

# 4. Deploy the API
echo "==> Deploying $API_SERVICE"
gcloud run deploy "$API_SERVICE" \
  --image "gcr.io/$PROJECT_ID/hr-api:latest" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --concurrency 40 \
  --max-instances 5 \
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID,CORS_ORIGINS=*,FMCSA_MOCK=$FMCSA_MOCK" \
  --set-secrets "API_KEY=hr-api-key:latest,FMCSA_API_KEY=hr-fmcsa-key:latest"

API_URL="$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)')"
echo "    API_URL=$API_URL"

# 5. Build the dashboard image with the API URL baked in at build time
echo "==> Building $DASHBOARD_SERVICE image (context: repo root, API_URL=$API_URL)"
gcloud builds submit . \
  --config=infra/cloudbuild.dashboard.yaml \
  --substitutions=_API_URL="$API_URL" \
  --region="$REGION"

# 6. Deploy the dashboard
echo "==> Deploying $DASHBOARD_SERVICE"
gcloud run deploy "$DASHBOARD_SERVICE" \
  --image "gcr.io/$PROJECT_ID/hr-dashboard:latest" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --max-instances 3

DASH_URL="$(gcloud run services describe "$DASHBOARD_SERVICE" --region "$REGION" --format='value(status.url)')"

echo
echo "Done."
echo "  API:       $API_URL"
echo "  Dashboard: $DASH_URL"
echo
echo "Reminder: seed Firestore once with"
echo "  FIREBASE_PROJECT_ID=$PROJECT_ID pnpm --filter @hr/api seed"
