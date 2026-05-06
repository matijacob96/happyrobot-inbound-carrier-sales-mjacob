#!/usr/bin/env bash
# Deploy hr-api and hr-dashboard to Google Cloud Run.
#
# Usage:
#   PROJECT_ID=my-project REGION=us-central1 ./infra/deploy.sh
#
# Both services are built with `gcloud builds submit` using the monorepo root as
# context (required by the workspace-aware Dockerfiles), then deployed with
# `gcloud run deploy --image` pointing at gcr.io.
#
# Architecture:
#   - hr-api        : public Cloud Run, x-api-key required (secret hr-api-key)
#   - hr-dashboard  : public Cloud Run, runs an nginx BFF that proxies /api/* to
#                     hr-api with x-api-key injected server-side. The browser
#                     never holds a credential.

set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID env var}"
REGION="${REGION:-us-central1}"
API_SERVICE="${API_SERVICE:-hr-api}"
DASHBOARD_SERVICE="${DASHBOARD_SERVICE:-hr-dashboard}"
# Optional: a free Socrata App Token at data.transportation.gov raises rate
# limits for FMCSA carrier lookups. Bind via secret if you have one:
#   echo -n "<TOKEN>" | gcloud secrets create hr-fmcsa-app-token --data-file=-
USE_FMCSA_TOKEN="$(gcloud secrets describe hr-fmcsa-app-token >/dev/null 2>&1 && echo yes || echo no)"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Project: $PROJECT_ID  Region: $REGION  FMCSA App Token bound: $USE_FMCSA_TOKEN"
gcloud config set project "$PROJECT_ID" >/dev/null

# 1. Enable required services (idempotent)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com >/dev/null

# 2. Make sure the required secret exists. Bootstrap it once with:
#    echo -n "$(openssl rand -hex 32)" | gcloud secrets create hr-api-key --data-file=-
if ! gcloud secrets describe hr-api-key >/dev/null 2>&1; then
  echo "ERROR: secret 'hr-api-key' missing. Create it first:"
  echo "  echo -n '<value>' | gcloud secrets create hr-api-key --data-file=-"
  exit 1
fi

# Optional FMCSA App Token. We bind it only if the operator already created
# the secret; FMCSA Open Data works without it (just with lower rate limits).
SECRETS_TO_BIND=("hr-api-key")
[[ "$USE_FMCSA_TOKEN" == "yes" ]] && SECRETS_TO_BIND+=("hr-fmcsa-app-token")

# 2b. Grant the Cloud Run runtime service account access to the secrets.
# By default, Cloud Run uses {PROJECT_NUMBER}-compute@developer.gserviceaccount.com
# unless overridden. The role binding is idempotent.
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo "==> Granting $RUNTIME_SA access to ${SECRETS_TO_BIND[*]}"
for s in "${SECRETS_TO_BIND[@]}"; do
  gcloud secrets add-iam-policy-binding "$s" \
    --member="serviceAccount:$RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
done

# Pre-compute the dashboard URL (if the service already exists) so we can lock
# down CORS to that origin even on a fresh deploy. On the first ever deploy the
# dashboard URL is unknown until step 6 — in that case the API gets CORS=* on
# pass 1 and a tightened allowlist on pass 2.
DASH_URL_EXISTING="$(gcloud run services describe "$DASHBOARD_SERVICE" --region "$REGION" --format='value(status.url)' 2>/dev/null || true)"
if [[ -n "$DASH_URL_EXISTING" ]]; then
  CORS_ORIGINS_VALUE="${CORS_ORIGINS:-$DASH_URL_EXISTING}"
else
  CORS_ORIGINS_VALUE="${CORS_ORIGINS:-*}"
fi
echo "==> CORS_ORIGINS=$CORS_ORIGINS_VALUE"

# 3. Build the API image with the monorepo root as build context
echo "==> Building $API_SERVICE image (context: repo root)"
gcloud builds submit . \
  --config=infra/cloudbuild.api.yaml \
  --region="$REGION"

# 4. Deploy the API
API_SECRETS="API_KEY=hr-api-key:latest"
if [[ "$USE_FMCSA_TOKEN" == "yes" ]]; then
  API_SECRETS="$API_SECRETS,FMCSA_SOCRATA_APP_TOKEN=hr-fmcsa-app-token:latest"
fi

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
  --set-env-vars "NODE_ENV=production,FIREBASE_PROJECT_ID=$PROJECT_ID,CORS_ORIGINS=$CORS_ORIGINS_VALUE" \
  --set-secrets "$API_SECRETS"

API_URL="$(gcloud run services describe "$API_SERVICE" --region "$REGION" --format='value(status.url)')"
echo "    API_URL=$API_URL"

# 5. Build the dashboard image (no API URL baked in any more — runtime config)
echo "==> Building $DASHBOARD_SERVICE image (context: repo root)"
gcloud builds submit . \
  --config=infra/cloudbuild.dashboard.yaml \
  --region="$REGION"

# 6. Deploy the dashboard. The nginx BFF inside this container proxies /api/*
#    to UPSTREAM_API and injects x-api-key from the secret server-side, so
#    the browser never holds a credential.
echo "==> Deploying $DASHBOARD_SERVICE (BFF -> $API_URL)"
gcloud run deploy "$DASHBOARD_SERVICE" \
  --image "gcr.io/$PROJECT_ID/hr-dashboard:latest" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --max-instances 3 \
  --set-env-vars "UPSTREAM_API=$API_URL" \
  --set-secrets "API_KEY=hr-api-key:latest"

DASH_URL="$(gcloud run services describe "$DASHBOARD_SERVICE" --region "$REGION" --format='value(status.url)')"

# 7. Tighten CORS now that we know the dashboard URL. Idempotent; if the value
#    didn't change Cloud Run will be a no-op. This protects the API from being
#    called from an unknown browser origin (e.g. a stolen leaked URL).
if [[ "$CORS_ORIGINS_VALUE" != "$DASH_URL" ]] && [[ -z "${CORS_ORIGINS:-}" ]]; then
  echo "==> Tightening CORS_ORIGINS on $API_SERVICE to $DASH_URL"
  gcloud run services update "$API_SERVICE" \
    --region "$REGION" \
    --update-env-vars "CORS_ORIGINS=$DASH_URL" >/dev/null
fi

echo
echo "Done."
echo "  API:       $API_URL"
echo "  Dashboard: $DASH_URL"
echo
echo "Reminder: seed Firestore once with"
echo "  FIREBASE_PROJECT_ID=$PROJECT_ID pnpm --filter @hr/api seed"
