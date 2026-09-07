#!/usr/bin/env bash
# One-shot deploy to Azure App Service. Requires the Azure CLI and `az login` first.
# Usage: ./deploy.sh <unique-app-name> [region]
set -euo pipefail
APP="${1:?Usage: ./deploy.sh <unique-app-name> [region]}"
LOCATION="${2:-uksouth}"
RG="${APP}-rg"
PLAN="${APP}-plan"

echo "Deploying $APP to $LOCATION ..."
az webapp up --name "$APP" --resource-group "$RG" --plan "$PLAN" \
  --location "$LOCATION" --runtime "NODE:22-lts" --sku B1 --os-type Linux

# The game needs WebSockets for real-time updates, and one instance only (state is in memory).
az webapp config set --name "$APP" --resource-group "$RG" --web-sockets-enabled true --number-of-workers 1 -o none
az webapp config appsettings set --name "$APP" --resource-group "$RG" \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true -o none

echo
echo "Done. Share this with the family:  https://$APP.azurewebsites.net"
echo "To stop paying when not playing:   az webapp stop -n $APP -g $RG"
echo "To delete everything:              az group delete -n $RG --yes"
