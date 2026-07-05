# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

#
# AppealManager — bonded appeals + re-adjudication (PRD FR-5).

from dataclasses import dataclass

from genlayer import *

ADDR_ZERO = Address(b"\x00" * 20)

W_NONE, A_WINS, B_WINS, UNRESOLVED = 0, 1, 2, 3
WINNER_ENUM = {"NONE": 0, "A_WINS": 1, "B_WINS": 2, "UNRESOLVED": 3}

APPEAL_BOND_BPS = 5_000  # FR-5.2 — 50% of the original bond
BPS_DENOM = 10_000


@allow_storage
@dataclass
class Appeal:
    appellant: Address
    bond: u256
    pre_appeal_winner: u8  # winner before re-adjudication — flip detection (FR-5.4)
    created_at: u64


@gl.contract_interface
class IDisputeRegistry:
    class View:
        def get_dispute(self, dispute_id: u256) -> dict: ...

    class Write:
        def mark_appealed(self, dispute_id: u256) -> None: ...


@gl.contract_interface
class IStakeVault:
    class View:
        pass

    class Write:
        def lock_appeal(self, dispute_id: u256, appellant: Address) -> None: ...


@gl.contract_interface
class IDiverge:
    class View:
        pass

    class Write:
        def readjudicate(self, dispute_id: u256) -> None: ...


class AppealManager(gl.Contract):
    appeals: TreeMap[u256, Appeal]
    owner: Address
    registry: Address
    vault: Address
    arbiter: Address
    wired: bool

    def __init__(self):
        self.owner = gl.message.sender_address
        self.registry = ADDR_ZERO
        self.vault = ADDR_ZERO
        self.arbiter = ADDR_ZERO
        self.wired = False

    @gl.public.write
    def wire(self, registry: Address, vault: Address, arbiter: Address) -> None:
        if gl.message.sender_address != self.owner:
            raise Exception("EXPECTED: only owner can wire")
        if self.wired:
            raise Exception("EXPECTED: already wired")
        self.registry = registry
        self.vault = vault
        self.arbiter = arbiter
        self.wired = True

    @gl.public.write.payable
    def appeal(self, dispute_id: u256) -> None:
        """FR-5.1/5.2 — either party appeals within the window, bond = 50% of original."""
        if dispute_id in self.appeals:
            raise Exception("EXPECTED: already appealed")

        registry = gl.get_contract_at(self.registry)
        d = registry.view().get_dispute(dispute_id)

        if d["status"] != "RESOLVED":
            raise Exception("EXPECTED: no verdict to appeal")
        if int(d["round"]) >= 2:
            raise Exception("EXPECTED: second verdict is final")

        sender_hex = f"{gl.message.sender_address:x}".lower()
        if sender_hex not in (str(d["asserter"]).lower(), str(d["challenger"]).lower()):
            raise Exception("EXPECTED: only a dispute party can appeal")

        required = int(d["bond"]) * APPEAL_BOND_BPS // BPS_DENOM
        if gl.message.value != required:
            raise Exception(f"EXPECTED: appeal bond must be exactly {required}")

        from datetime import datetime
        try:
            now = int(datetime.fromisoformat(
                gl.message_raw["datetime"].replace("Z", "+00:00")).timestamp())
        except (ValueError, AttributeError):
            now = 0
        if now >= int(d["appeal_deadline"]):
            raise Exception("EXPECTED: appeal window closed")

        self.appeals[dispute_id] = Appeal(
            appellant=gl.message.sender_address,
            bond=gl.message.value,
            pre_appeal_winner=WINNER_ENUM.get(str(d["winner"]), W_NONE),
            created_at=now,
        )

        vault = gl.get_contract_at(self.vault)
        vault.emit(value=gl.message.value).lock_appeal(dispute_id, gl.message.sender_address)
        registry.emit().mark_appealed(dispute_id)
        arbiter = gl.get_contract_at(self.arbiter)
        arbiter.emit().readjudicate(dispute_id)

    @gl.public.view
    def get_appeal(self, dispute_id: u256) -> dict:
        a = self.appeals.get(dispute_id)
        if a is None:
            raise Exception("EXPECTED: no appeal")
        return {
            "dispute_id": dispute_id,
            "appellant": f"{a.appellant:x}",
            "bond": a.bond,
            "pre_appeal_winner": a.pre_appeal_winner,
            "created_at": a.created_at,
        }
