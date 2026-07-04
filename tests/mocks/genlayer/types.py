"""Type aliases + Address, mirroring `from genlayer.types import *`."""

u8 = u16 = u24 = u32 = u40 = u48 = u56 = u64 = int
u72 = u80 = u88 = u96 = u104 = u112 = u120 = u128 = int
u136 = u144 = u152 = u160 = u168 = u176 = u184 = u192 = int
u200 = u208 = u216 = u224 = u232 = u240 = u248 = u256 = int
i8 = i16 = i32 = i64 = i128 = i256 = int
bigint = int


class Address:
    SIZE = 20
    ZERO: "Address"

    def __init__(self, val):
        if isinstance(val, Address):
            self._hex = val._hex
        elif isinstance(val, str):
            h = val.lower()
            if not h.startswith("0x"):
                raise ValueError(f"bad address {val!r}")
            self._hex = "0x" + h[2:].rjust(40, "0")
        elif isinstance(val, (bytes, bytearray)):
            self._hex = "0x" + bytes(val).hex().rjust(40, "0")
        else:
            raise ValueError(f"bad address {val!r}")

    def __eq__(self, other):
        return isinstance(other, Address) and self._hex == other._hex

    def __hash__(self):
        return hash(self._hex)

    def __format__(self, fmt):
        return self._hex

    def __str__(self):
        return self._hex

    def __repr__(self):
        return f"Address({self._hex})"


Address.ZERO = Address("0x" + "00" * 20)

__all__ = [
    "u8", "u16", "u24", "u32", "u40", "u48", "u56", "u64",
    "u72", "u80", "u88", "u96", "u104", "u112", "u120", "u128",
    "u136", "u144", "u152", "u160", "u168", "u176", "u184", "u192",
    "u200", "u208", "u216", "u224", "u232", "u240", "u248", "u256",
    "i8", "i16", "i32", "i64", "i128", "i256",
    "bigint", "Address",
]
