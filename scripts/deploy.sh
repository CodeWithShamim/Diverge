#!/usr/bin/env bash
# Deploy the Diverge contract set to GenLayer (M4).
# Wiring order breaks the address cycle: deploy all five, then wire().
#
# Prereqs: `npm i -g genlayer`, funded account (browser faucet for Bradbury),
# PRIVATE_KEY in .env (never committed — NFR-6).
set -euo pipefail
cd "$(dirname "$0")/.."

NETWORK="${1:-studionet}"   # studionet | bradbury
MIN_BOND="${MIN_BOND:-1000000000000000000}"        # 1 GEN in wei
CHALLENGE_WINDOW="${CHALLENGE_WINDOW:-259200}"     # 72h in seconds

echo "== network: $NETWORK"
genlayer network set "$NETWORK"

echo "== deploying DisputeRegistry"
REG=$(genlayer deploy --contract contracts/dispute_registry.py --args "$MIN_BOND" "$CHALLENGE_WINDOW" | tee /dev/stderr | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)
echo "== deploying Diverge"
ARB=$(genlayer deploy --contract contracts/diverge.py | tee /dev/stderr | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)
echo "== deploying StakeVault"
VLT=$(genlayer deploy --contract contracts/stake_vault.py | tee /dev/stderr | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)
echo "== deploying ResolutionLog"
LOG=$(genlayer deploy --contract contracts/resolution_log.py | tee /dev/stderr | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)
echo "== deploying AppealManager"
APL=$(genlayer deploy --contract contracts/appeal_manager.py | tee /dev/stderr | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)

echo "== wiring"
genlayer call "$REG" wire --args "$ARB" "$VLT" "$LOG" "$APL"
genlayer call "$ARB" wire --args "$REG" "$APL"
genlayer call "$VLT" wire --args "$REG" "$APL"
genlayer call "$LOG" wire --args "$REG"
genlayer call "$APL" wire --args "$REG" "$VLT" "$ARB"

echo "== generating schemas (never hand-typed ABIs)"
mkdir -p app/src/config/schemas
for pair in "registry:$REG" "arbiter:$ARB" "vault:$VLT" "log:$LOG" "appeals:$APL"; do
  name="${pair%%:*}"; addr="${pair##*:}"
  genlayer schema "$addr" > "app/src/config/schemas/$name.json"
done

cat <<EOF

Deployed. Put these in app/.env.local:
VITE_MOCK=0
VITE_ADDR_REGISTRY=$REG
VITE_ADDR_ARBITER=$ARB
VITE_ADDR_VAULT=$VLT
VITE_ADDR_LOG=$LOG
VITE_ADDR_APPEALS=$APL
EOF
