"""run_nondet + result types."""


class Return:
    def __init__(self, calldata):
        self.calldata = calldata


class UserError(Exception):
    def __init__(self, data):
        super().__init__(data)
        self.data = data

    @staticmethod
    def immediate(reason):
        raise UserError(reason)


class VMError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


def run_nondet(leader_fn, validator_fn, /, **kwargs):
    """Synchronous mock: run the leader, then validate its result exactly like
    a validator node would. A disagreeing validator fails the tx."""
    try:
        result = leader_fn()
    except Exception as e:
        raise UserError(str(e))
    if not validator_fn(Return(result)):
        raise UserError("LLM_ERROR: validators failed to converge")
    return result


run_nondet_unsafe = run_nondet


def spawn_sandbox(fn, *, allow_write_ops=False):
    try:
        return Return(fn())
    except UserError as e:
        return e
    except Exception as e:
        return VMError(str(e))


def trace(*args):
    pass


class Event:
    def emit(self):
        pass

    @staticmethod
    def emit_raw(topics, blob):
        pass
