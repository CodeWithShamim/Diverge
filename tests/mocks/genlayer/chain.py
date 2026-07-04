"""On-chain accounts — transfers are recorded in the harness ledger."""

from . import _state
from .types import Address

id = 4221


class Account:
    def __init__(self, address: Address, /):
        self._address = address if isinstance(address, Address) else Address(address)

    @property
    def address(self) -> Address:
        return self._address

    @property
    def balance(self) -> int:
        return 0

    def emit_transfer(self, value, *, on="finalized"):
        _state.transfers.append((f"{self._address:x}".lower(), value))
