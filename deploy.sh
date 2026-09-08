#!/usr/bin/env bash
# One-shot deploy to Azure App Service. Requires the Azure CLI and `az login` first.
# Usage: ./deploy.sh <unique-app-name> [region]
set -euo pipefail
APP="${1:?Usage: ./deploy.sh <unique-app-name> [region]}"
LOCATION="${2:-uksouth}"
RG="${APP}-rg"
PLAN="${APP}-plan"
cd "$(dirname "$0")"

az account show -o none 2>/dev/null || { echo "Not logged in. Run: az login --use-device-code"; exit 1; }

echo "Creating resources for $APP in $LOCATION ..."
az group create -n "$RG" -l "$LOCATION" -o none
az appservice plan create -n "$PLAN" -g "$RG" --is-linux --sku B1 -o none
az webapp create -n "$APP" -g "$RG" -p "$PLAN" --runtime "NODE:22-lts" -o none

# WebSockets for real-time updates; one instance only (game state is in memory);
# and tell Azure to run `npm install` on the server after upload.
az webapp config set -n "$APP" -g "$RG" --web-sockets-enabled true --number-of-workers 1 --startup-file "npm start" -o none
az webapp config appsettings set -n "$APP" -g "$RG" --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true -o none

echo "Uploading code ..."
ZIP="$(mktemp -u).zip"
zip -qr "$ZIP" package.json package-lock.json src public .deployment
az webapp deploy -n "$APP" -g "$RG" --src-path "$ZIP" --type zip -o none
rm -f "$ZIP"

echo
echo "Done. Share this with the family:  https://$APP.azurewebsites.net"
echo "To stop paying when not playing:   az webapp stop -n $APP -g $RG"
echo "To start it again:                 az webapp start -n $APP -g $RG"
echo "To delete everything:              az group delete -n $RG --yes"
