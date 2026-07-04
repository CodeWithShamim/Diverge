"""Mock of the GenLayer Python SDK (v0.3 namespace) for direct tests.

Implements just enough of `import genlayer as gl` for the Diverge
contracts to run under plain pytest: storage types, decorators, message
context, cross-contract proxies (executed synchronously), run_nondet,
and a transfer ledger. Non-deterministic ops (exec_prompt, web.get) raise
unless monkeypatched by the test.
"""

from . import types as types
from .types import Address

from . import _state as _state
from . import message as message
from . import storage as storage
from . import public as public
from . import vm as vm
from . import nondet as nondet
from . import eq_principle as eq_principle
from . import contract as contract
from . import chain as chain
from . import testing as testing


class TreeMap(dict):
    __gl_allow_storage__ = True

    def __class_getitem__(cls, item):
        import types as _t
        return _t.GenericAlias(cls, item if isinstance(item, tuple) else (item,))

    def get_or_insert_default(self, key):
        raise NotImplementedError


class DynArray(list):
    __gl_allow_storage__ = True

    def __class_getitem__(cls, item):
        import types as _t
        return _t.GenericAlias(cls, item if isinstance(item, tuple) else (item,))


class Array(list):
    def __class_getitem__(cls, item):
        import types as _t
        return _t.GenericAlias(cls, item if isinstance(item, tuple) else (item,))
