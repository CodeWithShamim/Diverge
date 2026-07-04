"""StakeVault settlement math — winner-takes-loser, fee, UNRESOLVED neutrality
(FR-3). All u256 integer math (FR-3.5)."""

import pytest

from genlayer import testing
from stake_vault import FEE_BPS, BPS_DENOM

from conftest import ASSERTER, CHALLENGER, STRANGER, OWNER, BOND


FEE = BOND * FEE_BPS // BPS_DENOM  # fee on the transferred (loser's) bond


def _resolved(world, llm, gt):
    llm(gt)
    did = world.assert_claim()
    world.challenge(did)
    world.resolve(did)
    testing.clear_transfers()
    return did


class TestSettlement:
    def test_a_wins_takes_loser_bond_minus_fee(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        world.finalize(did)
        assert testing.transfers_to(ASSERTER) == [BOND + BOND - FEE]  # FR-3.1
        assert testing.transfers_to(CHALLENGER) == []
        assert world.vault.get_fees_accrued() == FEE
        assert world.dispute(did)["status"] == "FINAL"

    def test_b_wins_takes_loser_bond_minus_fee(self, world, llm):
        did = _resolved(world, llm, ["B", "B", "NEITHER"])
        world.finalize(did)
        assert testing.transfers_to(CHALLENGER) == [BOND + BOND - FEE]  # FR-3.2
        assert testing.transfers_to(ASSERTER) == []
        assert world.vault.get_fees_accrued() == FEE

    def test_unresolved_returns_both_bonds_no_fee(self, world, llm):
        did = _resolved(world, llm, ["A", "B", "NEITHER"])
        world.finalize(did)
        # FR-3.3 — both bonds returned in full, no fee
        assert testing.transfers_to(ASSERTER) == [BOND]
        assert testing.transfers_to(CHALLENGER) == [BOND]
        assert world.vault.get_fees_accrued() == 0
        res = world.log.get_resolution(did)
        assert res["winner"] == "UNRESOLVED" and res["unresolved"] is True  # FR-6.4

    def test_double_settle_rejected(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        world.finalize(did)
        with pytest.raises(Exception, match="no verdict to finalize"):
            world.finalize(did)

    def test_finalize_before_appeal_window_close_rejected(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        with pytest.raises(Exception, match="appeal window still open"):
            world.finalize(did, at="2026-07-04T12:00:00+00:00")

    def test_resolution_log_written_on_finality(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "NEITHER"])
        world.finalize(did)
        res = world.log.get_resolution(did)  # FR-3.4 / FR-6.1
        assert res["winner"] == "A_WINS"
        assert res["supports_vector"] == "A,A,NEITHER"
        assert res["snapshot_a"].startswith("sha256:")
        assert world.log.is_final(did) is True  # FR-6.2

    def test_is_final_false_before_finality(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        assert world.log.is_final(did) is False


class TestFees:
    def test_withdraw_fees_owner_only(self, world, llm):
        did = _resolved(world, llm, ["A", "A", "A"])
        world.finalize(did)
        from genlayer.types import Address
        with testing.tx(sender=STRANGER):
            with pytest.raises(Exception, match="only owner"):
                world.vault.withdraw_fees(Address(STRANGER))
        testing.clear_transfers()
        with testing.tx(sender=OWNER):
            world.vault.withdraw_fees(Address(OWNER))
        assert testing.transfers_to(OWNER) == [FEE]
        assert world.vault.get_fees_accrued() == 0
