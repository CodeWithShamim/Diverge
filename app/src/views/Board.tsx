import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBoard } from '../lib/reads';
import type { Dispute } from '../lib/types';
import { DisputeCard } from '../components/DisputeCard';
import { Loader } from '../components/Loader';
import { fadeIn } from '../design/motion';

/** Dispute board — deliberately asymmetric (a list); the bilateral symmetry is
 *  reserved for the dispute detail, where it carries meaning (§4). */
export function Board() {
  const [disputes, setDisputes] = useState<Dispute[] | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fadeIn(heroRef.current);
    getBoard().then(setDisputes);
  }, []);

  const open = disputes?.filter((d) => d.status === 'ASSERTED') ?? [];
  const live = disputes?.filter((d) => !['ASSERTED', 'FINAL'].includes(d.status)) ?? [];
  const done = disputes?.filter((d) => d.status === 'FINAL') ?? [];

  return (
    <div className="shell">
      <div className="board-hero" ref={heroRef}>
        <h1 className="t-hero thesis">
          Two claims. <span className="half-a">One</span> <span className="half-b">truth</span>.
        </h1>
        <p>
          Diverge resolves contested off-chain state by reading the pinned evidence and reasoning
          about which claim it supports — an adversarial oracle for optimistic systems, on GenLayer.
        </p>
        <div className="actions-bar">
          <Link to="/assert" className="btn btn-primary">
            Assert a claim
          </Link>
          <Link to="/explorer" className="btn btn-secondary">
            Resolution explorer
          </Link>
        </div>
      </div>

      {disputes === null && <Loader block label="Reading the board" />}

      {disputes !== null && disputes.length === 0 && (
        <div className="board-empty">No open disputes. Assert a claim to open the fork.</div>
      )}

      {open.length > 0 && (
        <>
          <div className="seam-rule">
            <span className="t-label">OPEN ASSERTIONS</span>
          </div>
          {open.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </>
      )}

      {live.length > 0 && (
        <>
          <div className="seam-rule">
            <span className="t-label">LIVE DISPUTES</span>
          </div>
          {live.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="seam-rule">
            <span className="t-label">FINAL</span>
          </div>
          {done.map((d) => (
            <DisputeCard key={d.id} dispute={d} />
          ))}
        </>
      )}
    </div>
  );
}
