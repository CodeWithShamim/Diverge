import { forwardRef } from "react";
import type { Winner } from "../../lib/types";

const C = {
  a: "#E0894A",
  b: "#4FB0C9",
  wins: "#E9EDF2",
  closed: "#414A54",
  unresolved: "#8A6D3B",
  faint: "#5B6570",
};

/** Static resolved fork — the reduced-motion rendering of the Divergence and
 *  the downloadable artifact consuming protocols can embed (§7). */
export const ForkSVG = forwardRef<SVGSVGElement, { winner: Winner; vertical?: boolean }>(
  function ForkSVG({ winner, vertical = false }, ref) {
    const un = winner === "UNRESOLVED" || winner === "NONE";
    const leftColor = un ? C.unresolved : winner === "A_WINS" ? C.wins : C.closed;
    const rightColor = un ? C.unresolved : winner === "B_WINS" ? C.wins : C.closed;
    const leftW = winner === "A_WINS" ? 3 : 1.25;
    const rightW = winner === "B_WINS" ? 3 : 1.25;

    return (
      <svg
        ref={ref}
        viewBox="0 0 400 300"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={
          un
            ? "Unresolved fork — neither path chosen"
            : `Resolved fork — side ${winner === "A_WINS" ? "A" : "B"} chosen`
        }
        style={vertical ? { transform: "rotate(0deg)" } : undefined}
      >
        <rect width="400" height="300" fill="#0A0C0F" />
        {/* stem */}
        <line x1="200" y1="30" x2="200" y2="110" stroke={un ? C.unresolved : C.wins} strokeWidth="2" />
        {/* split node */}
        <circle cx="200" cy="110" r={un ? 3 : 5} fill={un ? C.unresolved : C.wins} opacity={un ? 0.5 : 1} />
        {/* left path — Side A */}
        <path
          d="M 200 110 Q 160 170 80 250"
          fill="none"
          stroke={leftColor}
          strokeWidth={leftW}
          opacity={winner === "B_WINS" ? 0.5 : 1}
        />
        {/* right path — Side B */}
        <path
          d="M 200 110 Q 240 170 320 250"
          fill="none"
          stroke={rightColor}
          strokeWidth={rightW}
          opacity={winner === "A_WINS" ? 0.5 : 1}
        />
        {/* side identity strokes near origin (pre-verdict colors, kept as identity) */}
        <path d="M 200 110 Q 190 125 178 141" fill="none" stroke={C.a} strokeWidth="2" />
        <path d="M 200 110 Q 210 125 222 141" fill="none" stroke={C.b} strokeWidth="2" />
        <text x="72" y="272" fill={C.faint} fontFamily="monospace" fontSize="11">A</text>
        <text x="316" y="272" fill={C.faint} fontFamily="monospace" fontSize="11">B</text>
      </svg>
    );
  }
);
