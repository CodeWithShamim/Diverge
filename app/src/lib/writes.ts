/** Write layer — every write drives the full FR-7.2 tx state ladder:
 *  submitted → pending → accepted → finalized / failed / soft-error. */

import { ADDRESSES, MOCK_MODE } from "../config/chain";
import {
  mockAppeal,
  mockAssertClaim,
  mockChallenge,
  mockFinalize,
  mockResolve,
} from "./mock";
import type { TxProgress } from "./types";
import { getClient } from "./client";

type OnProgress = (p: TxProgress) => void;

async function realWrite(
  address: string,
  functionName: string,
  args: any[],
  value: bigint,
  onProgress: OnProgress
) {
  try {
    const client = await getClient();
    onProgress({ state: "submitted" });
    const hash = await client.writeContract({ address, functionName, args, value });
    onProgress({ state: "pending", hash });
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
    });
    onProgress({ state: "accepted", hash });
    const final = await client.waitForTransactionReceipt({
      hash,
      status: "FINALIZED",
    });
    // FR-4.3 — GenLayer can finalize in a soft-error state; surface it, never hide it
    const softError =
      final?.consensus_data?.leader_receipt?.execution_result === "ERROR";
    if (softError) {
      onProgress({
        state: "soft-error",
        hash,
        detail: "Validators failed to converge — UNRESOLVED path · bonds returned",
      });
    } else {
      onProgress({ state: "finalized", hash });
    }
  } catch (e: any) {
    onProgress({ state: "failed", detail: e?.message ?? String(e) });
  }
}

const toWei = (gen: number) => BigInt(Math.round(gen * 1e6)) * 10n ** 12n;

export async function assertClaim(
  claim: string,
  evidenceRef: string,
  subQuestions: string[],
  bondGen: number,
  onProgress: OnProgress
): Promise<number | void> {
  if (MOCK_MODE) return mockAssertClaim(claim, evidenceRef, subQuestions, bondGen, onProgress);
  return realWrite(
    ADDRESSES.registry,
    "assert_claim",
    [claim, evidenceRef, subQuestions],
    toWei(bondGen),
    onProgress
  );
}

export async function challenge(
  id: number,
  counterClaim: string,
  evidenceRef: string,
  bondGen: number,
  onProgress: OnProgress
) {
  if (MOCK_MODE) return mockChallenge(id, counterClaim, evidenceRef, onProgress);
  return realWrite(
    ADDRESSES.registry,
    "challenge",
    [id, counterClaim, evidenceRef],
    toWei(bondGen),
    onProgress
  );
}

export async function resolve(id: number, onProgress: OnProgress) {
  if (MOCK_MODE) return mockResolve(id, onProgress);
  return realWrite(ADDRESSES.arbiter, "resolve", [id], 0n, onProgress);
}

export async function appeal(id: number, bondGen: number, onProgress: OnProgress) {
  if (MOCK_MODE) return mockAppeal(id, onProgress);
  return realWrite(ADDRESSES.appeals, "appeal", [id], toWei(bondGen), onProgress);
}

export async function finalize(id: number, onProgress: OnProgress) {
  if (MOCK_MODE) return mockFinalize(id, onProgress);
  return realWrite(ADDRESSES.registry, "finalize", [id], 0n, onProgress);
}
