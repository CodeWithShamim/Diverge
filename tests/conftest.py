"""Direct-test harness: mocked genlayer SDK + a fully wired 5-contract world."""

import pathlib
import re
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests" / "mocks"))
sys.path.insert(0, str(ROOT / "contracts"))

import genlayer  # noqa: E402 — the mock package above
from genlayer import testing  # noqa: E402

import appeal_manager  # noqa: E402
import dispute_registry  # noqa: E402
import diverge  # noqa: E402
import mock_optimistic_oracle  # noqa: E402
import resolution_log  # noqa: E402
import stake_vault  # noqa: E402

OWNER = "0x" + "aa" * 20
ASSERTER = "0x" + "a1" * 20
CHALLENGER = "0x" + "b2" * 20
STRANGER = "0x" + "cc" * 20

REG = "0x" + "01" * 20
ARB = "0x" + "02" * 20
VLT = "0x" + "03" * 20
LOG = "0x" + "04" * 20
APL = "0x" + "05" * 20
ORC = "0x" + "06" * 20

MIN_BOND = 100
BOND = 5_000
CHALLENGE_WINDOW = 3600

T0 = "2026-07-04T00:00:00+00:00"
T_CHALLENGE = "2026-07-04T00:10:00+00:00"
T_RESOLVE = "2026-07-04T00:20:00+00:00"
T_AFTER_WINDOW = "2026-07-04T02:00:00+00:00"
T_AFTER_APPEAL = "2026-07-05T01:00:00+00:00"

CLAIM_A = "The market settled above $2,400 at expiry."
CLAIM_B = "The market settled below $2,400 at expiry."
EVIDENCE_A = "exchange close prints: 2,412.55 at expiry block"
EVIDENCE_B = "a screenshot alleging 2,388.10 at expiry"
SUB_QUESTIONS = [
    "Did settlement occur before the expiry deadline?",
    "Does the primary source confirm a price above $2,400?",
    "Is the cited price source authoritative for this market?",
]


class World:
    def __init__(self):
        testing.reset()
        Address = genlayer.Address
        self.registry = testing.deploy(
            dispute_registry.DisputeRegistry, REG, MIN_BOND, CHALLENGE_WINDOW, sender=OWNER
        )
        self.arbiter = testing.deploy(diverge.Diverge, ARB, sender=OWNER)
        self.vault = testing.deploy(stake_vault.StakeVault, VLT, sender=OWNER)
        self.log = testing.deploy(resolution_log.ResolutionLog, LOG, sender=OWNER)
        self.appeals = testing.deploy(appeal_manager.AppealManager, APL, sender=OWNER)
        self.oracle = testing.deploy(
            mock_optimistic_oracle.MockOptimisticOracle, ORC, Address(LOG), sender=OWNER
        )
        with testing.tx(sender=OWNER):
            self.registry.wire(Address(ARB), Address(VLT), Address(LOG), Address(APL))
            self.arbiter.wire(Address(REG), Address(APL))
            self.vault.wire(Address(REG), Address(APL))
            self.log.wire(Address(REG))
            self.appeals.wire(Address(REG), Address(VLT), Address(ARB))

    # -- flow helpers ------------------------------------------------------------

    def assert_claim(self, claim=CLAIM_A, evidence=EVIDENCE_A, subs=None,
                     sender=ASSERTER, bond=BOND, at=T0):
        with testing.tx(sender=sender, value=bond, at=at):
            return self.registry.assert_claim(
                claim, evidence, list(SUB_QUESTIONS) if subs is None else subs
            )

    def challenge(self, dispute_id, claim=CLAIM_B, evidence=EVIDENCE_B,
                  sender=CHALLENGER, bond=BOND, at=T_CHALLENGE):
        with testing.tx(sender=sender, value=bond, at=at):
            self.registry.challenge(dispute_id, claim, evidence)

    def resolve(self, dispute_id, at=T_RESOLVE, sender=STRANGER):
        with testing.tx(sender=sender, at=at):
            return self.arbiter.resolve(dispute_id)

    def finalize(self, dispute_id, at=T_AFTER_APPEAL, sender=STRANGER):
        with testing.tx(sender=sender, at=at):
            self.registry.finalize(dispute_id)

    def appeal(self, dispute_id, sender, bond, at="2026-07-04T12:00:00+00:00"):
        with testing.tx(sender=sender, value=bond, at=at):
            self.appeals.appeal(dispute_id)

    def dispute(self, dispute_id):
        return self.registry.get_dispute(dispute_id)


@pytest.fixture
def world():
    return World()


def make_content_llm(gt_supports, claim_a_text=CLAIM_A, confidence="HIGH"):
    """A mock LLM that judges by claim CONTENT, not by presentation position.

    gt_supports is the ground truth in the A/B frame (e.g. ["A", "A", "NEITHER"]).
    The mock detects which side was presented as 'Claim 1' from the prompt and
    answers in the normalized CLAIM_1/CLAIM_2 frame — so a correct verdict must
    survive either presentation order (order-swap stability, NFR-3a).
    """

    def exec_prompt(prompt, **kwargs):
        m = re.search(r"^Claim 1: (.*)$", prompt, re.MULTILINE)
        assert m, "prompt missing neutral 'Claim 1' label"
        swapped = m.group(1).strip() != claim_a_text.strip()
        sub = []
        for i, side in enumerate(gt_supports):
            if side == "NEITHER":
                s = "NEITHER"
            elif side == "A":
                s = "CLAIM_2" if swapped else "CLAIM_1"
            else:
                s = "CLAIM_1" if swapped else "CLAIM_2"
            sub.append({"index": i, "answer": True, "supports": s,
                        "reason": f"evidence favors side {side}"})
        return {"sub_results": sub, "confidence": confidence}

    return exec_prompt


@pytest.fixture
def llm(monkeypatch):
    """Install a content-grounded mock LLM; returns a setter for the ground truth."""

    def install(gt_supports, claim_a_text=CLAIM_A):
        monkeypatch.setattr(
            genlayer.nondet, "exec_prompt", make_content_llm(gt_supports, claim_a_text)
        )

    return install
