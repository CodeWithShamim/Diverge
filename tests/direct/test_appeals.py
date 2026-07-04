"""AppealManager — bonded appeals, re-adjudication, appeal-bond settlement (FR-5)."""

import pytest

from genlayer import testing
from stake_vault import FEE_BPS, BPS_DENOM

from conftest import ASSERTER, CHALLENGER, STRANGER, BOND

APPEAL_BOND = BOND // 2  # FR-5.2 — 50% of original bond
FEE = BOND * FEE_BPS // BPS_DENOM

T_APPEAL = "2026-07-04T12:00:00+00:00"           # inside the 24h window
T_APPEAL_LATE = "2026-07-05T01:00:00+00:00"      # window closed
T_FINAL = "2026-07-05T02:00:00+00:00"


def _resolved(world, llm, gt):
    llm(gt)
    did = world.assert_claim()
    world.challenge(did)
    world.resolve(did)
    return did


class TestAppealGuards:
    def test_wrong_bond_rejected(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        with pytest.raises(Exception, match="appeal bond must be exactly"):
            world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND - 1, at=T_APPEAL)

    def test_non_party_rejected(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        with pytest.raises(Exception, match="only a dispute party"):
            world.appeal(did, sender=STRANGER, bond=APPEAL_BOND, at=T_APPEAL)

    def test_after_window_rejected(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        with pytest.raises(Exception, match="appeal window closed"):
            world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND, at=T_APPEAL_LATE)

    def test_unresolved_dispute_no_appeal_target(self, world, llm):
        # UNRESOLVED is still RESOLVED-status and appealable by design;
        # a party who believes the evidence was decisive can force round 2.
        did = _resolved(world, llm, ["A", "B", "NEITHER"])
        world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND, at=T_APPEAL)
        # re-adjudication runs synchronously in the mock: round 2 verdict lands
        d = world.dispute(did)
        assert d["round"] == 2 and d["status"] == "RESOLVED"


class TestAppealFlow:
    def test_flip_appellant_wins(self, world, llm):
        """Round 1: A wins. Challenger appeals; round 2 flips to B.
        FR-5.4 — appeal bond returned; counterparty pays it (clamped to payout)."""
        did = _resolved(world, llm, ["A", "A", "NEITHER"])
        llm(["B", "B", "NEITHER"])  # fresh round sees it differently
        world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND, at=T_APPEAL)

        d = world.dispute(did)
        assert d["status"] == "RESOLVED" and d["winner"] == "B_WINS" and d["round"] == 2
        assert d["appeal_deadline"] == 0  # FR-5.3 — second verdict is final

        testing.clear_transfers()
        world.finalize(did, at=T_FINAL)
        # loser (asserter) payout is 0, so the counterparty penalty clamps to 0;
        # appellant gets both bonds minus fee, plus the appeal bond back.
        assert testing.transfers_to(CHALLENGER) == [BOND + BOND - FEE + APPEAL_BOND]
        assert testing.transfers_to(ASSERTER) == []

    def test_upheld_appellant_forfeits(self, world, llm):
        """Round 1 and round 2 both: A wins. Challenger's appeal bond is
        forfeited to the counterparty (FR-5.4)."""
        did = _resolved(world, llm, ["A", "A", "A"])
        world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND, at=T_APPEAL)

        d = world.dispute(did)
        assert d["winner"] == "A_WINS" and d["round"] == 2

        testing.clear_transfers()
        world.finalize(did, at=T_FINAL)
        assert testing.transfers_to(ASSERTER) == [BOND + BOND - FEE + APPEAL_BOND]
        assert testing.transfers_to(CHALLENGER) == []

    def test_flip_to_unresolved_counterparty_pays_from_returned_bond(self, world, llm):
        """Round 1: A wins. Round 2: UNRESOLVED (a flip). Bonds are returned;
        the appellant's bond comes back plus the penalty from the counterparty's
        returned bond."""
        did = _resolved(world, llm, ["A", "A", "NEITHER"])
        llm(["A", "B", "NEITHER"])
        world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND, at=T_APPEAL)
        assert world.dispute(did)["winner"] == "UNRESOLVED"

        testing.clear_transfers()
        world.finalize(did, at=T_FINAL)
        assert testing.transfers_to(CHALLENGER) == [BOND + APPEAL_BOND + APPEAL_BOND]
        assert testing.transfers_to(ASSERTER) == [BOND - APPEAL_BOND]
        assert world.vault.get_fees_accrued() == 0

    def test_second_appeal_rejected(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        world.appeal(did, sender=CHALLENGER, bond=APPEAL_BOND, at=T_APPEAL)
        with pytest.raises(Exception, match="already appealed"):
            world.appeal(did, sender=ASSERTER, bond=APPEAL_BOND, at=T_APPEAL)

    def test_asserter_can_appeal_too(self, world, llm):
        did = _resolved(world, llm, ["B", "B", "B"])
        llm(["B", "B", "A"])  # upheld on re-adjudication
        world.appeal(did, sender=ASSERTER, bond=APPEAL_BOND, at=T_APPEAL)
        testing.clear_transfers()
        world.finalize(did, at=T_FINAL)
        assert testing.transfers_to(CHALLENGER) == [BOND + BOND - FEE + APPEAL_BOND]
        assert testing.transfers_to(ASSERTER) == []
