import { Link } from "react-router-dom";
import {
  ADDRESSES,
  CHAIN_ID,
  CHAIN_NAME,
  CONTRACTS,
  EXPLORER_BASE,
  MIN_BOND_GEN,
  MOCK_MODE,
  RPC_URL,
  TOKEN,
  explorerAddressUrl,
} from "../config/chain";

/* ------------------------------------------------------------------ *
 * Contract method reference — kept as data so the JSX stays readable.  *
 * access: who may call it. payable methods carry a bond in msg.value.  *
 * ------------------------------------------------------------------ */
type Method = {
  sig: string;
  kind: "write" | "payable" | "view";
  access: string;
  desc: string;
};
type ContractDoc = {
  key: string;
  storage: string;
  methods: Method[];
};

const CONTRACT_DOCS: Record<string, ContractDoc> = {
  registry: {
    key: "registry",
    storage:
      "disputes: TreeMap<id, Dispute>, dispute_count, min_bond, challenge_window_secs, owner + wired contract addresses.",
    methods: [
      {
        sig: "wire(arbiter, vault, log, appeals)",
        kind: "write",
        access: "owner, once",
        desc: "Breaks the deployment address cycle — records the four sibling contracts. Idempotent-guarded by a `wired` flag.",
      },
      {
        sig: "assert_claim(claim, evidence_ref, sub_questions[]) → id",
        kind: "payable",
        access: "anyone",
        desc: "Opens a dispute in ASSERTED. Requires value ≥ min_bond, a non-empty claim/evidence, and 1–8 non-empty sub-questions. Escrows the bond in the vault (side 0). Returns the new dispute id.",
      },
      {
        sig: "challenge(id, counter_claim, evidence_ref)",
        kind: "payable",
        access: "anyone but the asserter",
        desc: "Posts the opposing side with a bond that must exactly equal the asserter's. Pins BOTH evidence refs to content hashes (FR-4.1), sets CHALLENGED, escrows the matching bond (side 1). Rejected after the challenge window.",
      },
      {
        sig: "finalize_uncontested(id)",
        kind: "write",
        access: "anyone",
        desc: "After the challenge window closes with no challenger: sets FINAL / A_WINS / uncontested, releases the bond in full (no fee), records the resolution.",
      },
      {
        sig: "mark_resolving(id)",
        kind: "write",
        access: "arbiter (Diverge)",
        desc: "Arbiter callback moving CHALLENGED/APPEALED → RESOLVING while adjudication runs.",
      },
      {
        sig: "record_verdict(id, winner, round)",
        kind: "write",
        access: "arbiter (Diverge)",
        desc: "Arbiter callback writing the winner. Sets RESOLVED and opens a 24h appeal window (round 1) or marks the verdict final (round ≥ 2).",
      },
      {
        sig: "mark_appealed(id)",
        kind: "write",
        access: "appeals",
        desc: "AppealManager callback moving RESOLVED → APPEALED inside the appeal window.",
      },
      {
        sig: "finalize(id)",
        kind: "write",
        access: "anyone",
        desc: "After the appeal window (or on a round-2 verdict): reads the verdict, computes appeal flip, sets FINAL, tells the vault to settle bonds, and records the resolution to the log.",
      },
      {
        sig: "get_dispute(id) / get_dispute_count() / get_board(offset, limit)",
        kind: "view",
        access: "public",
        desc: "Read the full dispute record, the counter, or a paginated slice (≤ 50) for the board.",
      },
    ],
  },
  arbiter: {
    key: "arbiter",
    storage:
      "verdicts: TreeMap<id, VerdictRec>, retries: TreeMap<id, RetryRec>, registry + appeals addresses.",
    methods: [
      {
        sig: "wire(registry, appeals)",
        kind: "write",
        access: "owner, once",
        desc: "Records the registry it reports verdicts to and the appeal manager allowed to trigger re-adjudication.",
      },
      {
        sig: "resolve(id) → winner",
        kind: "write",
        access: "anyone (dispute must be CHALLENGED)",
        desc: "Round-1 adjudication. Fetches pinned evidence, runs the AI-validator consensus, tallies the winner, stores the VerdictRec, and calls record_verdict on the registry.",
      },
      {
        sig: "readjudicate(id) → winner",
        kind: "write",
        access: "appeals only (dispute must be APPEALED)",
        desc: "Round-2 (appeal) adjudication over the SAME pinned snapshot — fresh consensus, no re-pinning. Second verdict is final.",
      },
      {
        sig: "get_verdict(id)",
        kind: "view",
        access: "public",
        desc: "Winner, supports/answers vectors (A/B frame), per-question reasons (testimony), confidence, round, timestamp.",
      },
      {
        sig: "get_retry_state(id)",
        kind: "view",
        access: "public",
        desc: "attempts, last_error, next_retry_at for a dispute whose adjudication hit an EXTERNAL/TRANSIENT failure.",
      },
    ],
  },
  vault: {
    key: "vault",
    storage:
      "locks: TreeMap<id, Lock> (bond_a, bond_b, appeal_bond, settled), fees_accrued, owner + registry/appeals.",
    methods: [
      {
        sig: "lock(id, side, party)",
        kind: "payable",
        access: "registry",
        desc: "Escrows a bond — side 0 = asserter, side 1 = challenger. Rejects a second lock on the same side.",
      },
      {
        sig: "lock_appeal(id, appellant)",
        kind: "payable",
        access: "appeals",
        desc: "Escrows the 50% appeal bond alongside the two original bonds.",
      },
      {
        sig: "settle(id, winner, appellant, flipped)",
        kind: "write",
        access: "registry",
        desc: "Winner-takes-loser payout minus the 2% fee; UNRESOLVED returns both bonds untouched. Applies the appeal-bond rule (refund + counterparty penalty on a flip, forfeit otherwise). Pays out via emitted transfers.",
      },
      {
        sig: "release_uncontested(id)",
        kind: "write",
        access: "registry",
        desc: "Returns the asserter's bond in full when a dispute was never challenged.",
      },
      {
        sig: "withdraw_fees(to)",
        kind: "write",
        access: "owner",
        desc: "Sweeps accrued protocol fees to an address.",
      },
      {
        sig: "get_lock(id) / get_fees_accrued()",
        kind: "view",
        access: "public",
        desc: "Inspect the escrow record or the accrued fee total.",
      },
    ],
  },
  log: {
    key: "log",
    storage: "resolutions: TreeMap<id, Resolution>, count, owner + registry.",
    methods: [
      {
        sig: "record(id, winner, unresolved, uncontested, supports_vector, snap_a, snap_b, finalized_at)",
        kind: "write",
        access: "registry",
        desc: "Writes the immutable finalized verdict exactly once per dispute.",
      },
      {
        sig: "is_final(id) → bool",
        kind: "view",
        access: "public",
        desc: "The one call a consuming protocol makes first — true iff a verdict is finalized.",
      },
      {
        sig: "get_resolution(id) → dict",
        kind: "view",
        access: "public",
        desc: "The verdict: winner enum, explicit `unresolved` flag, `uncontested` flag, supports vector, both snapshots, timestamp.",
      },
      {
        sig: "get_count()",
        kind: "view",
        access: "public",
        desc: "Total finalized resolutions.",
      },
    ],
  },
  appeals: {
    key: "appeals",
    storage: "appeals: TreeMap<id, Appeal> (appellant, bond, pre_appeal_winner), owner + registry/vault/arbiter.",
    methods: [
      {
        sig: "wire(registry, vault, arbiter)",
        kind: "write",
        access: "owner, once",
        desc: "Records the three contracts it coordinates during an appeal.",
      },
      {
        sig: "appeal(id)",
        kind: "payable",
        access: "a dispute party, in-window",
        desc: "Requires a bond of exactly 50% of the original. Records pre_appeal_winner (for flip detection), escrows the appeal bond, marks the dispute APPEALED, and triggers arbiter.readjudicate.",
      },
      {
        sig: "get_appeal(id) → dict",
        kind: "view",
        access: "public",
        desc: "appellant, bond, pre_appeal_winner, created_at — read by the registry at finalize to settle the appeal bond.",
      },
    ],
  },
};

const KIND_LABEL: Record<Method["kind"], string> = {
  write: "write",
  payable: "payable",
  view: "view",
};

export function Docs() {
  return (
    <div className="shell docs">
      <h1 className="t-h1 view-title">Documentation</h1>
      <p className="t-body docs-lede">
        Diverge is an <strong>adversarial oracle</strong> on GenLayer: it resolves
        contested off-chain facts trustlessly. An asserter posts a claim, evidence,
        and a bond; a challenger posts the opposing claim, evidence, and a matching
        bond. GenLayer&rsquo;s AI-validator consensus fetches the <em>pinned</em>{" "}
        evidence, judges each declared boolean sub-question independently, and derives
        the winner deterministically from the resulting support vector. The winner
        takes the loser&rsquo;s bond (minus a 2% fee); the finalized verdict is
        queryable by any contract through <span className="t-data">ResolutionLog</span>.
      </p>

      <nav className="docs-toc" aria-label="On this page">
        <a href="#architecture">Architecture</a>
        <a href="#lifecycle">Lifecycle</a>
        <a href="#adjudication">Adjudication</a>
        <a href="#pillars">Design pillars</a>
        <a href="#money">Money &amp; settlement</a>
        <a href="#errors">Errors &amp; retries</a>
        <a href="#appeals">Appeals</a>
        <a href="#reference">Contract reference</a>
        <a href="#consume">Consume a verdict</a>
        <a href="#network">Network</a>
      </nav>

      {/* ---- architecture ---- */}
      <section id="architecture">
        <div className="seam-rule">
          <span className="t-label">ARCHITECTURE</span>
        </div>
        <p className="t-small docs-para">
          Five Intelligent Contracts (GenLayer, Python, GenVM v0.2.16) with a strict
          separation of concerns. Only <span className="t-data">Diverge</span> is
          non-deterministic; everything downstream of the LLM call is pure. Contracts
          call each other through typed interfaces, and cross-contract writes are{" "}
          <em>emitted messages</em> applied at finality — the deploy script wires the
          address graph once (each <span className="t-data">wire()</span> is
          owner-only and single-shot).
        </p>
        <ul className="docs-flow">
          <li>
            <span className="docs-flow-name">DisputeRegistry</span> owns the lifecycle
            &amp; state machine; every transition passes through it.
          </li>
          <li>
            <span className="docs-flow-name">Diverge</span> (the arbiter) runs the
            consensus adjudication and reports a verdict back to the registry.
          </li>
          <li>
            <span className="docs-flow-name">StakeVault</span> escrows every bond and
            performs the winner-takes-loser settlement on the registry&rsquo;s command.
          </li>
          <li>
            <span className="docs-flow-name">AppealManager</span> takes a bonded
            appeal and re-triggers Diverge for a final round.
          </li>
          <li>
            <span className="docs-flow-name">ResolutionLog</span> is the public,
            read-only surface consuming protocols query.
          </li>
        </ul>
      </section>

      {/* ---- lifecycle ---- */}
      <section id="lifecycle">
        <div className="seam-rule">
          <span className="t-label">DISPUTE LIFECYCLE</span>
        </div>
        <p className="docs-statemap t-data">
          ASSERTED → CHALLENGED → RESOLVING → RESOLVED → (APPEALED → RESOLVING →
          RESOLVED) → FINAL
        </p>
        <ol className="docs-steps">
          <li>
            <strong>Assert.</strong> The asserter calls{" "}
            <span className="t-data">assert_claim</span> with a claim, an evidence
            reference, and 1&ndash;8 boolean sub-questions, bonded with at least{" "}
            {MIN_BOND_GEN} {TOKEN}. State → <span className="t-data">ASSERTED</span>,
            and a challenge window opens.
          </li>
          <li>
            <strong>Challenge.</strong> Anyone but the asserter calls{" "}
            <span className="t-data">challenge</span> with the opposing claim, its
            evidence, and an <em>exactly equal</em> bond. Both evidence refs are
            fetched once and pinned by content hash. State →{" "}
            <span className="t-data">CHALLENGED</span>. If the window closes with no
            challenger, <span className="t-data">finalize_uncontested</span> stands the
            assertion as A_WINS with the bond returned.
          </li>
          <li>
            <strong>Resolve.</strong> Anyone calls{" "}
            <span className="t-data">Diverge.resolve</span>. Validators re-fetch the
            pinned evidence, judge each sub-question, and a custom equivalence rule
            accepts on the winner + support vector only. State →{" "}
            <span className="t-data">RESOLVING</span> then{" "}
            <span className="t-data">RESOLVED</span> with{" "}
            <span className="t-data">A_WINS / B_WINS / UNRESOLVED</span>.
          </li>
          <li>
            <strong>Appeal (optional).</strong> Within 24h either party may call{" "}
            <span className="t-data">appeal</span> with a bond of 50% of the original,
            forcing one re-adjudication round over the same snapshot. State →{" "}
            <span className="t-data">APPEALED</span>. The second verdict is final.
          </li>
          <li>
            <strong>Finalize.</strong> After the appeal window (or immediately on a
            round-2 verdict) anyone calls <span className="t-data">finalize</span>:
            bonds settle, the resolution is recorded, and state →{" "}
            <span className="t-data">FINAL</span>.
          </li>
        </ol>
      </section>

      {/* ---- adjudication ---- */}
      <section id="adjudication">
        <div className="seam-rule">
          <span className="t-label">HOW ADJUDICATION WORKS</span>
        </div>
        <p className="t-small docs-para">
          Inside <span className="t-data">Diverge.resolve</span>, a{" "}
          <span className="t-data">judge()</span> closure runs on the leader and,
          independently, on every validator. Each node:
        </p>
        <ol className="docs-steps">
          <li>
            <strong>Re-fetches</strong> both evidence refs and verifies each still
            hashes to its pinned snapshot — otherwise it raises an EXTERNAL error.
          </li>
          <li>
            <strong>Normalizes order.</strong> A swap bit derived from{" "}
            <span className="t-data">sha256(id | snap_a | snap_b)</span> decides which
            side is shown to the model as neutral &ldquo;Claim 1&rdquo; vs
            &ldquo;Claim 2&rdquo;. The model never learns who asserted first.
          </li>
          <li>
            <strong>Prompts</strong> the model with evidence sandwiched between
            untrusted-data delimiters and asks for a strict JSON object: one{" "}
            <span className="t-data">supports</span> label
            (CLAIM_1 / CLAIM_2 / NEITHER) per sub-question, plus a one-line reason and
            a confidence.
          </li>
          <li>
            <strong>Sanitizes</strong> the output through a whitelist — the single
            point where LLM output crosses the determinism boundary. Anything
            off-whitelist is an LLM_ERROR.
          </li>
        </ol>
        <p className="t-small docs-para">
          The <strong>validator rule</strong> maps the leader&rsquo;s support labels
          back to the A/B frame and its own, and accepts iff the two A/B vectors are
          identical <em>and</em> tally to the same winner. Prose, reasons, and
          confidence are testimony — never compared. Once consensus is reached, the
          winner is a pure majority tally of the support vector (tie or all-NEITHER →
          UNRESOLVED), stored as a <span className="t-data">VerdictRec</span>, and
          reported to the registry.
        </p>
      </section>

      {/* ---- pillars ---- */}
      <section id="pillars">
        <div className="seam-rule">
          <span className="t-label">DESIGN PILLARS</span>
        </div>
        <dl className="docs-pillars">
          <div>
            <dt>Decomposition (FR-2.1)</dt>
            <dd>
              Comparative &ldquo;is A or B more correct?&rdquo; converges worse than
              boolean judgment. Every dispute is instead 1&ndash;8 independent boolean
              sub-questions declared at assertion time — neither party frames alone —
              and the winner is a deterministic majority tally.
            </dd>
          </div>
          <div>
            <dt>Order normalization (FR-2.2)</dt>
            <dd>
              A swap bit from <span className="t-data">sha256(id | snap_a | snap_b)</span>{" "}
              chooses presentation order; the mapping back to A/B happens after the LLM
              call. A position-biased model can&rsquo;t win stably; a content-grounded
              one is invariant under swap.
            </dd>
          </div>
          <div>
            <dt>Equivalence rule (FR-2.3)</dt>
            <dd>
              The custom <span className="t-data">run_nondet</span> validator compares
              only the winner enum + boolean support vector in the A/B frame. Never
              prose, never <span className="t-data">reason</span>, never{" "}
              <span className="t-data">confidence</span>.
            </dd>
          </div>
          <div>
            <dt>Evidence pinning (FR-4.1)</dt>
            <dd>
              At challenge time each evidence URL is fetched once and pinned by content
              hash (<span className="t-data">strict_eq</span>); adjudication re-fetches
              and verifies the hash, so every validator judges byte-identical input.
              Non-URL evidence is inline and pins to its own hash.
            </dd>
          </div>
          <div>
            <dt>Error taxonomy (FR-4.2)</dt>
            <dd>
              Every failure is prefix-classified{" "}
              <span className="t-data">EXPECTED / EXTERNAL / TRANSIENT / LLM_ERROR</span>.
              External/transient failures get a 24h retry window (max 2); exhaustion
              resolves neutrally as UNRESOLVED with both bonds returned and no fee.
            </dd>
          </div>
          <div>
            <dt>Injection defense (FR-2.5 / NFR-3)</dt>
            <dd>
              Evidence is sandwiched in untrusted-data delimiters with an explicit
              security instruction, and LLM output crosses the determinism boundary
              exactly once through a whitelist sanitizer (tested against a 10-variant
              adversarial set).
            </dd>
          </div>
        </dl>
      </section>

      {/* ---- money ---- */}
      <section id="money">
        <div className="seam-rule">
          <span className="t-label">MONEY &amp; SETTLEMENT</span>
        </div>
        <p className="t-small docs-para">
          All bond math is <span className="t-data">u256</span> integer arithmetic.
          The bond floor is {MIN_BOND_GEN} {TOKEN}; the challenger&rsquo;s bond must
          exactly equal the asserter&rsquo;s. Settlement runs in{" "}
          <span className="t-data">StakeVault.settle</span>:
        </p>
        <ul className="docs-money">
          <li>
            <strong>A_WINS / B_WINS.</strong> Winner receives{" "}
            <span className="t-data">bond_a + bond_b − fee</span>, where{" "}
            <span className="t-data">fee = loser_bond × 2%</span> accrues to the
            protocol.
          </li>
          <li>
            <strong>UNRESOLVED.</strong> Both bonds returned in full, no fee.
          </li>
          <li>
            <strong>Uncontested.</strong> The asserter&rsquo;s bond is returned in full
            via <span className="t-data">release_uncontested</span>, no fee.
          </li>
          <li>
            <strong>Appeal bond (50%).</strong> If the appeal <em>flips</em> the
            verdict, the appellant is refunded and an equal amount is taken from the
            counterparty&rsquo;s payout; if the verdict is <em>upheld</em>, the appeal
            bond is forfeited to the counterparty.
          </li>
        </ul>
      </section>

      {/* ---- errors ---- */}
      <section id="errors">
        <div className="seam-rule">
          <span className="t-label">ERRORS &amp; RETRIES</span>
        </div>
        <dl className="docs-pillars">
          <div>
            <dt>EXPECTED</dt>
            <dd>Validation / permission failures — surfaced immediately, no retry.</dd>
          </div>
          <div>
            <dt>EXTERNAL</dt>
            <dd>
              Evidence unreachable or changed since pinning — retryable within the 24h
              window.
            </dd>
          </div>
          <div>
            <dt>TRANSIENT</dt>
            <dd>Fetch statuses 408/429/502/503/504 — retryable.</dd>
          </div>
          <div>
            <dt>LLM_ERROR</dt>
            <dd>
              Malformed or off-whitelist model output (also the default for any
              unprefixed error) — retryable.
            </dd>
          </div>
        </dl>
        <p className="t-small docs-para">
          Retryable failures record a <span className="t-data">RetryRec</span> and
          schedule the next attempt. After <span className="t-data">MAX_RETRIES = 2</span>{" "}
          the dispute resolves neutrally as UNRESOLVED — bonds returned, no fee — so a
          flaky source can never trap the bonds.
        </p>
      </section>

      {/* ---- appeals ---- */}
      <section id="appeals">
        <div className="seam-rule">
          <span className="t-label">APPEALS</span>
        </div>
        <p className="t-small docs-para">
          Within 24h of the first verdict, either dispute party may post an appeal bond
          equal to 50% of the original bond. The appeal is re-adjudicated{" "}
          <em>once</em>, over the same pinned snapshot (no re-pinning), producing a
          round-2 verdict that is final. The appeal-bond outcome depends on whether the
          winner flipped (see Money &amp; settlement). A dispute can be appealed at most
          once.
        </p>
      </section>

      {/* ---- contract reference ---- */}
      <section id="reference">
        <div className="seam-rule">
          <span className="t-label">CONTRACT REFERENCE</span>
        </div>
        {MOCK_MODE && (
          <p className="notice unresolved-notice docs-para">
            The app is on the mock adapter — addresses below are unset until you
            configure <span className="t-data">app/.env.local</span>.
          </p>
        )}
        {CONTRACTS.map((c) => {
          const doc = CONTRACT_DOCS[c.key];
          const addr = ADDRESSES[c.key];
          return (
            <div key={c.key} className="docs-contract-block">
              <div className="docs-contract-header">
                <div>
                  <span className="docs-contract-name">{c.name}</span>{" "}
                  <span className="t-data docs-contract-src">{c.source}</span>
                </div>
                {addr ? (
                  <a
                    className="docs-contract-addr"
                    href={explorerAddressUrl(addr)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {addr} ↗
                  </a>
                ) : (
                  <span className="docs-contract-addr is-unset">not deployed</span>
                )}
              </div>
              <p className="docs-contract-role">{c.role}</p>
              {doc && (
                <>
                  <p className="docs-storage">
                    <span className="t-label">Storage</span> {doc.storage}
                  </p>
                  <div className="docs-methods">
                    {doc.methods.map((m) => (
                      <div key={m.sig} className="docs-method">
                        <div className="docs-method-top">
                          <code className="docs-method-sig t-data">{m.sig}</code>
                          <span className={`docs-kind kind-${m.kind}`}>
                            {KIND_LABEL[m.kind]}
                          </span>
                          <span className="docs-method-access">{m.access}</span>
                        </div>
                        <p className="docs-method-desc">{m.desc}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </section>

      {/* ---- consume ---- */}
      <section id="consume">
        <div className="seam-rule">
          <span className="t-label">CONSUME A VERDICT</span>
        </div>
        <p className="t-small docs-para">
          Any contract reads a finalized verdict from{" "}
          <span className="t-data">ResolutionLog</span> in a single view call — no
          wallet, no bond. Check <span className="t-data">is_final</span> first, then
          read <span className="t-data">get_resolution</span>; the{" "}
          <span className="t-data">unresolved</span> flag is explicit so a neutral
          outcome is never mistaken for a verdict. See{" "}
          <span className="t-data">mock_optimistic_oracle.py</span> for a full consumer
          or the <Link to="/explorer">resolution explorer</Link> to query by id.
        </p>
        <div className="well docs-code">
          <pre className="explorer-result" style={{ padding: 16, overflowX: "auto" }}>
            <code className="t-data">{`log = gl.contract.get_at(Address("${
              ADDRESSES.log || "0x…ResolutionLog"
            }"))
if log.view().is_final(dispute_id):
    r = log.view().get_resolution(dispute_id)
    # r["winner"]: "A_WINS" | "B_WINS" | "UNRESOLVED"
    # r["unresolved"] is explicit — never mistake it for a verdict
    # r["supports_vector"], r["snapshot_a"], r["snapshot_b"], r["finalized_at"]
else:
    # not final yet — fall back to your own timeout`}</code>
          </pre>
        </div>
      </section>

      {/* ---- network ---- */}
      <section id="network">
        <div className="seam-rule">
          <span className="t-label">NETWORK</span>
        </div>
        <dl className="kv docs-network">
          <dt>Chain</dt>
          <dd>
            {CHAIN_NAME} · {CHAIN_ID}
          </dd>
          <dt>RPC</dt>
          <dd>{RPC_URL}</dd>
          <dt>Explorer</dt>
          <dd>
            <a href={EXPLORER_BASE} target="_blank" rel="noreferrer">
              {EXPLORER_BASE} ↗
            </a>
          </dd>
          <dt>Native token</dt>
          <dd>{TOKEN}</dd>
          <dt>Min bond</dt>
          <dd>
            {MIN_BOND_GEN} {TOKEN}
          </dd>
          <dt>Protocol fee</dt>
          <dd>2% of the loser&rsquo;s bond</dd>
          <dt>Appeal bond</dt>
          <dd>50% of the original bond</dd>
          <dt>Windows</dt>
          <dd>challenge (configurable) · appeal 24h · retry 24h (max 2)</dd>
        </dl>
      </section>
    </div>
  );
}
