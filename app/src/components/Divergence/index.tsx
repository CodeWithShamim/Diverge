import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { Supports, Winner } from "../../lib/types";
import { prefersReducedMotion } from "../../design/motion";
import { ForkSVG } from "./ForkSVG";

const DivergenceSceneLazy = lazy(() =>
  import("./Scene").then((m) => ({ default: m.DivergenceScene }))
);

/** §7 — the signature element. R3F ceremony when a verdict lands; static SVG
 *  under reduced motion; UNRESOLVED renders deliberately anticlimactic.
 *  The resolved fork is downloadable as SVG — the shareable artifact. */
export function Divergence({
  winner,
  vector,
  appealDeadline,
}: {
  winner: Winner;
  vector: Supports[];
  appealDeadline?: number;
}) {
  const [stamp, setStamp] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const reduced = prefersReducedMotion();
  const unresolved = winner === "UNRESOLVED";

  useEffect(() => {
    if (reduced) {
      setStamp(true);
      return;
    }
    const t = setTimeout(() => setStamp(true), 1500); // reading phase begins
    return () => clearTimeout(t);
  }, [reduced]);

  const ticks = vector
    .map((v) => (v === "NEITHER" ? "·" : v))
    .join(" ");

  const word =
    winner === "A_WINS" ? "A WINS" : winner === "B_WINS" ? "B WINS" : "UNRESOLVED";

  const download = () => {
    // serialize the static fork — consuming protocols can embed the verdict
    const el = svgRef.current;
    const markup = el
      ? el.outerHTML
      : `<svg xmlns="http://www.w3.org/2000/svg"></svg>`;
    const blob = new Blob([markup], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fork-verdict-${word.replace(" ", "-")}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const appealOpen = (appealDeadline ?? 0) * 1000 > Date.now();

  return (
    <figure className="divergence-wrap" aria-label={`Verdict ceremony: ${word}`}>
      {reduced ? (
        <ForkSVG ref={svgRef} winner={winner} />
      ) : (
        <>
          <Suspense fallback={<ForkSVG winner={winner} />}>
            <DivergenceSceneLazy winner={winner} vector={vector} />
          </Suspense>
          {/* hidden static copy — the downloadable artifact */}
          <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden>
            <ForkSVG ref={svgRef} winner={winner} />
          </div>
        </>
      )}
      <figcaption className={`divergence-stamp ${stamp ? "visible" : ""} ${unresolved ? "unresolved" : ""}`}>
        <div className="verdict-word">{word}</div>
        {!unresolved && vector.length > 0 && (
          <div className="verdict-vector" aria-label={`sub-question vector ${vector.join(", ")}`}>
            {ticks}
          </div>
        )}
        {unresolved && <div className="verdict-vector">no verdict · both bonds returned</div>}
        {appealOpen && !unresolved && (
          <div className="verdict-vector">
            appeal window open until{" "}
            {new Date((appealDeadline ?? 0) * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC
          </div>
        )}
      </figcaption>
      <button className="btn btn-secondary divergence-dl" onClick={download}>
        Download verdict fork · SVG
      </button>
    </figure>
  );
}
