"""Shared mutable harness state: execution stack, deployed contracts, transfers."""

# stack of contract instances currently executing a public method
exec_stack: list = []

# address hex -> contract instance
deployed: dict = {}

# list of (address_hex, amount) native transfers emitted via chain.Account
transfers: list = []


def reset():
    exec_stack.clear()
    deployed.clear()
    transfers.clear()
