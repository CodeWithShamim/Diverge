"""Contract base, @interface, and synchronous cross-contract proxies."""

import typing

from . import _state, message
from .types import Address


class Contract:
    __gl_contract__ = True

    @property
    def address(self) -> Address:
        return self._mock_address

    @property
    def balance(self) -> int:
        return getattr(self, "_mock_balance", 0)

    def emit_transfer(self, value, *, on="finalized"):
        _state.transfers.append((f"{self._mock_address:x}", value))


def interface(cls):
    """Identity decorator — proxies in the mock dispatch by name, not schema."""
    return cls


class _CallNamespace:
    def __init__(self, inst, value: int):
        self._inst = inst
        self._value = value

    def __getattr__(self, name):
        target = getattr(self._inst, name)

        def call(*args, **kwargs):
            saved_sender = message.sender_address
            saved_value = message.value
            caller = _state.exec_stack[-1] if _state.exec_stack else None
            if caller is not None:
                message._set(sender=caller._mock_address, val=self._value)
            else:
                message._set(val=self._value)
            try:
                return target(*args, **kwargs)
            finally:
                message._set(sender=saved_sender, val=saved_value)

        return call


class _Proxy:
    def __init__(self, inst):
        self._inst = inst

    def view(self, **kwargs) -> "_CallNamespace":
        return _CallNamespace(self._inst, 0)

    def emit(self, *, value: int = 0, on: str = "finalized") -> "_CallNamespace":
        return _CallNamespace(self._inst, value)

    def emit_transfer(self, value, *, on="finalized"):
        _state.transfers.append((f"{self._inst._mock_address:x}", value))


def get_at(address: Address) -> _Proxy:
    key = f"{address:x}".lower()
    inst = _state.deployed.get(key)
    if inst is None:
        raise RuntimeError(f"mock: no contract deployed at {key}")
    return _Proxy(inst)


def deploy(**kwargs):
    raise NotImplementedError("mock: use genlayer.testing.deploy")
