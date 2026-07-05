# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

#
# ResolutionLog — the product surface (PRD FR-6). Finalized verdicts, queryable
# by external contracts in one gas-cheap view call.

from dataclasses import dataclass

from genlayer import *

ADDR_ZERO = Address(b"\x00" * 20)

W_NONE, A_WINS, B_WINS, UNRESOLVED = 0, 1, 2, 3
WINNER_NAMES = ["NONE", "A_WINS", "B_WINS", "UNRESOLVED"]


@allow_storage
@dataclass
class Resolution:
    winner: u8
    unresolved: bool     # FR-6.4 — explicit flag so consumers never mistake it for a verdict
    uncontested: bool    # FR-1.5 — A_WINS by default (no challenger)
    supports_vector: str
    snapshot_a: str
    snapshot_b: str
    finalized_at: u64


class ResolutionLog(gl.Contract):
    resolutions: TreeMap[u256, Resolution]
    count: u256
    owner: Address
    registry: Address
    wired: bool

    def __init__(self):
        self.owner = gl.message.sender_address
        self.registry = ADDR_ZERO
        self.count = 0
        self.wired = False

    @gl.public.write
    def wire(self, registry: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("EXPECTED: only owner can wire")
        if self.wired:
            raise Exception("EXPECTED: already wired")
        self.registry = registry
        self.wired = True

    @gl.public.write
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
    ) -> None:
        if gl.message.sender_address != self.registry:
            raise Exception("EXPECTED: only registry")
        if dispute_id in self.resolutions:
            raise Exception("EXPECTED: resolution already recorded")
        if winner not in (A_WINS, B_WINS, UNRESOLVED):
            raise Exception("EXPECTED: invalid winner enum")
        self.resolutions[dispute_id] = Resolution(
            winner=winner,
            unresolved=unresolved,
            uncontested=uncontested,
            supports_vector=supports_vector,
            snapshot_a=snapshot_a,
            snapshot_b=snapshot_b,
            finalized_at=finalized_at,
        )
        self.count += 1

    # -- FR-6.1..6.3 — the external read surface -----------------------------------

    @gl.public.view
    def get_resolution(self, dispute_id: u256) -> dict:
        r = self.resolutions.get(dispute_id)
        if r is None:
            raise Exception("EXPECTED: no finalized resolution")
        return {
            "dispute_id": dispute_id,
            "winner": WINNER_NAMES[r.winner],
            "unresolved": r.unresolved,
            "uncontested": r.uncontested,
            "supports_vector": r.supports_vector,
            "snapshot_a": r.snapshot_a,
            "snapshot_b": r.snapshot_b,
            "finalized_at": r.finalized_at,
        }

    @gl.public.view
    def is_final(self, dispute_id: u256) -> bool:
        return dispute_id in self.resolutions

    @gl.public.view
    def get_count(self) -> u256:
        return self.count
