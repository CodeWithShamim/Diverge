/** Turns a GenLayer receipt (or a thrown wallet/RPC error) into a human message.
 *
 *  When a contract raises, the tx still FINALIZES but the leader receipt carries
 *  execution_result === "ERROR" and the message lives in genvm_result.stderr as a
 *  Python traceback whose last line is `Exception: EXPECTED: only a dispute party
 *  can appeal`. genlayer-js keeps leader_receipt as an ARRAY, so the field must be
 *  read off an element — reading it off the array yields undefined (the reason the
 *  ladder used to show a reverted tx as a clean "finalized"). */

/** FR-4.2 taxonomy — deterministic string-prefix classification, mirrors
 *  contracts/diverge.py::classify_error. Unprefixed ⇒ LLM_ERROR (non-determinism). */
export type ErrorCategory = "EXPECTED" | "EXTERNAL" | "TRANSIENT" | "LLM_ERROR";

export interface ContractError {
  category: ErrorCategory;
  /** Clean, prefix-stripped sentence for humans. */
  message: string;
  /** The full contract message incl. the taxonomy prefix, e.g. "EXPECTED: …". */
  raw: string;
}

const CATEGORIES: ErrorCategory[] = ["EXPECTED", "EXTERNAL", "TRANSIENT", "LLM_ERROR"];

function classify(message: string): ErrorCategory {
  for (const prefix of CATEGORIES) {
    if (message.startsWith(prefix + ":")) return prefix;
  }
  return "LLM_ERROR";
}

/** Pull the contract's message out of a genvm stderr traceback. The signal line
 *  is the last `Exception: …` (or any `SomeError: …`) line Python prints. */
function fromStderr(stderr: string): string | null {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^(?:[A-Za-z_][\w.]*Error|Exception):\s*(.+)$/);
    if (m) return m[1].trim();
  }
  return lines.length ? lines[lines.length - 1] : null;
}

/** Normalize leader_receipt (array | object | undefined) to the errored element. */
function erroredReceipt(tx: any): any | null {
  const lr = tx?.consensus_data?.leader_receipt;
  const receipts = Array.isArray(lr) ? lr : lr ? [lr] : [];
  return (
    receipts.find((r) => r?.execution_result === "ERROR") ??
    (receipts.some((r) => r?.execution_result === "SUCCESS") ? null : (receipts[0] ?? null))
  );
}

/** Inspect a finalized receipt. Returns a ContractError iff the contract reverted,
 *  else null (the tx genuinely succeeded). */
export function extractContractError(tx: any): ContractError | null {
  const receipt = erroredReceipt(tx);
  if (!receipt || receipt.execution_result !== "ERROR") return null;

  const stderr: string = receipt?.genvm_result?.stderr ?? "";
  const raw =
    (stderr && fromStderr(stderr)) ||
    (typeof receipt?.genvm_result?.stdout === "string" && receipt.genvm_result.stdout.trim()) ||
    "Contract execution failed";

  return { category: classify(raw), message: stripPrefix(raw), raw };
}

function stripPrefix(raw: string): string {
  const cleaned = raw.replace(/^(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR):\s*/, "").trim();
  return cleaned || raw;
}

/** A wallet rejection / RPC error that surfaced as a thrown exception rather than
 *  a finalized ERROR receipt (e.g. user declined signing, network drop, or
 *  genlayer-js decoding a revert reason). Best-effort humanization. */
export function fromThrown(e: any): ContractError {
  const msg = String(e?.shortMessage ?? e?.message ?? e ?? "Unknown error");

  // A revert reason genlayer-js/viem already surfaced in the throw message.
  const reverted = msg.match(/(EXPECTED|EXTERNAL|TRANSIENT|LLM_ERROR):\s*.+/);
  if (reverted) {
    const raw = reverted[0];
    return { category: classify(raw), message: stripPrefix(raw), raw };
  }

  if (/user rejected|user denied|rejected the request|4001/i.test(msg)) {
    return { category: "EXPECTED", message: "You declined the transaction.", raw: msg };
  }
  if (/insufficient funds|insufficient balance/i.test(msg)) {
    return { category: "EXPECTED", message: "Insufficient balance for this bond.", raw: msg };
  }
  if (/Connect a wallet/i.test(msg)) {
    return { category: "EXPECTED", message: msg, raw: msg };
  }

  return { category: "TRANSIENT", message: msg, raw: msg };
}

/** Short toast title per taxonomy — sets the tone before the message is read. */
export function titleFor(category: ErrorCategory): string {
  switch (category) {
    case "EXPECTED":
      return "Transaction rejected";
    case "EXTERNAL":
      return "Evidence problem";
    case "TRANSIENT":
      return "Temporary failure";
    case "LLM_ERROR":
      return "Validators didn't converge";
  }
}
