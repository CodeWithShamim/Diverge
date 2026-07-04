import type { Dispute } from "../lib/types";

/** §5.3 — the core bilateral unit. Side A and Side B are identical geometry;
 *  only the side identity (label color) differs. At verdict the winner
 *  brightens to --wins, the loser dims to --closed. */
export function ClaimPanel({
  dispute,
  side,
}: {
  dispute: Dispute;
  side: "A" | "B";
}) {
  const isA = side === "A";
  const claim = isA ? dispute.claimA : dispute.claimB;
  const party = isA ? dispute.asserter : dispute.challenger;
  const evidenceRef = isA ? dispute.evidenceRefA : dispute.evidenceRefB;
  const snapshot = isA ? dispute.snapshotA : dispute.snapshotB;

  const decided = dispute.winner === "A_WINS" || dispute.winner === "B_WINS";
  const won = decided && dispute.winner === (isA ? "A_WINS" : "B_WINS");
  const lost = decided && !won;

  if (!claim) {
    return (
      <section className="panel claim-panel" aria-label={`Side ${side} — unchallenged`}>
        <div className={`cp-label t-label cp-label-${side.toLowerCase()}`}>SIDE {side}</div>
        <p className="t-small">
          No counter-claim yet. Challenge to open the fork — match the bond of{" "}
          <span className="t-data">{dispute.bond.toFixed(1)} GEN</span>.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`panel claim-panel ${won ? "is-winner" : ""} ${lost ? "is-closed" : ""}`}
      aria-label={`Side ${side} claim`}
    >
      <div className={`cp-label t-label cp-label-${side.toLowerCase()}`}>SIDE {side}</div>
      <p className="cp-claim">“{claim}”</p>
      <dl className="cp-rows">
        <div className="cp-row">
          <dt>{isA ? "asserter" : "challenger"}</dt>
          <dd aria-label={`${isA ? "asserter" : "challenger"} address ${party}`}>{party}</dd>
        </div>
        <div className="cp-row">
          <dt>bond</dt>
          <dd>{dispute.bond.toFixed(1)} GEN</dd>
        </div>
        <div className="cp-row">
          <dt>evidence</dt>
          <dd>
            {evidenceRef}
            {snapshot && <span className="pinned-badge">pinned</span>}
          </dd>
        </div>
        {snapshot && (
          <div className="cp-row">
            <dt>snapshot</dt>
            <dd aria-label={`pinned snapshot ${snapshot}`}>{snapshot}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
