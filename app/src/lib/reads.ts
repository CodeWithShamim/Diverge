/** Read layer — view calls only, never a wallet prompt (FR-7.3). */

import { ADDRESSES, MOCK_MODE } from "../config/chain";
import { mockGetBoard, mockGetDispute, mockGetResolution } from "./mock";
import type { Dispute, Resolution } from "./types";
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
