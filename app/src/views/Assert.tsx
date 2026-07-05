import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MIN_BOND_GEN, TOKEN } from "../config/chain";
import { assertClaim } from "../lib/writes";
import { TxLadder } from "../components/TxLadder";
import { AuroraBackdrop } from "../components/AuroraBackdrop";
import type { TxProgress } from "../lib/types";

/** Assert flow — FR-1.1/1.2. Sub-questions are declared here so both sides
 *  dispute the same decomposition; neither party frames the questions alone. */
export function Assert() {
  const nav = useNavigate();
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [bond, setBond] = useState(MIN_BOND_GEN);
  const [subs, setSubs] = useState<string[]>(["", ""]);
  const [tx, setTx] = useState<TxProgress>({ state: "idle" });

  const validSubs = subs.map((s) => s.trim()).filter(Boolean);
  const valid =
    claim.trim() && evidence.trim() && validSubs.length >= 1 && validSubs.length <= 8 && bond >= MIN_BOND_GEN;
  const busy = tx.state !== "idle" && tx.state !== "failed";

  const submit = async () => {
    if (!valid) return;
    const id = await assertClaim(claim.trim(), evidence.trim(), validSubs, bond, setTx);
    if (typeof id === "number") setTimeout(() => nav(`/dispute/${id}`), 900);
  };

  return (
    <div className="view-stage">
      <AuroraBackdrop variant="assert" />
      <div className="shell">
      <h1 className="t-h1 view-title">Assert a claim</h1>
      <p className="t-small" style={{ maxWidth: 640 }}>
        Posting opens a challenge window. If unchallenged, the assertion stands
        by default and your bond returns. If challenged, GenLayer validators
        judge each sub-question against pinned evidence from both sides.
      </p>

      <div className="form-grid" style={{ marginTop: 32 }}>
        <div>
          <label className="t-label" htmlFor="claim">CLAIM</label>
          <textarea
            id="claim"
            className="claim-input"
            rows={2}
            placeholder="The market settled above $2,400 at expiry."
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
          />
        </div>

        <div>
          <label className="t-label" htmlFor="evidence">EVIDENCE REFERENCE</label>
          <input
            id="evidence"
            type="text"
            className="mono-input"
            placeholder="https://… (pinned to a content snapshot at challenge time)"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
          <p className="field-hint">
            A URL is pinned by content hash; anything else is stored as inline
            evidence and pinned as-is.
          </p>
        </div>

        <div>
          <span className="t-label">SUB-QUESTIONS · 1–8 BOOLEAN, INDEPENDENTLY ANSWERABLE</span>
          {subs.map((s, i) => (
            <div className="subq-row" key={i} style={{ marginTop: 8 }}>
              <span className="t-data" style={{ color: "var(--read-faint)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <input
                type="text"
                placeholder="Did the event occur before block N?"
                value={s}
                onChange={(e) => setSubs(subs.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <button
                className="subq-remove"
                aria-label={`Remove sub-question ${i + 1}`}
                onClick={() => setSubs(subs.filter((_, j) => j !== i))}
                disabled={subs.length <= 1}
              >
                ×
              </button>
            </div>
          ))}
          {subs.length < 8 && (
            <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => setSubs([...subs, ""])}>
              Add sub-question
            </button>
          )}
          <p className="field-hint">
            Declared at assertion time — both sides dispute the same
            decomposition. The verdict is derived deterministically from the
            per-question supports vector.
          </p>
        </div>

        <div style={{ maxWidth: 220 }}>
          <label className="t-label" htmlFor="bond">BOND · {TOKEN}</label>
          <input
            id="bond"
            type="text"
            className="mono-input"
            inputMode="decimal"
            value={String(bond)}
            onChange={(e) => setBond(Number(e.target.value) || 0)}
          />
          <p className="field-hint">Minimum {MIN_BOND_GEN.toFixed(1)} {TOKEN}. A challenger must match it exactly.</p>
        </div>

        <div className="actions-bar">
          <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            Assert claim · stake {bond ? bond.toFixed(1) : "—"} {TOKEN}
          </button>
        </div>
        <TxLadder progress={tx} />
      </div>
      </div>
    </div>
  );
}
