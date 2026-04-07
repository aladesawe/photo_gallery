#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${AZURE_STATIC_WEBAPP_NAME:-}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-}"
LOCATION="${AZURE_LOCATION:-}"
BRANCH="${AZURE_BRANCH:-main}"
BUILD_DIR="build"
APP_LOCATION="."
API_LOCATION="api"

function usage() {
  cat <<EOF
Usage:
  AZURE_STATIC_WEBAPP_NAME=<name> \
  AZURE_RESOURCE_GROUP=<resource-group> \
  AZURE_LOCATION=<region> \
  ./deploy-azure.sh

Optional:
  AZURE_BRANCH=<branch>  # defaults to main

This script builds the React app and deploys it to Azure Static Web Apps.
It also ensures the resource group exists before deployment.
EOF
}

if [[ -z "$APP_NAME" || -z "$RESOURCE_GROUP" || -z "$LOCATION" ]]; then
  usage
  exit 1
fi

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI is required. Install it from https://aka.ms/installazurecli"
  exit 1
fi

echo "Building production assets..."
npm run build

if ! az account show >/dev/null 2>&1; then
  echo "Logging into Azure..."
  az login
fi

echo "Ensuring Azure resource group exists: $RESOURCE_GROUP"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

function create_static_app() {
  echo "Creating Azure Static Web App '$APP_NAME' in resource group '$RESOURCE_GROUP'..."
  az staticwebapp create \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --source . \
    --branch "$BRANCH" \
    --app-location "$APP_LOCATION" \
    --api-location "$API_LOCATION" \
    --app-artifact-location "$BUILD_DIR"
}

function upload_build() {
  echo "Uploading local build artifacts to Azure Static Web App '$APP_NAME'..."
  az staticwebapp upload --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" --source "$BUILD_DIR"
}

if az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
  if upload_build; then
    echo "Deployment complete."
    exit 0
  fi
  echo "Failed to upload build artifacts. Verify Azure CLI extension support or use the Static Web App GitHub workflow."
  exit 1
fi

create_static_app

echo "Deployment complete."
