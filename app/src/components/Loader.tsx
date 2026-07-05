/** Loader — the app's single loading surface (§ loading states).
 *  A multicolor diverging ring: the whole brand palette cycles while a fork
 *  glyph splits into its two claim colors. Three shapes, one component:
 *
 *    <Loader label="Reading the board" />                inline ring + label
 *    <Loader block label="Reading dispute" />            centered in a min-height block
 *    <Loader screen label="Diverging" />                 fullscreen overlay w/ aurora
 *
 *  Reduced-motion is handled entirely in loader.css.
 */
import "../design/loader.css";

type Size = "sm" | "md" | "lg";

interface LoaderProps {
  /** shimmering caption under the ring; omit for a bare ring */
  label?: string;
  /** ring size — defaults md, screen forces lg */
  size?: Size;
  /** center inside a padded min-height block (in-content loading) */
  block?: boolean;
  /** fullscreen overlay with drifting aurora backdrop (boot / route change) */
  screen?: boolean;
  /** set true to play the fade-out before unmount */
  leaving?: boolean;
}

function Ring({ label, size = "md" }: { label?: string; size?: Size }) {
  const sizeClass = size === "sm" ? " loader--sm" : size === "lg" ? " loader--lg" : "";
  return (
    <div className={`loader${sizeClass}`} role="status" aria-live="polite">
      <div className="loader-ring">
        <span className="loader-fork" aria-hidden="true">
          <span className="arm-a">⟋</span>
          <span className="arm-b">⟍</span>
        </span>
      </div>
      {label && <span className="loader-label">{label}</span>}
      <span className="sr-only">{label ?? "Loading"}</span>
    </div>
  );
}

export function Loader({ label, size, block, screen, leaving }: LoaderProps) {
  if (screen) {
    return (
      <div className="loader-screen" data-leaving={leaving ? "true" : "false"}>
        <div className="loader-aurora" aria-hidden="true">
          <span /> <span /> <span /> <span />
        </div>
        <Ring label={label} size="lg" />
      </div>
    );
  }
  if (block) {
    return (
      <div className="loader-block">
        <Ring label={label} size={size} />
      </div>
    );
  }
  return <Ring label={label} size={size} />;
}
