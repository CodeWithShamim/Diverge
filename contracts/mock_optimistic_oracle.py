# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
# VERIFY: pin against `genlayer runners list` for the target GenVM before deploy.
#
# MockOptimisticOracle — M6 consumer example (PRD §8).
# A minimal optimistic oracle that outsources its dispute game to Diverge:
# it reads ResolutionLog in one cross-contract view call and settles its own
# request on the verdict (FR-6.3).

from dataclasses import dataclass

import genlayer as gl
from genlayer.types import *

# request status
OPEN, DISPUTED, SETTLED_TRUE, SETTLED_FALSE, VOID = 0, 1, 2, 3, 4
STATUS_NAMES = ["OPEN", "DISPUTED", "SETTLED_TRUE", "SETTLED_FALSE", "VOID"]


@gl.storage.allow
@dataclass
class Request:
    requester: Address
    question: str
    proposed_answer: bool
    fork_dispute_id: u256
    status: u8


@gl.contract.interface
class IResolutionLog:
    class View:
        def get_resolution(self, dispute_id: u256) -> dict: ...
        def is_final(self, dispute_id: u256) -> bool: ...

    class Write:
        pass


class MockOptimisticOracle(gl.contract.Contract):
    requests: gl.TreeMap[u256, Request]
    request_count: u256
    resolution_log: Address

    def __init__(self, resolution_log: Address):
        self.request_count = 0
        self.resolution_log = resolution_log

    @gl.public.write
    def propose(self, question: str, answer: bool) -> u256:
        rid = self.request_count
        self.request_count = rid + 1
        self.requests[rid] = Request(
            requester=gl.message.sender_address,
            question=question,
            proposed_answer=answer,
            fork_dispute_id=0,
            status=OPEN,
        )
        return rid

    @gl.public.write
    def link_dispute(self, request_id: u256, fork_dispute_id: u256) -> None:
        """The proposed answer got challenged — the game moves to Diverge."""
        r = self._get(request_id)
        if r.status != OPEN:
            raise Exception("EXPECTED: request not open")
        r.fork_dispute_id = fork_dispute_id
        r.status = DISPUTED

    @gl.public.write
    def settle(self, request_id: u256) -> str:
        """Settle this oracle's own game on Diverge's finalized verdict.

        Side A == the original proposal, Side B == the challenge, so:
        A_WINS => proposed answer stands, B_WINS => flipped,
        UNRESOLVED => VOID (fall back to our own timeout policy, FR-6.4).
        """
        r = self._get(request_id)
        if r.status != DISPUTED:
            raise Exception("EXPECTED: request not disputed")

        log = gl.contract.get_at(self.resolution_log)
        if not log.view().is_final(r.fork_dispute_id):
            raise Exception("EXPECTED: fork dispute not final yet")
        res = log.view().get_resolution(r.fork_dispute_id)

        if res["unresolved"]:
            r.status = VOID
        elif res["winner"] == "A_WINS":
            r.status = SETTLED_TRUE if r.proposed_answer else SETTLED_FALSE
        else:  # B_WINS
            r.status = SETTLED_FALSE if r.proposed_answer else SETTLED_TRUE
        return STATUS_NAMES[r.status]

    def _get(self, request_id: u256) -> Request:
        r = self.requests.get(request_id)
        if r is None:
            raise Exception("EXPECTED: unknown request")
        return r

    @gl.public.view
    def get_request(self, request_id: u256) -> dict:
        r = self._get(request_id)
        return {
            "requester": f"{r.requester:x}",
            "question": r.question,
            "proposed_answer": r.proposed_answer,
            "fork_dispute_id": r.fork_dispute_id,
            "status": STATUS_NAMES[r.status],
        }
