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
import { getWriteClient } from "./client";
import { getActiveAddress, getActiveProvider } from "./wallet";
import { extractContractError, fromThrown, titleFor } from "./txError";
import { toast } from "./toast";

type OnProgress = (p: TxProgress) => void;

async function realWrite(
  address: string,
  functionName: string,
  args: any[],
  value: bigint,
  onProgress: OnProgress
) {
  const provider = getActiveProvider();
  const account = getActiveAddress();
  if (!provider || !account) {
    const detail = "Connect a wallet to sign this transaction.";
    toast.error("No wallet connected", detail);
    onProgress({ state: "failed", detail });
    return;
  }
  try {
    const client = await getWriteClient(provider);
    onProgress({ state: "submitted" });
    // genlayer-js reads `account.address` off whatever it's handed and does NOT
    // normalize a bare address string (viem only does that at client creation).
    // So wrap the wallet address as a viem JSON-RPC account: it carries `.address`
    // and, being type !== "local", routes signing through the wallet provider's
    // eth_sendTransaction rather than a local signTransaction.
    const hash = await client.writeContract({
      address,
      functionName,
      args,
      value,
      account: { address: account as `0x${string}`, type: "json-rpc" as const },
    });
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
    // FR-4.3 — GenLayer finalizes even when the contract raises; the message lives
    // in leader_receipt[].genvm_result.stderr. Surface it, never hide it as success.
    const err = extractContractError(final);
    if (err) {
      // Deterministic preconditions (EXPECTED) are a failed write; non-determinism
      // (LLM_ERROR) is the FR-4.3 soft-error / UNRESOLVED path with bonds returned.
      const softError = err.category === "LLM_ERROR";
      toast.error(titleFor(err.category), err.message);
      onProgress({
        state: softError ? "soft-error" : "failed",
        hash,
        detail: err.raw,
      });
    } else {
      onProgress({ state: "finalized", hash });
    }
  } catch (e: any) {
    const err = fromThrown(e);
    toast.error(titleFor(err.category), err.message);
    onProgress({ state: "failed", hash: e?.hash, detail: err.raw });
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
