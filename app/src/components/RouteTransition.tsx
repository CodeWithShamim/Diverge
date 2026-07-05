/** RouteTransition — the page-switching loader. On every route change two
 *  colored panels sweep in from opposite edges (claim-a from the left, claim-b
 *  from the right), interlock along a glowing diagonal fork seam behind the
 *  spinning multicolor ring, then split apart to reveal the new page — the
 *  "Divergence" made literal at every navigation.
 *
 *  Timeline (see loader.css keyframes):
 *    cover  0–520ms   panels close, ring + seam ignite
 *    reveal 520–1080ms panels diverge, content underneath is revealed
 */
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import "../design/loader.css";

type Phase = "idle" | "cover" | "reveal";

const COVER_MS = 520;
const REVEAL_MS = 560;

export function RouteTransition() {
  const { pathname } = useLocation();
  const [phase, setPhase] = useState<Phase>("idle");
  const prev = useRef(pathname);

  useEffect(() => {
    if (prev.current === pathname) return; // ignore first mount / same route
    prev.current = pathname;

    setPhase("cover");
    const toReveal = window.setTimeout(() => setPhase("reveal"), COVER_MS);
    const toIdle = window.setTimeout(() => setPhase("idle"), COVER_MS + REVEAL_MS);
    return () => {
      window.clearTimeout(toReveal);
      window.clearTimeout(toIdle);
    };
  }, [pathname]);

  if (phase === "idle") return null;

  return (
    <div className={`route-x route-x--${phase}`} aria-hidden="true">
      <span className="route-x-panel route-x-panel--a" />
      <span className="route-x-panel route-x-panel--b" />
      <span className="route-x-seam" />
      <div className="route-x-core">
        <div className="loader loader--lg">
          <div className="loader-ring">
            <span className="loader-fork">
              <span className="arm-a">⟋</span>
              <span className="arm-b">⟍</span>
            </span>
          </div>
          <span className="loader-label route-x-label">DIVERGING</span>
        </div>
      </div>
    </div>
  );
}
