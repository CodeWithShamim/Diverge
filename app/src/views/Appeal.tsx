import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getDispute } from "../lib/reads";
import { appeal } from "../lib/writes";
import type { Dispute, TxProgress } from "../lib/types";
import { TxLadder } from "../components/TxLadder";
import { StatusChip } from "../components/StatusChip";
import { TOKEN } from "../config/chain";

/** Appeal flow — FR-5. Bond = 50% of the original; re-adjudication runs a
 *  fresh validator round on the same pinned snapshot. Second verdict is final. */
export function Appeal() {
  const { id } = useParams();
  const nav = useNavigate();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [tx, setTx] = useState<TxProgress>({ state: "idle" });

  useEffect(() => {
    getDispute(Number(id)).then((d) => setDispute(d ?? null));
  }, [id]);

  if (!dispute) return <div className="shell"><p className="t-small" style={{ marginTop: 48 }}>Reading dispute…</p></div>;

  const appealBond = dispute.bond / 2;
  const windowOpen = dispute.appealDeadline * 1000 > Date.now();
  const can = dispute.status === "RESOLVED" && dispute.round < 2 && windowOpen;
  const busy = tx.state !== "idle" && tx.state !== "failed";

  const submit = async () => {
    await appeal(dispute.id, appealBond, setTx);
    setTimeout(() => nav(`/dispute/${dispute.id}`), 900);
  };

  return (
    <div className="shell">
      <div style={{ display: "flex", gap: 16, alignItems: "baseline", margin: "48px 0 8px" }}>
        <h1 className="t-h1">Appeal dispute №{String(dispute.id).padStart(4, "0")}</h1>
        <StatusChip status={dispute.status} winner={dispute.winner} />
      </div>

      <dl className="kv" style={{ maxWidth: 560, margin: "24px 0" }}>
        <dt>current verdict</dt>
        <dd>{dispute.winner}</dd>
        <dt>appeal bond</dt>
        <dd>{appealBond.toFixed(1)} {TOKEN} — 50% of the original bond</dd>
        <dt>window closes</dt>
        <dd>
          {dispute.appealDeadline
            ? new Date(dispute.appealDeadline * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC"
            : "—"}
        </dd>
      </dl>

      <p className="t-small" style={{ maxWidth: 640 }}>
        Re-adjudication runs a fresh leader/validator round on the same pinned
        snapshot. If the verdict flips, your appeal bond returns and the
        counterparty pays it. If it is upheld, your appeal bond is forfeited.
        The second verdict is final — no further appeal.
      </p>

      <div className="actions-bar">
        <button className="btn btn-primary" disabled={!can || busy} onClick={submit}>
          Appeal ({appealBond.toFixed(1)} {TOKEN})
        </button>
        {!windowOpen && <span className="notice">Appeal window closed.</span>}
      </div>
      <TxLadder progress={tx} />
    </div>
  );
}
