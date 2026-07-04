# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# VERIFY: pin against `genlayer runners list` for the target GenVM before deploy.
#
# StakeVault — bonds, winner-takes-loser settlement, protocol fee (PRD FR-3, FR-5.4).
# All money math is u256 integer arithmetic (FR-3.5).

from dataclasses import dataclass

import genlayer as gl
from genlayer.types import *

W_NONE, A_WINS, B_WINS, UNRESOLVED = 0, 1, 2, 3

FEE_BPS = 200          # 2% protocol fee on the transferred (loser's) bond
BPS_DENOM = 10_000


@gl.storage.allow
@dataclass
class Lock:
    asserter: Address
    challenger: Address
    bond_a: u256
    bond_b: u256
    appellant: Address
    appeal_bond: u256
    settled: bool


class StakeVault(gl.contract.Contract):
    locks: gl.TreeMap[u256, Lock]
    fees_accrued: u256
    owner: Address
    registry: Address
    appeals: Address
    wired: bool

    def __init__(self):
        self.owner = gl.message.sender_address
        self.registry = Address.ZERO
        self.appeals = Address.ZERO
        self.fees_accrued = 0
        self.wired = False

    @gl.public.write
    def wire(self, registry: Address, appeals: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("EXPECTED: only owner can wire")
        if self.wired:
            raise Exception("EXPECTED: already wired")
        self.registry = registry
        self.appeals = appeals
        self.wired = True

    # -- escrow -------------------------------------------------------------------

    @gl.public.write.payable
    def lock(self, dispute_id: u256, side: u8, party: Address) -> None:
        """side 0 = asserter, 1 = challenger. Only callable by the registry."""
        if gl.message.sender_address != self.registry:
            raise Exception("EXPECTED: only registry")
        if gl.message.value == 0:
            raise Exception("EXPECTED: zero bond")
        rec = self.locks.get(dispute_id)
        if rec is None:
            rec = Lock(
                asserter=Address.ZERO, challenger=Address.ZERO,
                bond_a=0, bond_b=0,
                appellant=Address.ZERO, appeal_bond=0, settled=False,
            )
            self.locks[dispute_id] = rec
            rec = self.locks[dispute_id]
        if side == 0:
            if rec.bond_a != 0:
                raise Exception("EXPECTED: asserter bond already locked")
            rec.asserter = party
            rec.bond_a = gl.message.value
        elif side == 1:
            if rec.bond_b != 0:
                raise Exception("EXPECTED: challenger bond already locked")
            rec.challenger = party
            rec.bond_b = gl.message.value
        else:
            raise Exception("EXPECTED: invalid side")

    @gl.public.write.payable
    def lock_appeal(self, dispute_id: u256, appellant: Address) -> None:
        """FR-5.2 — appeal bond escrow. Only callable by the appeal manager."""
        if gl.message.sender_address != self.appeals:
            raise Exception("EXPECTED: only appeal manager")
        rec = self._get(dispute_id)
        if rec.appeal_bond != 0:
            raise Exception("EXPECTED: appeal bond already locked")
        if gl.message.value == 0:
            raise Exception("EXPECTED: zero appeal bond")
        rec.appellant = appellant
        rec.appeal_bond = gl.message.value

    # -- settlement (FR-3.1..3.3, FR-5.4) ------------------------------------------

    @gl.public.write
    def settle(self, dispute_id: u256, winner: u8, appellant: Address, flipped: bool) -> None:
        if gl.message.sender_address != self.registry:
            raise Exception("EXPECTED: only registry")
        rec = self._get(dispute_id)
        if rec.settled:
            raise Exception("EXPECTED: already settled")
        rec.settled = True

        pay_a: u256 = 0
        pay_b: u256 = 0
        if winner == A_WINS:
            fee = rec.bond_b * FEE_BPS // BPS_DENOM
            self.fees_accrued += fee
            pay_a = rec.bond_a + rec.bond_b - fee
        elif winner == B_WINS:
            fee = rec.bond_a * FEE_BPS // BPS_DENOM
            self.fees_accrued += fee
            pay_b = rec.bond_a + rec.bond_b - fee
        elif winner == UNRESOLVED:
            # FR-3.3 — both bonds returned in full, no fee
            pay_a = rec.bond_a
            pay_b = rec.bond_b
        else:
            raise Exception("EXPECTED: invalid winner")

        # FR-5.4 — appeal bond: flips => appellant refunded + counterparty pays
        # the same amount out of their payout; upheld => forfeited to counterparty.
        if rec.appeal_bond != 0:
            appellant_is_a = rec.appellant == rec.asserter
            if flipped:
                penalty = rec.appeal_bond
                if appellant_is_a:
                    taken = min(penalty, pay_b)
                    pay_b -= taken
                    pay_a += rec.appeal_bond + taken
                else:
                    taken = min(penalty, pay_a)
                    pay_a -= taken
                    pay_b += rec.appeal_bond + taken
            else:
                if appellant_is_a:
                    pay_b += rec.appeal_bond
                else:
                    pay_a += rec.appeal_bond

        if pay_a > 0:
            gl.chain.Account(rec.asserter).emit_transfer(pay_a)
        if pay_b > 0:
            gl.chain.Account(rec.challenger).emit_transfer(pay_b)

    @gl.public.write
    def release_uncontested(self, dispute_id: u256) -> None:
        """FR-1.5 — unchallenged assertion: bond returned in full, no fee."""
        if gl.message.sender_address != self.registry:
            raise Exception("EXPECTED: only registry")
        rec = self._get(dispute_id)
        if rec.settled:
            raise Exception("EXPECTED: already settled")
        if rec.bond_b != 0:
            raise Exception("EXPECTED: dispute was challenged")
        rec.settled = True
        gl.chain.Account(rec.asserter).emit_transfer(rec.bond_a)

    @gl.public.write
    def withdraw_fees(self, to: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("EXPECTED: only owner")
        amount = self.fees_accrued
        if amount == 0:
            raise Exception("EXPECTED: no fees accrued")
        self.fees_accrued = 0
        gl.chain.Account(to).emit_transfer(amount)

    # -- views ----------------------------------------------------------------------

    def _get(self, dispute_id: u256) -> Lock:
        rec = self.locks.get(dispute_id)
        if rec is None:
            raise Exception("EXPECTED: unknown dispute")
        return rec

    @gl.public.view
    def get_lock(self, dispute_id: u256) -> dict:
        rec = self._get(dispute_id)
        return {
            "asserter": f"{rec.asserter:x}",
            "challenger": f"{rec.challenger:x}",
            "bond_a": rec.bond_a,
            "bond_b": rec.bond_b,
            "appellant": f"{rec.appellant:x}",
            "appeal_bond": rec.appeal_bond,
            "settled": rec.settled,
        }

    @gl.public.view
    def get_fees_accrued(self) -> u256:
        return self.fees_accrued
