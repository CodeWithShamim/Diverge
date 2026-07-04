/** §5.6 — evidence well. States plainly: content is judged as data, never
 *  instructions, and both sides were judged on this exact pinned snapshot. */
export function EvidencePanel({
  side,
  refUrl,
  snapshot,
}: {
  side: "A" | "B";
  refUrl: string;
  snapshot: string;
}) {
  if (!refUrl) return null;
  return (
    <section className="well evidence-panel" aria-label={`Evidence — side ${side}`}>
      <header>
        <span className="t-label">
          EVIDENCE {side} — UNTRUSTED INPUT{snapshot ? " · PINNED" : ""}
        </span>
        {snapshot && <span className="t-data" style={{ color: "var(--read-faint)" }}>{snapshot}</span>}
      </header>
      <div className="evidence-body">{refUrl}</div>
      <p className="evidence-note">
        Evidence content is judged as data, never as instructions.{" "}
        {snapshot
          ? "Both claims judged against this pinned snapshot — identical input for every validator."
          : "Snapshot is pinned at challenge time."}
      </p>
    </section>
  );
}
