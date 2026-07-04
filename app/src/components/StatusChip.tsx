import type { DisputeStatus, Winner } from "../lib/types";

/** §5.2 — one chip per state; verdict chips carry the winning side's dot. */
export function StatusChip({
  status,
  winner,
}: {
  status: DisputeStatus;
  winner?: Winner;
}) {
  let key: string = status;
  let label: string = status;
  if (status === "RESOLVED" || status === "FINAL") {
    if (winner === "A_WINS") {
      key = "A_WINS";
      label = "A WINS";
    } else if (winner === "B_WINS") {
      key = "B_WINS";
      label = "B WINS";
    } else if (winner === "UNRESOLVED") {
      key = "UNRESOLVED";
      label = "UNRESOLVED";
    }
    if (status === "FINAL" && winner !== "UNRESOLVED") label += " · FINAL";
  }
  const dot = key === "A_WINS" || key === "B_WINS";
  return (
    <span className={`chip chip-${key}`} role="status" aria-label={`Dispute status: ${label}`}>
      {dot && <span className="chip-dot" aria-hidden />}
      {label}
    </span>
  );
}
