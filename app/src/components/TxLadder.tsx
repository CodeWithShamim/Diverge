import type { TxProgress, TxState } from "../lib/types";

const STEPS: TxState[] = ["submitted", "pending", "accepted", "finalized"];

/** §5.5 / FR-7.2 — the full transaction state ladder on every write.
 *  Never a toast — settlement is the product.
 *  submitted ──▶ pending ──▶ accepted ──▶ finalized
 *                                └──▶ soft error → UNRESOLVED · bonds returned */
export function TxLadder({ progress }: { progress: TxProgress }) {
  if (progress.state === "idle") return null;

  const terminal = progress.state === "failed" || progress.state === "soft-error";
  // how far the ladder actually got
  const reached =
    progress.state === "soft-error"
      ? STEPS.indexOf("accepted")
      : progress.state === "failed"
        ? STEPS.indexOf("pending")
        : STEPS.indexOf(progress.state);

  return (
    <div className="tx-ladder" role="status" aria-live="polite">
      {STEPS.map((s, i) => {
        const isLast = s === "finalized";
        // terminal branches replace the finalized step
        if (terminal && isLast) {
          return (
            <span key={s} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <span className="tx-arrow">└──▶</span>
              <span className={progress.state === "failed" ? "tx-step failed" : "tx-step softerr"}>
                {progress.state === "failed" ? "failed" : "soft error"}
              </span>
            </span>
          );
        }
        let cls = "";
        if (terminal) cls = i <= reached ? "done" : "";
        else if (i < reached || progress.state === "finalized") cls = "done";
        else if (i === reached) cls = "active";
        return (
          <span key={s} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            {i > 0 && <span className="tx-arrow">──▶</span>}
            <span className={`tx-step ${cls}`}>{s}</span>
          </span>
        );
      })}
      {progress.hash && (
        <span className="tx-step done" style={{ marginLeft: "auto" }}>
          {progress.hash}
        </span>
      )}
      {progress.detail && <span className="tx-detail">{progress.detail}</span>}
    </div>
  );
}
