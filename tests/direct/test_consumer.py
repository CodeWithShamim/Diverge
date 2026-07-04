"""MockOptimisticOracle — the M6 consumer example settles its own game on a
finalized Diverge verdict via ResolutionLog (FR-6)."""

import pytest

from genlayer import testing
from conftest import CHALLENGER, STRANGER


def _finalized(world, llm, gt):
    llm(gt)
    did = world.assert_claim()
    world.challenge(did)
    world.resolve(did)
    world.finalize(did)
    return did


def _proposed(world, did, answer=True):
    with testing.tx(sender=STRANGER):
        rid = world.oracle.propose("Did the market settle above $2,400?", answer)
        world.oracle.link_dispute(rid, did)
    return rid


class TestConsumer:
    def test_a_wins_upholds_proposal(self, world, llm):
        did = _finalized(world, llm, ["A", "A", "A"])
        rid = _proposed(world, did, answer=True)
        with testing.tx(sender=STRANGER):
            assert world.oracle.settle(rid) == "SETTLED_TRUE"

    def test_b_wins_flips_proposal(self, world, llm):
        did = _finalized(world, llm, ["B", "B", "A"])
        rid = _proposed(world, did, answer=True)
        with testing.tx(sender=STRANGER):
            assert world.oracle.settle(rid) == "SETTLED_FALSE"

    def test_unresolved_voids_never_mistaken_for_verdict(self, world, llm):
        # FR-6.4 — consumers must see UNRESOLVED explicitly, not a winner
        did = _finalized(world, llm, ["A", "B", "NEITHER"])
        rid = _proposed(world, did, answer=True)
        with testing.tx(sender=STRANGER):
            assert world.oracle.settle(rid) == "VOID"

    def test_settle_before_finality_rejected(self, world, llm):
        llm(["A", "A", "A"])
        did = world.assert_claim()
        world.challenge(did)
        world.resolve(did)  # verdict exists but not finalized
        rid = _proposed(world, did)
        with testing.tx(sender=STRANGER):
            with pytest.raises(Exception, match="not final yet"):
                world.oracle.settle(rid)
