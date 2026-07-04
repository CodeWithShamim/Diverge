import { Link } from "react-router-dom";
import type { Dispute } from "../lib/types";
import { StatusChip } from "./StatusChip";

/** §5.1 — board entry. The hairline fork glyph between the truncated claims
 *  telegraphs the metaphor at a glance. */
export function DisputeCard({ dispute }: { dispute: Dispute }) {
  const pooled = dispute.claimB ? dispute.bond * 2 : dispute.bond;
  const deadline =
    dispute.status === "ASSERTED"
      ? `window closes ${new Date(dispute.challengeDeadline * 1000).toISOString().slice(0, 10)}`
      : dispute.status === "RESOLVED" && dispute.appealDeadline > 0
        ? `appeal window closes ${new Date(dispute.appealDeadline * 1000).toISOString().slice(0, 10)}`
        : `opened ${new Date(dispute.createdAt * 1000).toISOString().slice(0, 10)}`;

  return (
    <Link to={`/dispute/${dispute.id}`} className="dispute-card">
      <div className="dc-top">
        <span className="dc-id">DISPUTE №{String(dispute.id).padStart(4, "0")}</span>
        <StatusChip status={dispute.status} winner={dispute.winner} />
        <span className="dc-bond">{pooled.toFixed(1)} GEN</span>
      </div>
      <div className="dc-claims">
        <span className="dc-claim side-a">“{dispute.claimA}”</span>
        <span className="fork-glyph" aria-hidden>⟋⟍</span>
        <span className="dc-claim side-b">{dispute.claimB ? `“${dispute.claimB}”` : ""}</span>
      </div>
      <div className="dc-meta">
        {String(dispute.subQuestions.length).padStart(2, "0")} sub-question
        {dispute.subQuestions.length === 1 ? "" : "s"} · {deadline}
      </div>
    </Link>
  );
}
