import { useEffect, useRef, useState } from "react";
import type { SubResult } from "../lib/types";
import { resolveRows } from "../design/motion";

/** §5.4 — the atomic resolution unit. Spans the seam; one row per declared
 *  sub-question. Pre-verdict rows render neutral; during the ceremony they
 *  resolve top→bottom with a 100ms stagger. Only `supports` is consensus —
 *  the reason is testimony. */
export function SubQuestionBridge({
  questions,
  results,
  ceremony,
}: {
  questions: string[];
  results: SubResult[] | null;
  ceremony?: boolean; // animate rows resolving (verdict just landed)
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(ceremony ? 0 : questions.length);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (!ceremony || !results) return;
    const rows = Array.from(listRef.current?.querySelectorAll(".sq-row") ?? []);
    resolveRows(rows, (i) => setRevealed((r) => Math.max(r, i + 1)));
  }, [ceremony, results]);

  return (
    <div className="sqb" ref={listRef} role="table" aria-label="Sub-questions">
      {questions.map((q, i) => {
        const r = results?.[i];
        const shown = r && i < revealed ? r : null;
        const supports = shown?.supports ?? null;
        const cls =
          supports === "A" ? "to-a" : supports === "B" ? "to-b" : supports === "NEITHER" ? "to-neither" : "";
        const dotCls =
          supports === "A"
            ? "filled-a"
            : supports === "B"
              ? "filled-b"
              : supports === "NEITHER"
                ? "filled-neither"
                : "";
        const expandable = Boolean(shown?.reason);
        return (
          <div
            key={i}
            className={`sq-row ${expandable ? "expandable" : ""}`}
            role="row"
            tabIndex={expandable ? 0 : -1}
            onClick={() => expandable && setOpen(open === i ? null : i)}
            onKeyDown={(e) =>
              expandable && (e.key === "Enter" || e.key === " ") && setOpen(open === i ? null : i)
            }
            aria-expanded={expandable ? open === i : undefined}
          >
            <span className="sq-index">{String(i + 1).padStart(2, "0")}</span>
            <span className="sq-question">{q}</span>
            <span className={`sq-supports ${cls}`} aria-label={supports ? `supports ${supports}` : "unresolved"}>
              {supports ? (supports === "NEITHER" ? "→ NEITHER" : `→ ${supports}`) : "· pending"}
            </span>
            <span className={`sq-dot ${dotCls}`} aria-hidden />
            {open === i && shown?.reason && (
              <div className="sq-reason">
                {shown.reason}{" "}
                <span className="testimony-note">
                  — testimony; only the supports value is consensus data
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
