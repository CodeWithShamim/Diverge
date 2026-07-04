"""Test harness: deploy contracts, set tx context, inspect transfers."""

import contextlib
import types as pytypes
import typing

from . import _state, message
from .types import Address

DEFAULT_SENDER = "0x" + "11" * 20


def reset():
    _state.reset()
    message._set(sender=DEFAULT_SENDER, val=0, dt="2026-07-04T00:00:00+00:00")


def _init_storage(inst):
    """Auto-create TreeMap/DynArray storage fields from class annotations,
    the way the real SDK materializes contract storage."""
    from . import TreeMap, DynArray

    hints = {}
    for klass in reversed(type(inst).__mro__):
        hints.update(getattr(klass, "__annotations__", {}))
    for name, ann in hints.items():
        origin = typing.get_origin(ann) if not isinstance(ann, str) else None
        if origin is TreeMap:
            setattr(inst, name, TreeMap())
        elif origin is DynArray:
            setattr(inst, name, DynArray())


def deploy(cls, address: str, *args, sender: str = DEFAULT_SENDER, value: int = 0, **kwargs):
    inst = object.__new__(cls)
    inst._mock_address = Address(address)
    inst._mock_balance = 0
    _state.deployed[f"{inst._mock_address:x}".lower()] = inst
    _init_storage(inst)
    with tx(sender=sender, value=value):
        _state.exec_stack.append(inst)
        try:
            inst.__init__(*args, **kwargs)
        finally:
            _state.exec_stack.pop()
    return inst


@contextlib.contextmanager
def tx(sender: str = DEFAULT_SENDER, value: int = 0, at: str | None = None):
    saved_sender = message.sender_address
    saved_value = message.value
    saved_dt = message.raw["datetime"]
    message._set(sender=sender, val=value, dt=at)
    try:
        yield
    finally:
        message._set(sender=saved_sender, val=saved_value, dt=saved_dt)


def set_time(iso: str):
    message._set(dt=iso)


def transfers():
    return list(_state.transfers)


def transfers_to(address: str):
    key = address.lower()
    return [amt for (to, amt) in _state.transfers if to == key]


def clear_transfers():
    _state.transfers.clear()
