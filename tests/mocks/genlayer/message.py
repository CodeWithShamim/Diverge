"""Mutable message context, mirroring the genlayer.message module attributes."""

from .types import Address

sender_address = Address.ZERO
origin_address = Address.ZERO
contract_address = Address.ZERO
value = 0
chain_id = 4221
is_init = False

raw = {
    "datetime": "2026-07-04T00:00:00+00:00",
    "sender_address": sender_address,
    "value": 0,
    "chain_id": 4221,
}


def _set(sender=None, val=None, dt=None):
    global sender_address, origin_address, value
    if sender is not None:
        sender_address = Address(sender) if not isinstance(sender, Address) else sender
        origin_address = sender_address
        raw["sender_address"] = sender_address
    if val is not None:
        value = val
        raw["value"] = val
    if dt is not None:
        raw["datetime"] = dt
