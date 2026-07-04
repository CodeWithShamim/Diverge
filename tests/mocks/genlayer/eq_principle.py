"""Equivalence principles — in the mock the leader's result simply stands."""


def strict_eq(fn, /):
    return fn()


def prompt_comparative(fn, principle, /):
    return fn()


def prompt_non_comparative(fn, /, *, task, criteria):
    return fn()
