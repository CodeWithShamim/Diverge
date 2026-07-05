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

/** Docs — the protocol reference: what Diverge is, the six design pillars, the
 *  dispute lifecycle, the deployed contracts (linked to the explorer), and how a
 *  consuming contract reads a verdict. Read-only; no wallet prompts (§5.7). */
export function Docs() {
  return (
    <div className="shell docs">
      <h1 className="t-h1 view-title">Documentation</h1>
      <p className="t-body" style={{ maxWidth: 680, color: "var(--read-muted)" }}>
        Diverge resolves contested off-chain state trustlessly. An asserter posts
        a claim + evidence + bond; a challenger posts the opposing claim +
        evidence + matching bond; GenLayer&rsquo;s AI-validator consensus fetches
        the <em>pinned</em> evidence, judges each declared boolean sub-question
        independently, and derives the winner deterministically. Winner takes the
        loser&rsquo;s bond; the finalized verdict is queryable by any contract via{" "}
        <span className="t-data">ResolutionLog</span>.
      </p>

      {/* ---- on this page ---- */}
      <nav className="docs-toc" aria-label="On this page">
        <a href="#contracts">Contracts</a>
        <a href="#lifecycle">Lifecycle</a>
        <a href="#pillars">Design pillars</a>
        <a href="#consume">Consume a verdict</a>
        <a href="#network">Network</a>
      </nav>

      {/* ---- contracts ---- */}
      <div className="seam-rule" id="contracts">
        <span className="t-label">CONTRACTS</span>
      </div>
      <p className="t-small" style={{ maxWidth: 680, marginBottom: "var(--s-4)" }}>
        Five Intelligent Contracts (GenLayer, Python) deployed on {CHAIN_NAME}.
        Each links to the{" "}
        <a href={EXPLORER_BASE} target="_blank" rel="noreferrer">
          GenLayer Studio explorer ↗
        </a>
        .
      </p>

      {MOCK_MODE && (
        <p className="notice unresolved-notice" style={{ marginBottom: "var(--s-4)" }}>
          The app is on the mock adapter — addresses below are unset until you
          configure <span className="t-data">app/.env.local</span>.
        </p>
      )}

      <div className="docs-contract-grid">
        {CONTRACTS.map((c) => {
          const addr = ADDRESSES[c.key];
          return (
            <div key={c.key} className="panel docs-contract">
              <div className="docs-contract-top">
                <span className="docs-contract-name">{c.name}</span>
                <span className="t-data docs-contract-src">{c.source}</span>
              </div>
              <p className="docs-contract-role">{c.role}</p>
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
          );
        })}
      </div>

      {/* ---- lifecycle ---- */}
      <div className="seam-rule" id="lifecycle">
        <span className="t-label">DISPUTE LIFECYCLE</span>
      </div>
      <ol className="docs-steps">
        <li>
          <strong>Assert.</strong> An asserter posts a claim, an evidence
          reference, and 1&ndash;8 boolean sub-questions, bonded with at least{" "}
          {MIN_BOND_GEN} {TOKEN}. State → <span className="t-data">ASSERTED</span>.
        </li>
        <li>
          <strong>Challenge.</strong> A challenger posts the opposing claim +
          evidence with a matching bond. Each evidence URL is fetched once and
          pinned by content hash. State → <span className="t-data">CHALLENGED</span>.
        </li>
        <li>
          <strong>Resolve.</strong> Anyone triggers adjudication. GenLayer&rsquo;s
          validators re-fetch the pinned evidence, judge each sub-question, and a
          custom equivalence rule compares only the winner enum + supports
          vector. State → <span className="t-data">A_WINS / B_WINS / UNRESOLVED</span>.
        </li>
        <li>
          <strong>Appeal (optional).</strong> Either party can post a 50% appeal
          bond to force re-adjudication. State → <span className="t-data">APPEALED</span>.
        </li>
        <li>
          <strong>Finalize.</strong> The verdict is recorded to{" "}
          <span className="t-data">ResolutionLog</span>; the winner takes the
          loser&rsquo;s bond (2% fee), or on <span className="t-data">UNRESOLVED</span>{" "}
          both bonds are returned. State → <span className="t-data">FINAL</span>.
        </li>
      </ol>

      {/* ---- pillars ---- */}
      <div className="seam-rule" id="pillars">
        <span className="t-label">DESIGN PILLARS</span>
      </div>
      <dl className="docs-pillars">
        <div>
          <dt>Decomposition</dt>
          <dd>
            Every dispute is 1&ndash;8 boolean sub-questions declared at assertion
            time. Winner = deterministic majority tally of the per-question{" "}
            <span className="t-data">supports</span> vector.
          </dd>
        </div>
        <div>
          <dt>Order normalization (FR-2.2)</dt>
          <dd>
            A swap bit from <span className="t-data">sha256(id | snap_a | snap_b)</span>{" "}
            decides which side is shown as neutral &ldquo;Claim 1&rdquo;; the
            mapping back to A/B happens after the LLM call, so position can&rsquo;t
            decide the winner.
          </dd>
        </div>
        <div>
          <dt>Equivalence rule (FR-2.3)</dt>
          <dd>
            The custom validator compares only the winner enum + supports vector.
            Never prose, never <span className="t-data">reason</span>, never{" "}
            <span className="t-data">confidence</span>.
          </dd>
        </div>
        <div>
          <dt>Evidence pinning (FR-4.1)</dt>
          <dd>
            Each evidence URL is fetched once and pinned by content hash;
            adjudication re-fetches and verifies, so every validator judges
            identical input.
          </dd>
        </div>
        <div>
          <dt>Error taxonomy (FR-4.2)</dt>
          <dd>
            Failures are prefix-classified (EXPECTED / EXTERNAL / TRANSIENT /
            LLM_ERROR); external/transient get a 24h retry window (max 2), and
            exhaustion resolves neutrally as UNRESOLVED with bonds returned.
          </dd>
        </div>
        <div>
          <dt>Injection defense (FR-2.5 / NFR-3)</dt>
          <dd>
            Evidence is sandwiched in untrusted delimiters, and LLM output crosses
            the determinism boundary exactly once through a whitelist sanitizer.
          </dd>
        </div>
      </dl>

      {/* ---- consume ---- */}
      <div className="seam-rule" id="consume">
        <span className="t-label">CONSUME A VERDICT</span>
      </div>
      <p className="t-small" style={{ maxWidth: 680 }}>
        Any contract reads a finalized verdict from{" "}
        <span className="t-data">ResolutionLog</span> in a single view call — no
        wallet, no bond. See{" "}
        <span className="t-data">mock_optimistic_oracle.py</span> for a full
        consumer, or the{" "}
        <Link to="/explorer">resolution explorer</Link> to query by id.
      </p>
      <div className="well" style={{ maxWidth: 720, marginTop: "var(--s-3)" }}>
        <pre className="explorer-result" style={{ padding: 16, overflowX: "auto" }}>
          <code className="t-data">{`log = gl.contract.get_at(Address("${
            ADDRESSES.log || "0x…ResolutionLog"
          }"))
if log.view().is_final(dispute_id):
    r = log.view().get_resolution(dispute_id)
    # r["winner"]: "A_WINS" | "B_WINS" | "UNRESOLVED"
    # r["unresolved"] is explicit — never mistake it for a verdict`}</code>
        </pre>
      </div>

      {/* ---- network ---- */}
      <div className="seam-rule" id="network">
        <span className="t-label">NETWORK</span>
      </div>
      <dl className="kv" style={{ maxWidth: 720 }}>
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
      </dl>
    </div>
  );
}
