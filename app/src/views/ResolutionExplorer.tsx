import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getResolution } from '../lib/reads';
import type { Resolution } from '../lib/types';
import { ADDRESSES } from '../config/chain';
import { Loader } from '../components/Loader';
import { AuroraBackdrop } from '../components/AuroraBackdrop';

/** Resolution explorer — for consuming-protocol devs (FR-7.1). Read-only:
 *  no primary buttons, no wallet prompts (§5.7). */
export function ResolutionExplorer() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('id') ?? '');
  const [result, setResult] = useState<Resolution | null | 'none'>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (idStr: string) => {
    const id = Number(idStr);
    if (Number.isNaN(id) || idStr === '') return;
    setParams({ id: idStr });
    setLoading(true);
    try {
      const r = await getResolution(id);
      setResult(r ?? 'none');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = params.get('id');
    if (initial) lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snippet = `# settle your own dispute game on a Diverge verdict
log = gl.contract.get_at(Address("${ADDRESSES.log || '0x…ResolutionLog'}"))
if log.view().is_final(dispute_id):
    r = log.view().get_resolution(dispute_id)
    # r["winner"]: "A_WINS" | "B_WINS" | "UNRESOLVED"
    # r["unresolved"] is explicit — never mistake it for a verdict`;

  return (
    <div className="view-stage">
      <AuroraBackdrop variant="explorer" />
      <div className="shell">
      <h1 className="t-h1 view-title">Resolution explorer</h1>
      <p className="t-small" style={{ maxWidth: 640 }}>
        The product surface: finalized verdicts, queryable by any contract in one view call. Reads
        only — nothing here opens a wallet prompt.
      </p>

      <div style={{ display: 'flex', gap: 12, maxWidth: 420, margin: '24px 0' }}>
        <input
          type="text"
          className="mono-input"
          placeholder="dispute id"
          value={query}
          aria-label="Dispute id"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookup(query)}
        />
        <button className="btn btn-secondary" onClick={() => lookup(query)}>
          get_resolution
        </button>
      </div>

      {loading && <Loader block size="sm" label="Fetching resolution" />}

      {!loading && result === 'none' && (
        <p className="notice">
          No finalized resolution for that id. <span className="t-data">is_final == false</span> —
          consuming protocols fall back to their own timeout.
        </p>
      )}

      {!loading && result && result !== 'none' && (
        <div className="panel explorer-result" style={{ maxWidth: 720 }}>
          <dl className="kv">
            <dt>dispute_id</dt>
            <dd>{result.disputeId}</dd>
            <dt>winner</dt>
            <dd>
              {result.winner}
              {result.uncontested ? ' (uncontested)' : ''}
            </dd>
            <dt>unresolved</dt>
            <dd>{String(result.unresolved)}</dd>
            <dt>supports_vector</dt>
            <dd>{result.supportsVector || '—'}</dd>
            <dt>snapshot_a</dt>
            <dd>{result.snapshotA || '—'}</dd>
            <dt>snapshot_b</dt>
            <dd>{result.snapshotB || '—'}</dd>
            <dt>finalized_at</dt>
            <dd>
              {new Date(result.finalizedAt * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC
            </dd>
          </dl>
        </div>
      )}

      <div className="seam-rule">
        <span className="t-label">CONSUME FROM YOUR CONTRACT</span>
      </div>
      <div className="well" style={{ maxWidth: 720 }}>
        <pre className="explorer-result" style={{ padding: 16, overflowX: 'auto' }}>
          <code className="t-data">{snippet}</code>
        </pre>
      </div>
      </div>
    </div>
  );
}
