"""Mock of the GenLayer Python SDK (v0.2.16 runner namespace) for direct tests.

Implements just enough of `from genlayer import *` for the Diverge
contracts to run under plain pytest: storage types, decorators, message
context, cross-contract proxies (executed synchronously), run_nondet,
and a transfer ledger. Non-deterministic ops (exec_prompt, web.get) raise
unless monkeypatched by the test.
"""

import sys

from . import types as types
from .types import *
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

# v0.2.16 top-level surface: `from genlayer import *` exposes these, and the
# `gl` namespace is the package itself (gl.public, gl.vm, gl.nondet, ...).
from .contract import (
    Contract as Contract,
    interface as contract_interface,
    get_at as get_contract_at,
    deploy as deploy_contract,
)
from .storage import allow as allow_storage
from .message import raw as message_raw

gl = sys.modules[__name__]


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
