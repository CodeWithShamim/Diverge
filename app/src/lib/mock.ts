/** Mock adapter — a complete in-browser simulation of the contract set so the
 *  dApp is fully explorable before (or without) a Bradbury deployment.
 *  Same interface as lib/reads.ts + lib/writes.ts real paths. */

import type { Dispute, Resolution, SubResult, TxProgress, Winner } from "./types";

const now = () => Math.floor(Date.now() / 1000);
const H = 3600;

const sha = (s: string) =>
  "sha256:" +
  Array.from(s)
    .reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 7)
    .toString(16)
    .replace("-", "a")
    .padEnd(12, "0")
    .slice(0, 12) +
  "…";

const addr = (seed: string) => "0x" + seed.repeat(40).slice(0, 4) + "…" + seed.repeat(4).slice(0, 4);

let disputes: Dispute[] = [];
let resolutions: Map<number, Resolution> = new Map();

function seed() {
  const mk = (d: Partial<Dispute> & { id: number }): Dispute => ({
    status: "ASSERTED",
    winner: "NONE",
    uncontested: false,
    round: 0,
    claimA: "",
    claimB: "",
    asserter: addr("19b7"),
    challenger: addr("4c2e"),
    bond: 5,
    evidenceRefA: "https://exchange.example/settlement/eth-2400.json",
    evidenceRefB: "https://mirror.example/alt-settlement.json",
    snapshotA: "",
    snapshotB: "",
    subQuestions: [],
    subResults: null,
    confidence: null,
    challengeDeadline: now() + 48 * H,
    appealDeadline: 0,
    createdAt: now() - 6 * H,
    ...d,
  });

  const resolved = (
    id: number,
    winner: Winner,
    vec: ("A" | "B" | "NEITHER")[],
    extra: Partial<Dispute>
  ): Dispute => {
    const subQuestions = extra.subQuestions ?? [];
    const subResults: SubResult[] = vec.map((s, i) => ({
      index: i,
      question: subQuestions[i] ?? `Sub-question ${i}`,
      supports: s,
      answer: s !== "NEITHER",
      reason:
        s === "NEITHER"
          ? "The pinned evidence does not decisively answer this."
          : `The pinned snapshot supports Side ${s} on this point.`,
    }));
    return mk({
      id,
      winner,
      subResults,
      confidence: "HIGH",
      snapshotA: sha("a" + id),
      snapshotB: sha("b" + id),
      ...extra,
    });
  };

  disputes = [
    mk({
      id: 0,
      claimA: "PR #841 shipped the agreed deliverable before the deadline.",
      evidenceRefA: "https://github.com/genlayer/repo/commit/a1b2c3d",
      subQuestions: [
        "Was PR #841 merged before 2026-07-01T00:00:00Z?",
        "Does the diff implement the agreed scope?",
      ],
      createdAt: now() - 2 * H,
      challengeDeadline: now() + 70 * H,
    }),
    mk({
      id: 1,
      status: "CHALLENGED",
      claimA: "The market settled above $2,400 at expiry.",
      claimB: "The market settled below $2,400 at expiry.",
      snapshotA: sha("a1"),
      snapshotB: sha("b1"),
      bond: 5,
      subQuestions: [
        "Did settlement occur before block 8,241,004?",
        "Does the oracle source confirm the $2,400 mark?",
        "Was the expiry timestamp valid?",
        "Is the evidence source authoritative?",
      ],
      createdAt: now() - 20 * H,
    }),
    mk({
      id: 2,
      status: "RESOLVING",
      claimA: "The bridge message batch #52 is valid under the committee rules.",
      claimB: "Batch #52 contains a forged attestation.",
      snapshotA: sha("a2"),
      snapshotB: sha("b2"),
      bond: 12,
      subQuestions: [
        "Do all 7 signatures verify against the registered committee keys?",
        "Is the batch root consistent with the source chain state?",
        "Was the attestation window respected?",
      ],
      createdAt: now() - 30 * H,
    }),
    resolved(3, "A_WINS", ["A", "A", "NEITHER", "A"], {
      status: "RESOLVED",
      round: 1,
      claimA: "The market settled above $2,400 at expiry.",
      claimB: "The market settled below $2,400 at expiry.",
      bond: 5,
      subQuestions: [
        "Did settlement occur before block 8,241,004?",
        "Does the oracle source confirm the $2,400 mark?",
        "Was the expiry timestamp valid?",
        "Is the evidence source authoritative?",
      ],
      appealDeadline: now() + 20 * H,
      createdAt: now() - 40 * H,
    }),
    resolved(4, "B_WINS", ["B", "B", "A"], {
      status: "FINAL",
      round: 1,
      claimA: "The shipment cleared customs before June 30.",
      claimB: "Customs clearance happened July 2 — after the SLA breach point.",
      bond: 8,
      subQuestions: [
        "Does the customs record show clearance before June 30?",
        "Is the carrier's timestamp consistent with the customs record?",
        "Was the SLA breach point correctly computed?",
      ],
      createdAt: now() - 90 * H,
    }),
    resolved(5, "UNRESOLVED", ["A", "B", "NEITHER"], {
      status: "FINAL",
      round: 1,
      claimA: "The validator set change was authorized by governance vote #17.",
      claimB: "Vote #17 never reached quorum; the change was unauthorized.",
      bond: 20,
      subQuestions: [
        "Did vote #17 close with quorum reached?",
        "Was the proposal payload identical to the executed change?",
        "Was the timelock respected?",
      ],
      createdAt: now() - 120 * H,
    }),
    resolved(6, "B_WINS", ["B", "NEITHER", "B"], {
      status: "APPEALED",
      round: 1,
      claimA: "The API met its 99.9% uptime SLA for June.",
      claimB: "Uptime was 99.4% — below the SLA.",
      bond: 10,
      subQuestions: [
        "Does the monitoring log show downtime above the SLA allowance?",
        "Were the declared maintenance windows excluded correctly?",
        "Is the monitoring source the SLA's source of truth?",
      ],
      createdAt: now() - 60 * H,
    }),
    mk({
      id: 7,
      status: "FINAL",
      winner: "A_WINS",
      uncontested: true,
      claimA: "Release v2.4.0 was published to the registry before the cutoff.",
      subQuestions: ["Was v2.4.0 published before 2026-06-15T00:00:00Z?"],
      snapshotA: sha("a7"),
      createdAt: now() - 200 * H,
      challengeDeadline: now() - 150 * H,
    }),
  ];

  for (const d of disputes) {
    if (d.status === "FINAL" && d.winner !== "NONE") {
      resolutions.set(d.id, {
        disputeId: d.id,
        winner: d.winner,
        unresolved: d.winner === "UNRESOLVED",
        uncontested: d.uncontested,
        supportsVector: (d.subResults ?? []).map((s) => s.supports).join(","),
        snapshotA: d.snapshotA,
        snapshotB: d.snapshotB,
        finalizedAt: d.createdAt + 30 * H,
      });
    }
  }
}
seed();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- reads --------------------------------------------------------------------

export async function mockGetBoard(): Promise<Dispute[]> {
  await wait(220);
  return [...disputes].sort((a, b) => b.id - a.id);
}

export async function mockGetDispute(id: number): Promise<Dispute | undefined> {
  await wait(160);
  return disputes.find((d) => d.id === id);
}

export async function mockGetResolution(id: number): Promise<Resolution | undefined> {
  await wait(160);
  return resolutions.get(id);
}

// ---- writes — every write walks the full FR-7.2 ladder --------------------------

async function ladder(
  onProgress: (p: TxProgress) => void,
  apply: () => void,
  opts: { softError?: string } = {}
) {
  const hash = "0x" + Math.random().toString(16).slice(2, 10) + "…";
  onProgress({ state: "submitted", hash });
  await wait(500);
  onProgress({ state: "pending", hash });
  await wait(1100);
  if (opts.softError) {
    onProgress({ state: "soft-error", hash, detail: opts.softError });
    return;
  }
  onProgress({ state: "accepted", hash });
  await wait(1400);
  apply();
  onProgress({ state: "finalized", hash });
}

export async function mockAssertClaim(
  claim: string,
  evidenceRef: string,
  subQuestions: string[],
  bond: number,
  onProgress: (p: TxProgress) => void
) {
  const id = disputes.length;
  await ladder(onProgress, () => {
    disputes.push({
      id,
      status: "ASSERTED",
      winner: "NONE",
      uncontested: false,
      round: 0,
      claimA: claim,
      claimB: "",
      asserter: addr("you0"),
      challenger: "",
      bond,
      evidenceRefA: evidenceRef,
      evidenceRefB: "",
      snapshotA: "",
      snapshotB: "",
      subQuestions,
      subResults: null,
      confidence: null,
      challengeDeadline: now() + 72 * H,
      appealDeadline: 0,
      createdAt: now(),
    });
  });
  return id;
}

export async function mockChallenge(
  id: number,
  counterClaim: string,
  evidenceRef: string,
  onProgress: (p: TxProgress) => void
) {
  await ladder(onProgress, () => {
    const d = disputes.find((x) => x.id === id);
    if (!d) return;
    d.status = "CHALLENGED";
    d.claimB = counterClaim;
    d.evidenceRefB = evidenceRef;
    d.challenger = addr("you0");
    d.snapshotA = sha("a" + id + d.evidenceRefA);
    d.snapshotB = sha("b" + id + evidenceRef);
  });
}

export async function mockResolve(id: number, onProgress: (p: TxProgress) => void) {
  const d = disputes.find((x) => x.id === id);
  if (!d) return;
  d.status = "RESOLVING";
  await ladder(onProgress, () => {
    // deterministic pseudo-verdict for the demo
    const vec = d.subQuestions.map((_, i) =>
      (id + i) % 3 === 2 ? "NEITHER" : (id + i) % 2 === 0 ? "A" : "B"
    ) as ("A" | "B" | "NEITHER")[];
    const a = vec.filter((v) => v === "A").length;
    const b = vec.filter((v) => v === "B").length;
    d.winner = a > b ? "A_WINS" : b > a ? "B_WINS" : "UNRESOLVED";
    d.round = 1;
    d.status = "RESOLVED";
    d.appealDeadline = now() + 24 * H;
    d.confidence = "HIGH";
    d.subResults = vec.map((s, i) => ({
      index: i,
      question: d.subQuestions[i],
      supports: s,
      answer: s !== "NEITHER",
      reason:
        s === "NEITHER"
          ? "The pinned evidence does not decisively answer this."
          : `The pinned snapshot supports Side ${s} on this point.`,
    }));
  });
}

export async function mockAppeal(id: number, onProgress: (p: TxProgress) => void) {
  await ladder(onProgress, () => {
    const d = disputes.find((x) => x.id === id);
    if (!d || !d.subResults) return;
    d.status = "RESOLVED";
    d.round = 2;
    d.appealDeadline = 0;
  });
}

export async function mockFinalize(id: number, onProgress: (p: TxProgress) => void) {
  await ladder(onProgress, () => {
    const d = disputes.find((x) => x.id === id);
    if (!d) return;
    d.status = "FINAL";
    resolutions.set(id, {
      disputeId: id,
      winner: d.winner,
      unresolved: d.winner === "UNRESOLVED",
      uncontested: d.uncontested,
      supportsVector: (d.subResults ?? []).map((s) => s.supports).join(","),
      snapshotA: d.snapshotA,
      snapshotB: d.snapshotB,
      finalizedAt: now(),
    });
  });
}
