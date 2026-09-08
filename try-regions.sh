#!/usr/bin/env bash
# Azure trial subscriptions often have zero App Service quota in some regions.
# This tries a list of regions and stops at the first one that works.
# Usage: ./try-regions.sh <unique-app-name> [sku]
set -uo pipefail
APP="${1:?Usage: ./try-regions.sh <unique-app-name> [sku]}"
SKU="${2:-F1}"
cd "$(dirname "$0")"
for REGION in uksouth ukwest northeurope westeurope swedencentral francecentral eastus westus2 centralus; do
  echo
  echo "=== Trying $REGION ($SKU) ==="
  if ./deploy.sh "$APP" "$REGION" "$SKU"; then
    exit 0
  fi
  echo "--- $REGION unavailable, moving on ---"
done
echo
echo "No region had quota for the $SKU tier."
echo "Upgrade the subscription to pay-as-you-go in the portal, then run this again."
exit 1
