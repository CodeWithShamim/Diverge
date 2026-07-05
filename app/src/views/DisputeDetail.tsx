import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getAppeal, getDispute, getLock, getRetryState, getVerdict } from "../lib/reads";
import { finalize, finalizeUncontested, resolve } from "../lib/writes";
import type { Appeal, Dispute, Lock, RetryState, Supports, TxProgress } from "../lib/types";
import { StatusChip } from "../components/StatusChip";
import { ClaimPanel } from "../components/ClaimPanel";
import { SubQuestionBridge } from "../components/SubQuestionBridge";
import { EvidencePanel } from "../components/EvidencePanel";
import { TxLadder } from "../components/TxLadder";
import { Divergence } from "../components/Divergence";
import { Loader } from "../components/Loader";
import { revealDispute } from "../design/motion";

/** Dispute detail — the bilateral 5/2/5 layout mirrored across the center seam.
 *  Until verdict, neither side is emphasized; any asymmetry reads as bias. */
export function DisputeDetail() {
  const { id } = useParams();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [lock, setLock] = useState<Lock | undefined>();
  const [appeal, setAppeal] = useState<Appeal | undefined>();
  const [retry, setRetry] = useState<RetryState | undefined>();
  const [tx, setTx] = useState<TxProgress>({ state: "idle" });
  const [ceremony, setCeremony] = useState(false);
  const seamRef = useRef<HTMLDivElement>(null);
  const sideARef = useRef<HTMLDivElement>(null);
  const sideBRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    getDispute(Number(id)).then(async (d) => {
      if (!d) {
        setDispute(null);
        return;
      }
      // FR-2.3 — the registry knows the winner; per-sub-question supports +
      // reasons + confidence live in the arbiter. Hydrate them once a verdict
      // exists so the sub-question ceremony and Divergence scene render against
      // the real contract exactly as they do under the mock adapter.
      if (d.winner !== "NONE" && d.subResults === null) {
        const v = await getVerdict(d.id, d.subQuestions);
        if (v) {
          d.subResults = v.subResults;
          d.confidence = v.confidence;
        }
      }
      setDispute(d);

      // FR-3 / FR-4.2 / FR-5 — the escrow ledger, retry taxonomy, and appeal
      // record are independent view calls; render them as they resolve.
      getLock(d.id).then(setLock);
      getAppeal(d.id).then(setAppeal);
      if (d.status === "CHALLENGED" || d.status === "RESOLVING") {
        getRetryState(d.id).then(setRetry);
      } else {
        setRetry(undefined);
      }
    });
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (dispute) {
      revealDispute(
        seamRef.current?.querySelector(".seam-line") ?? null,
        sideARef.current,
        sideBRef.current
      );
    }
    // reveal runs once per dispute id — symmetry enforced in motion.ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispute?.id]);

  if (!dispute) {
    return (
      <div className="shell">
        <Loader block label="Reading dispute" />
      </div>
    );
  }

  const vector = (dispute.subResults ?? [])
    .map((r) => r.supports)
    .filter((s): s is Supports => s !== null);
  const hasVerdict = dispute.winner !== "NONE" && dispute.subResults !== null;
  const showDivergence = hasVerdict || (dispute.status === "FINAL" && dispute.winner !== "NONE");
  const appealOpen =
    dispute.status === "RESOLVED" &&
    dispute.round < 2 &&
    dispute.appealDeadline * 1000 > Date.now();
  const appealBond = dispute.bond / 2;
  // FR-1.5 — challenge window elapsed with no challenger: the assertion can stand.
  const challengeClosed =
    dispute.status === "ASSERTED" && dispute.challengeDeadline * 1000 <= Date.now();
  const busy = tx.state !== "idle" && tx.state !== "finalized";

  const onResolve = async () => {
    await resolve(dispute.id, setTx);
    setCeremony(true);
    load();
  };
  const onFinalize = async () => {
    await finalize(dispute.id, setTx);
    load();
  };
  const onFinalizeUncontested = async () => {
    await finalizeUncontested(dispute.id, setTx);
    load();
  };

  return (
    <div className="shell">
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, margin: "48px 0 8px" }}>
        <h1 className="t-h1">Dispute №{String(dispute.id).padStart(4, "0")}</h1>
        <StatusChip status={dispute.status} winner={dispute.winner} />
        <span className="t-data" style={{ marginLeft: "auto", color: "var(--read-muted)" }}>
          pooled bond {(dispute.claimB ? dispute.bond * 2 : dispute.bond).toFixed(1)} GEN
          {dispute.round === 2 ? " · round 02 (final)" : ""}
        </span>
      </div>

      {dispute.uncontested && (
        <p className="notice">
          Unchallenged assertion — stood by default after the challenge window.
          Logged as <span className="t-data">A_WINS (uncontested)</span>.
        </p>
      )}

      {challengeClosed && (
        <p className="notice">
          Challenge window closed with no challenger. Finalize to stand the
          assertion as <span className="t-data">A_WINS (uncontested)</span> and
          release the bond in full — no fee.
        </p>
      )}

      {retry && retry.attempts > 0 && (
        <p className="notice unresolved-notice">
          Adjudication hit a{" "}
          <span className="t-data">{retry.lastError.split(":")[0] || "transient"}</span>{" "}
          error — retry {retry.attempts}/2 scheduled
          {retry.nextRetryAt > 0 && (
            <> for <span className="t-data">
              {new Date(retry.nextRetryAt * 1000).toLocaleString()}
            </span></>
          )}
          . Bonds stay escrowed until a verdict or exhaustion.
        </p>
      )}

      <div className="bilateral" style={{ marginTop: 24 }}>
        <div ref={sideARef}>
          <ClaimPanel dispute={dispute} side="A" />
          <div style={{ marginTop: 12 }}>
            <EvidencePanel side="A" refUrl={dispute.evidenceRefA} snapshot={dispute.snapshotA} />
          </div>
        </div>
        <div className="center-seam" ref={seamRef} aria-hidden>
          <div className="seam-line" />
        </div>
        <div ref={sideBRef}>
          <ClaimPanel dispute={dispute} side="B" />
          {dispute.evidenceRefB && (
            <div style={{ marginTop: 12 }}>
              <EvidencePanel side="B" refUrl={dispute.evidenceRefB} snapshot={dispute.snapshotB} />
            </div>
          )}
        </div>
      </div>

      <div className="seam-rule">
        <span className="t-label">SUB-QUESTIONS</span>
      </div>
      <SubQuestionBridge
        questions={dispute.subQuestions}
        results={dispute.subResults}
        ceremony={ceremony}
      />

      {showDivergence && (
        <>
          <div className="seam-rule">
            <span className="t-label">THE DIVERGENCE</span>
          </div>
          <Divergence
            winner={dispute.winner}
            vector={vector}
            appealDeadline={dispute.appealDeadline}
          />
          {dispute.winner === "UNRESOLVED" && (
            <p className="notice unresolved-notice" style={{ marginTop: 16 }}>
              The evidence does not decisively support either side. Both bonds
              returned. No verdict recorded.
            </p>
          )}
        </>
      )}

      {lock && (
        <>
          <div className="seam-rule">
            <span className="t-label">SETTLEMENT LEDGER</span>
          </div>
          <dl className="kv">
            <dt>asserter bond</dt>
            <dd>{lock.bondA.toFixed(1)} GEN</dd>
            <dt>challenger bond</dt>
            <dd>{lock.bondB > 0 ? `${lock.bondB.toFixed(1)} GEN` : "—"}</dd>
            {(appeal || lock.appealBond > 0) && (
              <>
                <dt>appeal bond</dt>
                <dd>{lock.appealBond.toFixed(1)} GEN</dd>
              </>
            )}
            {appeal && (
              <>
                <dt>appellant</dt>
                <dd>{appeal.appellant}</dd>
                <dt>pre-appeal winner</dt>
                <dd>{appeal.preAppealWinner}</dd>
              </>
            )}
            <dt>escrow status</dt>
            <dd>{lock.settled ? "settled — paid out" : "locked"}</dd>
          </dl>
        </>
      )}

      <div className="seam-rule">
        <span className="t-label">ACTIONS</span>
      </div>
      <div className="actions-bar">
        {dispute.status === "ASSERTED" && !challengeClosed && (
          <Link to={`/challenge/${dispute.id}`} className="btn btn-primary">
            Challenge · match {dispute.bond.toFixed(1)} GEN
          </Link>
        )}
        {challengeClosed && (
          <button className="btn btn-primary" onClick={onFinalizeUncontested} disabled={busy}>
            Finalize uncontested · release {dispute.bond.toFixed(1)} GEN
          </button>
        )}
        {dispute.status === "CHALLENGED" && (
          <button className="btn btn-primary" onClick={onResolve} disabled={busy}>
            Resolve · trigger adjudication
          </button>
        )}
        {appealOpen && (
          <Link to={`/appeal/${dispute.id}`} className="btn btn-secondary">
            Appeal ({appealBond.toFixed(1)} GEN)
          </Link>
        )}
        {dispute.status === "RESOLVED" && (!appealOpen || dispute.round === 2) && (
          <button className="btn btn-primary" onClick={onFinalize} disabled={busy}>
            Finalize · settle bonds
          </button>
        )}
        {dispute.status === "FINAL" && (
          <Link to={`/explorer?id=${dispute.id}`} className="btn btn-secondary">
            View in resolution explorer
          </Link>
        )}
      </div>
      <TxLadder progress={tx} />
    </div>
  );
}
