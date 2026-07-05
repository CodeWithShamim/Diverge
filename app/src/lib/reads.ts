/** Read layer — view calls only, never a wallet prompt (FR-7.3). */

import { ADDRESSES, MOCK_MODE } from "../config/chain";
import { mockGetBoard, mockGetDispute, mockGetResolution, mockGetVerdict } from "./mock";
import type { Dispute, Resolution, Supports, SubResult, VerdictHydration } from "./types";
import { getReadClient } from "./client";

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
