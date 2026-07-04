"""DisputeRegistry lifecycle, access control, and pinning (FR-1, FR-4.1)."""

import pytest

from genlayer import testing
from conftest import (
    ASSERTER, CHALLENGER, STRANGER, BOND, MIN_BOND,
    T0, T_CHALLENGE, T_AFTER_WINDOW, SUB_QUESTIONS, EVIDENCE_A, EVIDENCE_B,
)


class TestAssertClaim:
    def test_creates_asserted_dispute(self, world):
        did = world.assert_claim()
        d = world.dispute(did)
        assert d["status"] == "ASSERTED"
        assert d["claim_a"].startswith("The market settled above")
        assert d["bond"] == BOND
        assert d["sub_questions"] == SUB_QUESTIONS
        assert d["snapshot_a"] == ""  # pinning happens at challenge time

    def test_bond_locked_in_vault(self, world):
        did = world.assert_claim()
        lock = world.vault.get_lock(did)
        assert lock["bond_a"] == BOND
        assert lock["asserter"] == ASSERTER

    def test_bond_below_minimum_rejected(self, world):
        with pytest.raises(Exception, match="bond below minimum"):
            world.assert_claim(bond=MIN_BOND - 1)

    def test_empty_sub_questions_rejected(self, world):
        with pytest.raises(Exception, match="sub_questions must be 1-8"):
            world.assert_claim(subs=[])

    def test_more_than_eight_sub_questions_rejected(self, world):
        with pytest.raises(Exception, match="sub_questions must be 1-8"):
            world.assert_claim(subs=[f"q{i}?" for i in range(9)])

    def test_blank_sub_question_rejected(self, world):
        with pytest.raises(Exception, match="empty sub-question"):
            world.assert_claim(subs=["real question?", "   "])


class TestChallenge:
    def test_converts_to_challenged_and_pins(self, world):
        did = world.assert_claim()
        world.challenge(did)
        d = world.dispute(did)
        assert d["status"] == "CHALLENGED"
        assert d["claim_b"].startswith("The market settled below")
        # FR-4.1 — inline evidence pinned to its content hash
        assert d["snapshot_a"].startswith("sha256:")
        assert d["snapshot_b"].startswith("sha256:")
        assert d["snapshot_a"] != d["snapshot_b"]

    def test_both_bonds_locked(self, world):
        did = world.assert_claim()
        world.challenge(did)
        lock = world.vault.get_lock(did)
        assert lock["bond_a"] == BOND and lock["bond_b"] == BOND
        assert lock["challenger"] == CHALLENGER

    def test_mismatched_bond_rejected(self, world):
        did = world.assert_claim()
        with pytest.raises(Exception, match="must equal asserter bond"):
            world.challenge(did, bond=BOND - 1)

    def test_after_window_rejected(self, world):
        did = world.assert_claim()
        with pytest.raises(Exception, match="window closed"):
            world.challenge(did, at=T_AFTER_WINDOW)

    def test_self_challenge_rejected(self, world):
        did = world.assert_claim()
        with pytest.raises(Exception, match="cannot challenge own claim"):
            world.challenge(did, sender=ASSERTER)

    def test_double_challenge_rejected(self, world):
        did = world.assert_claim()
        world.challenge(did)
        with pytest.raises(Exception, match="not open for challenge"):
            world.challenge(did, sender=STRANGER)


class TestUncontested:
    def test_stands_by_default_after_window(self, world):
        did = world.assert_claim()
        with testing.tx(sender=STRANGER, at=T_AFTER_WINDOW):
            world.registry.finalize_uncontested(did)
        d = world.dispute(did)
        assert d["status"] == "FINAL"
        assert d["winner"] == "A_WINS"
        assert d["uncontested"] is True
        # bond returned in full (FR-1.5)
        assert testing.transfers_to(ASSERTER) == [BOND]
        # logged as uncontested (FR-6.4 flag semantics)
        res = world.log.get_resolution(did)
        assert res["winner"] == "A_WINS" and res["uncontested"] is True

    def test_before_window_close_rejected(self, world):
        did = world.assert_claim()
        with testing.tx(sender=STRANGER, at=T_CHALLENGE):
            with pytest.raises(Exception, match="window still open"):
                world.registry.finalize_uncontested(did)


class TestAccessControl:
    def test_record_verdict_only_arbiter(self, world):
        did = world.assert_claim()
        world.challenge(did)
        with testing.tx(sender=STRANGER):
            with pytest.raises(Exception, match="only arbiter"):
                world.registry.record_verdict(did, 1, 1)

    def test_mark_appealed_only_appeal_manager(self, world):
        did = world.assert_claim()
        with testing.tx(sender=STRANGER):
            with pytest.raises(Exception, match="only appeal manager"):
                world.registry.mark_appealed(did)

    def test_vault_lock_only_registry(self, world):
        from genlayer.types import Address
        with testing.tx(sender=STRANGER, value=100):
            with pytest.raises(Exception, match="only registry"):
                world.vault.lock(0, 0, Address(STRANGER))

    def test_wire_only_once(self, world):
        from genlayer.types import Address
        from conftest import OWNER, ARB, VLT, LOG, APL
        with testing.tx(sender=OWNER):
            with pytest.raises(Exception, match="already wired"):
                world.registry.wire(Address(ARB), Address(VLT), Address(LOG), Address(APL))

    def test_finalize_without_verdict_rejected(self, world):
        did = world.assert_claim()
        world.challenge(did)
        with pytest.raises(Exception, match="no verdict to finalize"):
            world.finalize(did)
