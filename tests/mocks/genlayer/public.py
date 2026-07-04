"""@gl.public.view / @gl.public.write / @gl.public.write.payable decorators.

Wrapped methods push `self` onto the execution stack so cross-contract
proxies know the calling contract's address.
"""

import functools

from . import _state


def _wrap(f):
    @functools.wraps(f)
    def inner(self, *args, **kwargs):
        _state.exec_stack.append(self)
        try:
            return f(self, *args, **kwargs)
        finally:
            _state.exec_stack.pop()

    inner.__gl_public__ = True
    return inner


view = _wrap


class _Write:
    def __call__(self, f):
        return _wrap(f)

    @property
    def payable(self):
        return _wrap

    def min_gas(self, **kwargs):
        return self


write = _Write()
