from dataclasses import dataclass, field


@dataclass
class Response:
    status: int
    headers: dict = field(default_factory=dict)
    body: bytes | None = b""


def get(url, /, **kwargs) -> Response:
    raise NotImplementedError(
        "EXTERNAL: web.get not mocked — monkeypatch genlayer.nondet.web.get"
    )


def render(url, /, **kwargs) -> str:
    raise NotImplementedError("EXTERNAL: web.render not mocked")
