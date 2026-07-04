import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDispute } from "../lib/reads";
import { challenge } from "../lib/writes";
import type { Dispute, TxProgress } from "../lib/types";
import { TxLadder } from "../components/TxLadder";
import { TOKEN } from "../config/chain";

/** Challenge flow — FR-1.3/1.4. Matching bond converts the assertion into a
 *  contested dispute; both evidence refs are pinned at this moment. */
export function Challenge() {
  const { id } = useParams();
  const nav = useNavigate();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [counterClaim, setCounterClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [tx, setTx] = useState<TxProgress>({ state: "idle" });

  useEffect(() => {
    getDispute(Number(id)).then((d) => setDispute(d ?? null));
  }, [id]);

  if (!dispute) return <div className="shell"><p className="t-small" style={{ marginTop: 48 }}>Reading dispute…</p></div>;

  const valid = counterClaim.trim() && evidence.trim() && dispute.status === "ASSERTED";
  const busy = tx.state !== "idle" && tx.state !== "failed";

  const submit = async () => {
    if (!valid) return;
    await challenge(dispute.id, counterClaim.trim(), evidence.trim(), dispute.bond, setTx);
    setTimeout(() => nav(`/dispute/${dispute.id}`), 900);
  };

  return (
    <div className="shell">
      <h1 className="t-h1 view-title">Challenge dispute №{String(dispute.id).padStart(4, "0")}</h1>
      <p className="t-claim" style={{ color: "var(--claim-a)", maxWidth: 640 }}>
        “{dispute.claimA}”
      </p>
      <p className="t-small" style={{ maxWidth: 640 }}>
        Your counter-claim opens the fork. Both evidence references are pinned
        to fixed snapshots the moment you challenge — every validator judges
        identical input. Sub-questions were declared at assertion:
      </p>
      <ul style={{ margin: "8px 0 0 24px" }}>
        {dispute.subQuestions.map((q, i) => (
          <li key={i} className="t-small">{q}</li>
        ))}
      </ul>

      <div className="form-grid" style={{ marginTop: 32 }}>
        <div>
          <label className="t-label" htmlFor="cclaim">COUNTER-CLAIM · SIDE B</label>
          <textarea
            id="cclaim"
            className="claim-input"
            rows={2}
            placeholder="The market settled below $2,400 at expiry."
            value={counterClaim}
            onChange={(e) => setCounterClaim(e.target.value)}
          />
        </div>
        <div>
          <label className="t-label" htmlFor="cev">EVIDENCE REFERENCE</label>
          <input
            id="cev"
            type="text"
            className="mono-input"
            placeholder="https://…"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
          />
        </div>
        <div className="actions-bar">
          <button className="btn btn-primary" disabled={!valid || busy} onClick={submit}>
            Challenge · match {dispute.bond.toFixed(1)} {TOKEN}
          </button>
        </div>
        <TxLadder progress={tx} />
      </div>
    </div>
  );
}
