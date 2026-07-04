export type DisputeStatus =
  | "ASSERTED"
  | "CHALLENGED"
  | "RESOLVING"
  | "RESOLVED"
  | "APPEALED"
  | "FINAL";

export type Winner = "NONE" | "A_WINS" | "B_WINS" | "UNRESOLVED";

export type Supports = "A" | "B" | "NEITHER";

export interface SubResult {
  index: number;
  question: string;
  supports: Supports | null; // null pre-verdict
  answer: boolean | null;
  reason: string; // testimony — only `supports` is consensus data
}

export interface Dispute {
  id: number;
  status: DisputeStatus;
  winner: Winner;
  uncontested: boolean;
  round: number;
  claimA: string;
  claimB: string;
  asserter: string;
  challenger: string;
  bond: number; // GEN
  evidenceRefA: string;
  evidenceRefB: string;
  snapshotA: string; // pinned content hash — the honesty layer
  snapshotB: string;
  subQuestions: string[];
  subResults: SubResult[] | null;
  confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  challengeDeadline: number; // epoch secs
  appealDeadline: number;
  createdAt: number;
}

export interface Resolution {
  disputeId: number;
  winner: Winner;
  unresolved: boolean;
  uncontested: boolean;
  supportsVector: string;
  snapshotA: string;
  snapshotB: string;
  finalizedAt: number;
}

/** FR-7.2 — the full transaction state ladder, never a toast. */
export type TxState =
  | "idle"
  | "submitted"
  | "pending"
  | "accepted"
  | "finalized"
  | "failed"
  | "soft-error";

export interface TxProgress {
  state: TxState;
  hash?: string;
  detail?: string; // e.g. "UNRESOLVED · bonds returned" on soft error
}
