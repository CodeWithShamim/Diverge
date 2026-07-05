# Diverge

**Trustless resolution of contested off-chain state — an adversarial oracle on GenLayer.**

Two claims, one truth. An asserter posts a claim + evidence + bond; a challenger
posts the opposing claim + evidence + matching bond; GenLayer's AI-validator
consensus fetches the _pinned_ evidence, judges each declared boolean
sub-question independently, and derives the winner deterministically from the
supports vector. Winner takes the loser's bond; the finalized verdict is
queryable by any contract via `ResolutionLog`.

Built against the [PRD](../Diverge_PRD.md) and
[Design System](../Diverge_Design_System.md).

## Layout

```
contracts/                 # GenLayer Intelligent Contracts (Python, SDK v0.3 namespace)
  dispute_registry.py      #   lifecycle: ASSERTED → CHALLENGED → … → FINAL; snapshot pinning
  diverge.py          #   the non-deterministic core (FR-2): decomposition,
                           #   order normalization, custom leader/validator equivalence
  stake_vault.py           #   bonds, winner-takes-loser, 2% fee, appeal-bond settlement
  resolution_log.py        #   the product surface: get_resolution / is_final
  appeal_manager.py        #   bonded appeals (50%), re-adjudication, finality
  mock_optimistic_oracle.py#   M6 consumer example — settles its own game on a verdict
scripts/deploy.sh          # deploy + wire + schema generation (studionet | bradbury)
tests/
  mocks/genlayer/          # mock of the GenLayer SDK — contracts run under plain pytest
  direct/                  # 89 direct tests (state, money, order-swap, injection, taxonomy)
app/                       # the dApp — React + Vite + genlayer-js + R3F + GSAP + Lenis
```

## The core engineering thesis (PRD §1.4)

Comparative judgment ("is A or B more correct?") converges worse than boolean
judgment and is order-sensitive. The design answers both:

1. **Decomposition** — every dispute is 1–8 boolean sub-questions declared at
   assertion time (neither party frames alone). Winner = deterministic majority
   tally of the per-question `supports` vector (`diverge.tally_winner`).
2. **Order normalization (FR-2.2)** — a swap bit derived from
   `sha256(dispute_id | snapshot_a | snapshot_b)` decides which side is
   presented as neutral "Claim 1"; the mapping back to A/B happens _after_ the
   LLM call. Tested: a deliberately position-biased mock model cannot win
   stably; a content-grounded one is invariant under swap.
3. **Equivalence rule (FR-2.3)** — custom `gl.vm.run_nondet` validator compares
   **only** the winner enum + supports vector in the A/B frame. Never prose,
   never `reason`, never `confidence`.
4. **Pinning (FR-4.1)** — at challenge time each evidence URL is fetched once
   and pinned by content hash (`strict_eq`); adjudication re-fetches and
   verifies the hash, so every validator judges identical input. Non-URL
   evidence is inline and pins to its own hash.
5. **Error taxonomy (FR-4.2)** — every failure is prefix-classified
   (`EXPECTED / EXTERNAL / TRANSIENT / LLM_ERROR`); EXTERNAL/TRANSIENT get a
   24h retry window (max 2), exhaustion resolves neutrally: `UNRESOLVED`, both
   bonds returned, no fee.
6. **Injection defense (FR-2.5 / NFR-3)** — evidence is sandwiched in untrusted
   delimiters, and LLM output crosses the determinism boundary exactly once
   through a whitelist sanitizer (10-variant adversarial set in tests).

## Run the tests

```bash
python3 -m venv .venv && .venv/bin/pip install pytest
.venv/bin/python -m pytest tests/direct -v      # 89 tests, all green
```

Direct tests run the real contract code against `tests/mocks/genlayer` — a
synchronous mini-harness of the SDK (storage, proxies, run_nondet, transfer
ledger) with the LLM/web monkeypatched per test.

## Run the dApp

```bash
cd app && npm install && npm run dev
```

Diverge targets **GenLayer StudioNet** (chain `61999`, `https://studio.genlayer.com/api`)
— the hosted, gasless studio network — and nothing else.

**Wallet connect (Privy).** Set `VITE_PRIVY_APP_ID` (from
[dashboard.privy.io](https://dashboard.privy.io)) in `app/.env.local` to enable
the header's *Connect wallet* button — social login + embedded wallet, or an
external EVM wallet. The connected wallet's EIP-1193 provider is bridged into
`genlayer-js` as the transaction signer; every write is signed by it. Without
an app id the button shows a hint and the rest of the app still runs.

With no contract addresses configured the app runs on a built-in **mock adapter**
(header shows `SIMULATED`) — the full UX is explorable without a deploy: board,
bilateral dispute detail, assert/challenge/appeal flows with the complete tx
state ladder (submitted → pending → accepted → finalized / soft-error), the
sub-question resolution ceremony, and the Divergence verdict scene (R3F, with a
static-SVG reduced-motion fallback that is also the downloadable artifact).

## Deploy (StudioNet)

```bash
cp .env.example .env                 # add PRIVATE_KEY (never committed)
./scripts/deploy.sh studionet        # gasless — no faucet step
# then copy the printed VITE_ADDR_* into app/.env.local, set VITE_MOCK=0,
# and set VITE_PRIVY_APP_ID so writes can be wallet-signed
```

Debug loop: `genlayer receipt <txHash> --stdout --stderr` before touching code.

## Status vs. milestones

| #   | Milestone                                   | Status                                             |
| --- | ------------------------------------------- | -------------------------------------------------- |
| M1  | Core contracts                              | ✅ written, direct tests green                     |
| M2  | Arbiter (order-swap + injection + taxonomy) | ✅ written + tested (mocked)                       |
| M3  | Consensus proof (gltest on StudioNet)       | ⏳ requires `gltest` + network                     |
| M4  | StudioNet deploy                            | ⏳ `scripts/deploy.sh studionet` (gasless)         |
| M5  | dApp per FR-7 + Design System + Privy wallet | ✅ built; runs on mock adapter until M4            |
| M6  | Consumer example                            | ✅ `mock_optimistic_oracle.py` + tests             |
| M7  | Submission                                  | ⏳ portal + demo video                             |

Known items to verify on-network (flagged `# VERIFY:` in code):

- The pinned `py-genlayer` runner hash in each contract's `Depends` header —
  check `genlayer runners list` for the target GenVM.
- `genlayer-js` StudioNet receipt shape in `app/src/lib/writes.ts`, and whether
  the first wallet-signed write needs `client.connect()`; regenerate schemas
  with `genlayer schema` after deploy.
- Privy → `genlayer-js` signer bridge (`app/src/lib/client.ts`): the wallet's
  EIP-1193 provider is passed to `createClient({ provider })`. Confirm StudioNet
  transaction signing succeeds end-to-end with a real connected wallet.
- Cross-contract writes are _emitted messages_ (applied at finality). The
  synchronous test harness compresses that timing; on-network flows are
  asserted by the integration tests (M3).
