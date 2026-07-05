/** Read layer — view calls only, never a wallet prompt (FR-7.3). */

import { ADDRESSES, MOCK_MODE } from "../config/chain";
import {
  mockGetAppeal,
  mockGetBoard,
  mockGetDispute,
  mockGetLock,
  mockGetResolution,
  mockGetRetryState,
  mockGetVerdict,
} from "./mock";
import type {
  Appeal,
  Dispute,
  Lock,
  Resolution,
  RetryState,
  Supports,
  SubResult,
  VerdictHydration,
  Winner,
} from "./types";
import { getReadClient } from "./client";

const WINNER_NAMES: Winner[] = ["NONE", "A_WINS", "B_WINS", "UNRESOLVED"];
const fromWei = (v: any) => Number(v) / 1e18;

export async function getBoard(): Promise<Dispute[]> {
  if (MOCK_MODE) return mockGetBoard();
  const client = await getReadClient();
  const raw = await client.readContract({
    address: ADDRESSES.registry,
    functionName: "get_board",
    args: [0, 50],
  });
  return (raw as any[]).map(fromChainDispute);
}

export async function getDispute(id: number): Promise<Dispute | undefined> {
  if (MOCK_MODE) return mockGetDispute(id);
  const client = await getReadClient();
  const raw = await client.readContract({
    address: ADDRESSES.registry,
    functionName: "get_dispute",
    args: [id],
  });
  return fromChainDispute(raw);
}

export async function getResolution(id: number): Promise<Resolution | undefined> {
  if (MOCK_MODE) return mockGetResolution(id);
  const client = await getReadClient();
  try {
    const raw = await client.readContract({
      address: ADDRESSES.log,
      functionName: "get_resolution",
      args: [id],
    });
    return {
      disputeId: Number(raw.dispute_id),
      winner: raw.winner,
      unresolved: raw.unresolved,
      uncontested: raw.uncontested,
      supportsVector: raw.supports_vector,
      snapshotA: raw.snapshot_a,
      snapshotB: raw.snapshot_b,
      finalizedAt: Number(raw.finalized_at),
    };
  } catch {
    return undefined;
  }
}

/** FR-2.3/FR-2.4 — hydrate the per-sub-question verdict from the arbiter's
 *  get_verdict view and fold it into the SubResult shape the detail view
 *  renders. `supports_vector` is the consensus data; `reasons` is testimony.
 *  Returns undefined when no verdict has been recorded yet (pre-adjudication),
 *  which the arbiter signals by raising "EXPECTED: no verdict". */
export async function getVerdict(
  id: number,
  subQuestions: string[]
): Promise<VerdictHydration | undefined> {
  if (MOCK_MODE) return mockGetVerdict(id);
  const client = await getReadClient();
  try {
    const raw = await client.readContract({
      address: ADDRESSES.arbiter,
      functionName: "get_verdict",
      args: [id],
    });
    const supports = raw.supports_vector ? String(raw.supports_vector).split(",") : [];
    const answers = raw.answers_vector ? String(raw.answers_vector).split(",") : [];
    const reasons: string[] = Array.isArray(raw.reasons) ? raw.reasons : [];
    const subResults: SubResult[] = supports.map((s, i) => ({
      index: i,
      question: subQuestions[i] ?? `Sub-question ${i}`,
      supports: s as Supports,
      answer: answers[i] === "1",
      reason: reasons[i] ?? "",
    }));
    return {
      subResults,
      confidence: raw.confidence ?? null,
      round: Number(raw.round),
    };
  } catch {
    return undefined;
  }
}

/** FR-4.2 — arbiter.get_retry_state. Never raises on-chain (returns zeros when
 *  no retry is scheduled), so an empty state is the normal healthy case. */
export async function getRetryState(id: number): Promise<RetryState | undefined> {
  if (MOCK_MODE) return mockGetRetryState(id);
  const client = await getReadClient();
  try {
    const raw = await client.readContract({
      address: ADDRESSES.arbiter,
      functionName: "get_retry_state",
      args: [id],
    });
    return {
      attempts: Number(raw.attempts),
      lastError: String(raw.last_error ?? ""),
      nextRetryAt: Number(raw.next_retry_at),
    };
  } catch {
    return undefined;
  }
}

/** FR-3 — vault.get_lock: escrowed bond breakdown. Raises "unknown dispute"
 *  before any bond is locked, which we treat as "no lock yet". */
export async function getLock(id: number): Promise<Lock | undefined> {
  if (MOCK_MODE) return mockGetLock(id);
  const client = await getReadClient();
  try {
    const raw = await client.readContract({
      address: ADDRESSES.vault,
      functionName: "get_lock",
      args: [id],
    });
    return {
      asserter: raw.asserter,
      challenger: raw.challenger,
      bondA: fromWei(raw.bond_a),
      bondB: fromWei(raw.bond_b),
      appellant: raw.appellant,
      appealBond: fromWei(raw.appeal_bond),
      settled: Boolean(raw.settled),
    };
  } catch {
    return undefined;
  }
}

/** FR-5 — appeals.get_appeal. Raises "no appeal" until a party appeals. */
export async function getAppeal(id: number): Promise<Appeal | undefined> {
  if (MOCK_MODE) return mockGetAppeal(id);
  const client = await getReadClient();
  try {
    const raw = await client.readContract({
      address: ADDRESSES.appeals,
      functionName: "get_appeal",
      args: [id],
    });
    return {
      disputeId: Number(raw.dispute_id),
      appellant: raw.appellant,
      bond: fromWei(raw.bond),
      preAppealWinner: WINNER_NAMES[Number(raw.pre_appeal_winner)] ?? "NONE",
      createdAt: Number(raw.created_at),
    };
  } catch {
    return undefined;
  }
}

function fromChainDispute(raw: any): Dispute {
  return {
    id: Number(raw.id),
    status: raw.status,
    winner: raw.winner,
    uncontested: raw.uncontested,
    round: Number(raw.round),
    claimA: raw.claim_a,
    claimB: raw.claim_b,
    asserter: raw.asserter,
    challenger: raw.challenger,
    bond: Number(raw.bond) / 1e18,
    evidenceRefA: raw.evidence_ref_a,
    evidenceRefB: raw.evidence_ref_b,
    snapshotA: raw.snapshot_a,
    snapshotB: raw.snapshot_b,
    subQuestions: raw.sub_questions,
    subResults: null, // hydrated from arbiter.get_verdict by the detail view
    confidence: null,
    challengeDeadline: Number(raw.challenge_deadline),
    appealDeadline: Number(raw.appeal_deadline),
    createdAt: Number(raw.created_at),
  };
}
