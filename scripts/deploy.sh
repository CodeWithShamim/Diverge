#!/usr/bin/env bash
# Deploy the Diverge contract set to GenLayer StudioNet (gasless studio network).
# Wiring order breaks the address cycle: deploy all five, then wire().
#
# Prereqs: `npm i -g genlayer`, PRIVATE_KEY in .env (never committed — NFR-6).
# StudioNet is gasless, so no faucet step is needed.
set -euo pipefail
cd "$(dirname "$0")/.."

# Export PRIVATE_KEY (and other vars) from .env for the genlayer CLI — matches
# the documented prereq above. The CLI otherwise signs with the active keystore
# account (see `genlayer account`); .env just makes the deployer explicit.
[ -f .env ] && { set -a; . ./.env; set +a; }

NETWORK="${1:-studionet}"   # StudioNet only
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
# wire() is @gl.public.write — it MUST be sent as a state-changing transaction.
# `genlayer call` only simulates (no state change), so wiring would never persist.
genlayer write "$REG" wire --args "$ARB" "$VLT" "$LOG" "$APL"
genlayer write "$ARB" wire --args "$REG" "$APL"
genlayer write "$VLT" wire --args "$REG" "$APL"
genlayer write "$LOG" wire --args "$REG"
genlayer write "$APL" wire --args "$REG" "$VLT" "$ARB"

echo "== generating schemas (never hand-typed ABIs)"
# `genlayer schema` pretty-prints a JS object (single quotes, bare keys), which
# is not valid JSON — fetch the schema over RPC instead.
RPC_URL="https://studio.genlayer.com/api"
mkdir -p app/src/config/schemas
for pair in "registry:$REG" "arbiter:$ARB" "vault:$VLT" "log:$LOG" "appeals:$APL"; do
  name="${pair%%:*}"; addr="${pair##*:}"
  curl -s -X POST "$RPC_URL" -H 'Content-Type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"gen_getContractSchema\",\"params\":[\"$addr\"]}" \
    | python3 -c 'import sys, json; json.dump(json.load(sys.stdin)["result"], sys.stdout, indent=2); print()' \
    > "app/src/config/schemas/$name.json"
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
