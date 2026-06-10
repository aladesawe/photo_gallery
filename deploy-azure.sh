#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

function load_dotenv() {
  if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
    return
  fi

  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
}

load_dotenv

APP_NAME="${AZURE_STATIC_WEBAPP_NAME:-photo-gallery}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-rg-photo-gallery}"
LOCATION="${AZURE_LOCATION:-eastus2}"
SKU="${AZURE_STATIC_WEBAPP_SKU:-Free}"
CUSTOM_DOMAIN="${AZURE_CUSTOM_DOMAIN:-gallery.aladesawe.com}"
CONFIGURE_CUSTOM_DOMAIN="${AZURE_CONFIGURE_CUSTOM_DOMAIN:-false}"
SOURCE_REPOSITORY="${AZURE_STATIC_WEBAPP_SOURCE:-}"
BRANCH="${AZURE_BRANCH:-main}"
APP_LOCATION="/"
API_LOCATION="api"
OUTPUT_LOCATION="build"

function usage() {
  cat <<EOF
Usage:
  AZURE_STATIC_WEBAPP_NAME=photo-gallery \\
  AZURE_RESOURCE_GROUP=rg-photo-gallery \\
  AZURE_LOCATION=eastus2 \\
  COSMOS_ENDPOINT=https://<account>.documents.azure.com:443/ \\
  COSMOS_KEY=<primary-key> \\
  COSMOS_DATABASE=<database> \\
  COSMOS_CONTAINER=<container> \\
  AZURE_STORAGE_ACCOUNT_NAME=<storage-account> \\
  AZURE_STORAGE_ACCOUNT_KEY=<storage-key> \\
  AZURE_STORAGE_CONTAINER_NAME=<blob-container> \\
  ./deploy-azure.sh

Optional:
  AZURE_STATIC_WEBAPP_SKU=Free|Standard     Defaults to Free
  AZURE_CUSTOM_DOMAIN=gallery.aladesawe.com Defaults to gallery.aladesawe.com
  AZURE_CONFIGURE_CUSTOM_DOMAIN=true        Attempts Azure custom-domain validation
  AZURE_STATIC_WEBAPP_SOURCE=<repo-url>     Connects the SWA resource to GitHub/Azure DevOps
  AZURE_BRANCH=main                         Branch used when source repo is provided
  SKIP_NPM_CI=true                          Skip npm ci before build

The script deploys this React app to Azure Static Web Apps with the api/
folder as the managed Azure Functions backend. Cosmos settings are applied
as Static Web App app settings for the managed API.
EOF
}

function require_command() {
  local command_name="$1"
  local install_hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "$command_name is required. $install_hint"
    exit 1
  fi
}

function require_node_20() {
  local major
  major="$(node -p "Number(process.versions.node.split('.')[0])")"

  if (( major < 20 )); then
    echo "Node.js 20 or newer is required for this app's current dependencies. Found: $(node --version)"
    exit 1
  fi
}

function ensure_az_login() {
  if ! az account show >/dev/null 2>&1; then
    echo "Logging into Azure..."
    az login >/dev/null
  fi
}

function ensure_static_webapp() {
  echo "Ensuring resource group '$RESOURCE_GROUP' exists in '$LOCATION'..."
  az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none

  if az staticwebapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" >/dev/null 2>&1; then
    echo "Static Web App '$APP_NAME' already exists."
    return
  fi

  echo "Creating Static Web App '$APP_NAME'..."
  if [[ -n "$SOURCE_REPOSITORY" ]]; then
    az staticwebapp create \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      --sku "$SKU" \
      --source "$SOURCE_REPOSITORY" \
      --branch "$BRANCH" \
      --app-location "$APP_LOCATION" \
      --api-location "$API_LOCATION" \
      --output-location "$OUTPUT_LOCATION" \
      --output none
  else
    az staticwebapp create \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --location "$LOCATION" \
      --sku "$SKU" \
      --output none
  fi
}

function apply_api_settings() {
  local missing=()
  local setting_args=()
  local required_settings=(
    COSMOS_ENDPOINT
    COSMOS_KEY
    COSMOS_DATABASE
    COSMOS_CONTAINER
    AZURE_STORAGE_ACCOUNT_NAME
    AZURE_STORAGE_ACCOUNT_KEY
    AZURE_STORAGE_CONTAINER_NAME
  )
  local optional_settings=(
    BLOB_SAS_TTL_MINUTES
  )

  for key in "${required_settings[@]}"; do
    if [[ -z "${!key:-}" ]]; then
      missing+=("$key")
    else
      setting_args+=("$key=${!key}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    echo "Missing required managed API app settings: ${missing[*]}"
    exit 1
  fi

  for key in "${optional_settings[@]}"; do
    if [[ -n "${!key:-}" ]]; then
      setting_args+=("$key=${!key}")
    fi
  done

  if (( ${#setting_args[@]} == 0 )); then
    echo "Skipping managed API app settings. No supported settings found."
    return
  fi

  echo "Applying managed API app settings..."
  az staticwebapp appsettings set \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --setting-names "${setting_args[@]}" \
    --output none
}

function install_dependencies() {
  if [[ "${SKIP_NPM_CI:-false}" == "true" ]]; then
    return
  fi

  echo "Installing app dependencies..."
  npm ci

  echo "Installing API dependencies..."
  if [[ -f "$SCRIPT_DIR/api/package-lock.json" ]]; then
    npm ci --prefix "$SCRIPT_DIR/api"
  else
    npm install --prefix "$SCRIPT_DIR/api"
  fi
}

function build_app() {
  echo "Building production assets..."
  npm run build
}

function deploy_app() {
  local deployment_token

  deployment_token="$(az staticwebapp secrets list \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.apiKey" \
    --output tsv)"

  if [[ -z "$deployment_token" ]]; then
    echo "Could not read Static Web Apps deployment token."
    exit 1
  fi

  echo "Deploying build and managed API..."
  if command -v swa >/dev/null 2>&1; then
    swa deploy "$OUTPUT_LOCATION" \
      --api-location "$API_LOCATION" \
      --api-language node \
      --api-version 20 \
      --deployment-token "$deployment_token" \
      --env production
  else
    npx -y @azure/static-web-apps-cli@latest deploy "$OUTPUT_LOCATION" \
      --api-location "$API_LOCATION" \
      --api-language node \
      --api-version 20 \
      --deployment-token "$deployment_token" \
      --env production
  fi
}

function configure_domain() {
  local default_hostname
  default_hostname="$(az staticwebapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "defaultHostname" \
    --output tsv)"

  echo
  echo "Default Static Web Apps hostname: https://$default_hostname"
  echo "For $CUSTOM_DOMAIN, create this DNS record before validation:"
  echo "  Type: CNAME"
  echo "  Host: ${CUSTOM_DOMAIN%%.*}"
  echo "  Value: $default_hostname"

  if [[ "$CONFIGURE_CUSTOM_DOMAIN" == "true" ]]; then
    echo "Requesting Static Web Apps custom-domain validation for '$CUSTOM_DOMAIN'..."
    az staticwebapp hostname set \
      --name "$APP_NAME" \
      --resource-group "$RESOURCE_GROUP" \
      --hostname "$CUSTOM_DOMAIN" \
      --validation-method cname-delegation \
      --output table
  else
    echo "After DNS propagates, rerun with AZURE_CONFIGURE_CUSTOM_DOMAIN=true to validate it in Azure."
  fi
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

require_command node "Install Node.js 20 LTS or newer."
require_command npm "Install npm with Node.js."
require_command az "Install Azure CLI from https://aka.ms/installazurecli"
require_node_20
ensure_az_login
ensure_static_webapp
apply_api_settings
install_dependencies
build_app
deploy_app
configure_domain

echo
echo "Deployment complete."
