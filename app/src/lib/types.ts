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

/** What arbiter.get_verdict yields, mapped into the sub-result shape the detail
 *  view renders. Hydrated onto a Dispute after adjudication (both mock + real). */
export interface VerdictHydration {
  subResults: SubResult[];
  confidence: Dispute["confidence"];
  round: number;
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

/** FR-4.2 — arbiter.get_retry_state: the soft-error / retry taxonomy surfaced
 *  so a stuck adjudication explains itself instead of looking hung. */
export interface RetryState {
  attempts: number;
  lastError: string;
  nextRetryAt: number; // epoch secs; 0 = no retry scheduled
}

/** FR-3 — vault.get_lock: the escrowed bond breakdown for a dispute. */
export interface Lock {
  asserter: string;
  challenger: string;
  bondA: number; // GEN
  bondB: number; // GEN
  appellant: string;
  appealBond: number; // GEN
  settled: boolean;
}

/** FR-5 — appeals.get_appeal: who appealed, the 50% bond, and the pre-appeal
 *  winner used for flip detection at settlement. */
export interface Appeal {
  disputeId: number;
  appellant: string;
  bond: number; // GEN
  preAppealWinner: Winner;
  createdAt: number;
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
