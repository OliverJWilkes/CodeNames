#!/usr/bin/env bash
# One-shot deploy to Azure App Service. Requires the Azure CLI and `az login` first.
# Usage: ./deploy.sh <unique-app-name> [region]
set -euo pipefail
APP="${1:?Usage: ./deploy.sh <unique-app-name> [region] [sku]}"
LOCATION="${2:-uksouth}"
# F1 is the free tier and needs no VM quota, so it works on a new trial subscription.
# Use B1 for a faster, always-on app once the subscription is upgraded to pay-as-you-go.
SKU="${3:-F1}"
RG="${APP}-rg"
PLAN="${APP}-plan"
cd "$(dirname "$0")"

az account show -o none 2>/dev/null || { echo "Not logged in. Run: az login --use-device-code"; exit 1; }

echo "Creating resources for $APP in $LOCATION ..."
az group create -n "$RG" -l "$LOCATION" -o none
az appservice plan create -n "$PLAN" -g "$RG" --is-linux --sku "$SKU" -o none
az webapp create -n "$APP" -g "$RG" -p "$PLAN" --runtime "NODE:22-lts" -o none

# One instance only, as game state is held in memory. WebSockets give the snappiest
# updates but are not available on the free tier; the game falls back to HTTP
# long-polling there, which works fine for a family game.
az webapp config set -n "$APP" -g "$RG" --number-of-workers 1 --startup-file "npm start" -o none
if [ "$SKU" != "F1" ]; then
  az webapp config set -n "$APP" -g "$RG" --web-sockets-enabled true -o none
fi
az webapp config appsettings set -n "$APP" -g "$RG" --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true -o none

echo "Uploading code ..."
ZIP="$(mktemp -u).zip"
zip -qr "$ZIP" package.json package-lock.json src public .deployment
az webapp deploy -n "$APP" -g "$RG" --src-path "$ZIP" --type zip -o none
rm -f "$ZIP"

echo
echo "Done ($SKU tier). Share this with the family:  https://$APP.azurewebsites.net"
echo "To stop paying when not playing:   az webapp stop -n $APP -g $RG"
echo "To start it again:                 az webapp start -n $APP -g $RG"
echo "To delete everything:              az group delete -n $RG --yes"
