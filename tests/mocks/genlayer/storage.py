"""Storage decorators — identity in the mock (apply above @dataclass)."""


def allow(cls):
    cls.__gl_allow_storage__ = True
    return cls


allow_storage = allow


class Pickled:
    def __class_getitem__(cls, item):
        return cls
