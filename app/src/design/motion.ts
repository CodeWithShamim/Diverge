/** Motion system — tension and release (Design System §6).
 *  The symmetry rule is enforced here: any two-sided tween takes both targets
 *  in ONE call and animates them identically. */

import gsap from "gsap";
import Lenis from "lenis";

export const EASE_INSTRUMENT = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_SNAP = "cubic-bezier(0.7, 0, 0.3, 1)";
export const DUR_FAST = 0.16;
export const DUR_MOVE = 0.32;
export const DUR_DIVERGE = 1.8;

// gsap-native eases mirroring the CSS tokens
export const easeInstrument = "expo.out";
export const easeSnap = "power3.inOut";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

let lenis: Lenis | null = null;

export function initLenis() {
  if (lenis || prefersReducedMotion()) return;
  lenis = new Lenis({ lerp: 0.1 }); // no scroll-jacking, no pinning
  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/** Page load: seam draws top→bottom, then BOTH claim panels fade in
 *  simultaneously — never staggered (§6). */
export function revealDispute(seamEl: Element | null, sideA: Element | null, sideB: Element | null) {
  if (prefersReducedMotion()) return;
  const tl = gsap.timeline();
  if (seamEl) {
    tl.fromTo(
      seamEl,
      { scaleY: 0, transformOrigin: "top center" },
      { scaleY: 1, duration: DUR_MOVE, ease: easeInstrument }
    );
  }
  const both = [sideA, sideB].filter(Boolean) as Element[];
  if (both.length) {
    // one tween, both targets, identical values — the symmetry rule
    tl.fromTo(
      both,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: DUR_MOVE, ease: easeInstrument },
      seamEl ? ">-0.05" : 0
    );
  }
  return tl;
}

/** Ceremony: sub-question rows resolve top→bottom, 100ms stagger, arrows
 *  snapping to their side with the snap ease. */
export function resolveRows(rows: Element[], onRow?: (i: number) => void) {
  if (prefersReducedMotion()) {
    rows.forEach((_, i) => onRow?.(i));
    return;
  }
  const tl = gsap.timeline();
  rows.forEach((row, i) => {
    tl.fromTo(
      row,
      { opacity: 0.35 },
      {
        opacity: 1,
        duration: DUR_FAST,
        ease: easeSnap,
        onStart: () => onRow?.(i),
      },
      i * 0.1
    );
  });
  return tl;
}

export function fadeIn(el: Element | null, delay = 0) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { opacity: 0, y: 6 },
    { opacity: 1, y: 0, duration: DUR_MOVE, ease: easeInstrument, delay }
  );
}
