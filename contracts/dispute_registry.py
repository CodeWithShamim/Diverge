# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# VERIFY: pin against `genlayer runners list` for the target GenVM before deploy.
#
# DisputeRegistry — dispute lifecycle for Diverge (PRD §4.1, FR-1, FR-4.1).
# ASSERTED -> CHALLENGED -> RESOLVING -> RESOLVED / APPEALED -> FINAL

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone

import genlayer as gl
from genlayer.types import *

# -- status / winner enums (u8) ------------------------------------------------
ASSERTED, CHALLENGED, RESOLVING, RESOLVED, APPEALED, FINAL = 0, 1, 2, 3, 4, 5
STATUS_NAMES = ["ASSERTED", "CHALLENGED", "RESOLVING", "RESOLVED", "APPEALED", "FINAL"]
W_NONE, A_WINS, B_WINS, UNRESOLVED = 0, 1, 2, 3
WINNER_NAMES = ["NONE", "A_WINS", "B_WINS", "UNRESOLVED"]

MAX_SUB_QUESTIONS = 8
APPEAL_WINDOW_SECS = 24 * 3600  # FR-5.1


def now_from_iso(iso: str) -> int:
    """Deterministic tx-datetime -> epoch seconds (gl.message.datetime is ISO 8601)."""
    try:
        return int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp())
    except (ValueError, AttributeError):
        return 0


def pin_ref_deterministic(ref: str) -> str:
    """Non-URL evidence (inline text, commit SHAs, block heights) pins to its own hash."""
    return "sha256:" + hashlib.sha256(ref.encode("utf-8")).hexdigest()


@gl.storage.allow
@dataclass
class Dispute:
    asserter: Address
    challenger: Address
    claim_a: str
    claim_b: str
    evidence_ref_a: str
    evidence_ref_b: str
    snapshot_a: str  # pinned content hash — set at challenge time (FR-4.1)
    snapshot_b: str
    bond: u256
    status: u8
    winner: u8
    uncontested: bool
    round: u8  # adjudication round: 1 = first verdict, 2 = appeal verdict (final)
    challenge_deadline: u64
    appeal_deadline: u64
    created_at: u64
    sub_questions: gl.DynArray[str]


@gl.contract.interface
class IStakeVault:
    class View:
        pass

    class Write:
        def lock(self, dispute_id: u256, side: u8, party: Address) -> None: ...
        def settle(self, dispute_id: u256, winner: u8, appellant: Address, flipped: bool) -> None: ...
        def release_uncontested(self, dispute_id: u256) -> None: ...


@gl.contract.interface
class IResolutionLog:
    class View:
        pass

    class Write:
        def record(
            self,
            dispute_id: u256,
            winner: u8,
            unresolved: bool,
            uncontested: bool,
            supports_vector: str,
            snapshot_a: str,
            snapshot_b: str,
            finalized_at: u64,
        ) -> None: ...


@gl.contract.interface
class IDiverge:
    class View:
        def get_verdict(self, dispute_id: u256) -> dict: ...

    class Write:
        pass


@gl.contract.interface
class IAppealManager:
    class View:
        def get_appeal(self, dispute_id: u256) -> dict: ...

    class Write:
        pass


class DisputeRegistry(gl.contract.Contract):
    disputes: gl.TreeMap[u256, Dispute]
    dispute_count: u256
    min_bond: u256
    challenge_window_secs: u64
    owner: Address
    arbiter: Address
    vault: Address
    log: Address
    appeals: Address
    wired: bool

    def __init__(self, min_bond: u256, challenge_window_secs: u64):
        self.dispute_count = 0
        self.min_bond = min_bond
        self.challenge_window_secs = challenge_window_secs
        self.owner = gl.message.sender_address
        self.arbiter = Address.ZERO
        self.vault = Address.ZERO
        self.log = Address.ZERO
        self.appeals = Address.ZERO
        self.wired = False

    # -- wiring (deployment order breaks the address cycle) --------------------

    @gl.public.write
    def wire(self, arbiter: Address, vault: Address, log: Address, appeals: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("EXPECTED: only owner can wire")
        if self.wired:
            raise Exception("EXPECTED: already wired")
        self.arbiter = arbiter
        self.vault = vault
        self.log = log
        self.appeals = appeals
        self.wired = True

    # -- FR-1.1 / FR-1.2 --------------------------------------------------------

    @gl.public.write.payable
    def assert_claim(self, claim: str, evidence_ref: str, sub_questions: list[str]) -> u256:
        if not self.wired:
            raise Exception("EXPECTED: registry not wired")
        if gl.message.value < self.min_bond:
            raise Exception("EXPECTED: bond below minimum")
        if not claim.strip():
            raise Exception("EXPECTED: empty claim")
        if not evidence_ref.strip():
            raise Exception("EXPECTED: empty evidence_ref")
        if len(sub_questions) < 1 or len(sub_questions) > MAX_SUB_QUESTIONS:
            raise Exception("EXPECTED: sub_questions must be 1-8")
        for q in sub_questions:
            if not q.strip():
                raise Exception("EXPECTED: empty sub-question")

        dispute_id = self.dispute_count
        self.dispute_count = dispute_id + 1
        now = now_from_iso(gl.message.raw["datetime"])

        d = Dispute(
            asserter=gl.message.sender_address,
            challenger=Address.ZERO,
            claim_a=claim,
            claim_b="",
            evidence_ref_a=evidence_ref,
            evidence_ref_b="",
            snapshot_a="",
            snapshot_b="",
            bond=gl.message.value,
            status=ASSERTED,
            winner=W_NONE,
            uncontested=False,
            round=0,
            challenge_deadline=now + self.challenge_window_secs,
            appeal_deadline=0,
            created_at=now,
            sub_questions=sub_questions,
        )
        self.disputes[dispute_id] = d

        # escrow the bond in the vault (message emitted at finality)
        vault = gl.contract.get_at(self.vault)
        vault.emit(value=gl.message.value).lock(dispute_id, 0, gl.message.sender_address)
        return dispute_id

    # -- FR-1.3 / FR-1.4 --------------------------------------------------------

    @gl.public.write.payable
    def challenge(self, dispute_id: u256, counter_claim: str, evidence_ref: str) -> None:
        d = self._get(dispute_id)
        now = now_from_iso(gl.message.raw["datetime"])
        if d.status != ASSERTED:
            raise Exception("EXPECTED: dispute not open for challenge")
        if now >= d.challenge_deadline:
            raise Exception("EXPECTED: challenge window closed")
        if gl.message.value != d.bond:
            raise Exception("EXPECTED: challenger bond must equal asserter bond")
        if gl.message.sender_address == d.asserter:
            raise Exception("EXPECTED: asserter cannot challenge own claim")
        if not counter_claim.strip() or not evidence_ref.strip():
            raise Exception("EXPECTED: empty counter-claim or evidence_ref")

        # FR-4.1 — pin both evidence refs to fixed snapshots so leader and
        # validators judge identical inputs. URLs are fetched once here and
        # pinned by content hash (strict_eq converges iff the content is stable).
        d.snapshot_a = self._pin(d.evidence_ref_a)
        d.snapshot_b = self._pin(evidence_ref)

        d.challenger = gl.message.sender_address
        d.claim_b = counter_claim
        d.evidence_ref_b = evidence_ref
        d.status = CHALLENGED

        vault = gl.contract.get_at(self.vault)
        vault.emit(value=gl.message.value).lock(dispute_id, 1, gl.message.sender_address)

    def _pin(self, ref: str) -> str:
        if not (ref.startswith("http://") or ref.startswith("https://")):
            return pin_ref_deterministic(ref)

        def fetch_hash() -> str:
            res = gl.nondet.web.get(ref)
            if res.status != 200 or not res.body:
                raise Exception(f"EXTERNAL: evidence unreachable status={res.status}")
            return "sha256:" + hashlib.sha256(res.body).hexdigest()

        return gl.eq_principle.strict_eq(fetch_hash)

    # -- FR-1.5 — uncontested assertion stands ---------------------------------

    @gl.public.write
    def finalize_uncontested(self, dispute_id: u256) -> None:
        d = self._get(dispute_id)
        now = now_from_iso(gl.message.raw["datetime"])
        if d.status != ASSERTED:
            raise Exception("EXPECTED: dispute is not an open assertion")
        if now < d.challenge_deadline:
            raise Exception("EXPECTED: challenge window still open")
        d.status = FINAL
        d.winner = A_WINS
        d.uncontested = True

        vault = gl.contract.get_at(self.vault)
        vault.emit().release_uncontested(dispute_id)
        log = gl.contract.get_at(self.log)
        log.emit().record(dispute_id, A_WINS, False, True, "", d.snapshot_a, "", now)

    # -- arbiter callbacks -------------------------------------------------------

    @gl.public.write
    def mark_resolving(self, dispute_id: u256) -> None:
        if gl.message.sender_address != self.arbiter:
            raise Exception("EXPECTED: only arbiter")
        d = self._get(dispute_id)
        if d.status not in (CHALLENGED, APPEALED):
            raise Exception("EXPECTED: dispute not challengeable state")
        d.status = RESOLVING

    @gl.public.write
    def record_verdict(self, dispute_id: u256, winner: u8, round: u8) -> None:
        if gl.message.sender_address != self.arbiter:
            raise Exception("EXPECTED: only arbiter")
        if winner not in (A_WINS, B_WINS, UNRESOLVED):
            raise Exception("EXPECTED: invalid winner enum")
        d = self._get(dispute_id)
        if d.status not in (CHALLENGED, RESOLVING, APPEALED):
            raise Exception("EXPECTED: dispute not resolving")
        now = now_from_iso(gl.message.raw["datetime"])
        d.winner = winner
        d.round = round
        d.status = RESOLVED
        # FR-5.1: 24h appeal window after first verdict; FR-5.3: second verdict is final
        d.appeal_deadline = 0 if round >= 2 else now + APPEAL_WINDOW_SECS

    @gl.public.write
    def mark_appealed(self, dispute_id: u256) -> None:
        if gl.message.sender_address != self.appeals:
            raise Exception("EXPECTED: only appeal manager")
        d = self._get(dispute_id)
        now = now_from_iso(gl.message.raw["datetime"])
        if d.status != RESOLVED or d.round >= 2:
            raise Exception("EXPECTED: dispute not appealable")
        if now >= d.appeal_deadline:
            raise Exception("EXPECTED: appeal window closed")
        d.status = APPEALED

    # -- finality: settle bonds + write the resolution log (FR-3) ----------------

    @gl.public.write
    def finalize(self, dispute_id: u256) -> None:
        d = self._get(dispute_id)
        now = now_from_iso(gl.message.raw["datetime"])
        if d.status != RESOLVED:
            raise Exception("EXPECTED: no verdict to finalize")
        if d.round < 2 and now < d.appeal_deadline:
            raise Exception("EXPECTED: appeal window still open")

        arbiter = gl.contract.get_at(self.arbiter)
        verdict = arbiter.view().get_verdict(dispute_id)

        appellant = Address.ZERO
        flipped = False
        if d.round >= 2:
            appeals = gl.contract.get_at(self.appeals)
            appeal = appeals.view().get_appeal(dispute_id)
            appellant = Address(appeal["appellant"])
            flipped = bool(appeal["pre_appeal_winner"] != d.winner)

        d.status = FINAL

        vault = gl.contract.get_at(self.vault)
        vault.emit().settle(dispute_id, d.winner, appellant, flipped)

        log = gl.contract.get_at(self.log)
        log.emit().record(
            dispute_id,
            d.winner,
            d.winner == UNRESOLVED,
            False,
            str(verdict.get("supports_vector", "")),
            d.snapshot_a,
            d.snapshot_b,
            now,
        )

    # -- views --------------------------------------------------------------------

    def _get(self, dispute_id: u256) -> Dispute:
        d = self.disputes.get(dispute_id)
        if d is None:
            raise Exception("EXPECTED: unknown dispute")
        return d

    @gl.public.view
    def get_dispute(self, dispute_id: u256) -> dict:
        d = self._get(dispute_id)
        return {
            "id": dispute_id,
            "asserter": f"{d.asserter:x}",
            "challenger": f"{d.challenger:x}",
            "claim_a": d.claim_a,
            "claim_b": d.claim_b,
            "evidence_ref_a": d.evidence_ref_a,
            "evidence_ref_b": d.evidence_ref_b,
            "snapshot_a": d.snapshot_a,
            "snapshot_b": d.snapshot_b,
            "bond": d.bond,
            "status": STATUS_NAMES[d.status],
            "winner": WINNER_NAMES[d.winner],
            "uncontested": d.uncontested,
            "round": d.round,
            "challenge_deadline": d.challenge_deadline,
            "appeal_deadline": d.appeal_deadline,
            "created_at": d.created_at,
            "sub_questions": list(d.sub_questions),
        }

    @gl.public.view
    def get_dispute_count(self) -> u256:
        return self.dispute_count

    @gl.public.view
    def get_board(self, offset: u256, limit: u256) -> list:
        out = []
        end = min(self.dispute_count, offset + min(limit, 50))
        i = offset
        while i < end:
            out.append(self.get_dispute(i))
            i += 1
        return out
