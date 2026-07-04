"""Non-deterministic ops — raise unless the test monkeypatches them."""

from . import web as web


def exec_prompt(prompt, **kwargs):
    raise NotImplementedError(
        "LLM_ERROR: exec_prompt not mocked — monkeypatch genlayer.nondet.exec_prompt"
    )
