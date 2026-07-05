import { Link } from "react-router-dom";
import {
  ADDRESSES,
  CHAIN_ID,
  CHAIN_NAME,
  CONTRACTS,
  EXPLORER_BASE,
  MOCK_MODE,
  explorerAddressUrl,
} from "../config/chain";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Site footer — the on-chain surface. Every deployed contract links out to the
 *  GenLayer Studio explorer (§ read-only, no wallet prompts). Tokens only. */
export function Footer() {
  return (
    <footer className="ftr">
      <div className="ftr-inner">
        <div className="ftr-brand">
          <span className="ftr-mark">
            DIVERGE<span className="fork-glyph">⟋⟍</span>
          </span>
          <p className="ftr-tag">
            Trustless resolution of contested off-chain state — an adversarial
            oracle on GenLayer.
          </p>
          <span className="ftr-chain">
            {CHAIN_NAME} · {CHAIN_ID}
            {MOCK_MODE && <span className="mock-flag"> · SIMULATED</span>}
          </span>
        </div>

        <nav className="ftr-links" aria-label="Site">
          <span className="t-label">Diverge</span>
          <Link to="/">Board</Link>
          <Link to="/assert">Assert a claim</Link>
          <Link to="/explorer">Resolution explorer</Link>
          <Link to="/docs">Docs</Link>
        </nav>

        <div className="ftr-contracts">
          <div className="ftr-contracts-head">
            <span className="t-label">Contracts on GenLayer Studio</span>
            <a
              className="ftr-explorer-link"
              href={EXPLORER_BASE}
              target="_blank"
              rel="noreferrer"
            >
              explorer-studio.genlayer.com ↗
            </a>
          </div>

          {MOCK_MODE && (
            <p className="ftr-mock-note">
              Running on the mock adapter — set contract addresses in{" "}
              <span className="t-data">app/.env.local</span> to link the live
              deployment.
            </p>
          )}

          <ul className="ftr-contract-list">
            {CONTRACTS.map((c) => {
              const addr = ADDRESSES[c.key];
              return (
                <li key={c.key} className="ftr-contract">
                  <span className="ftr-contract-name">{c.name}</span>
                  {addr ? (
                    <a
                      className="ftr-contract-addr"
                      href={explorerAddressUrl(addr)}
                      target="_blank"
                      rel="noreferrer"
                      title={`${c.name} · ${addr} — open on GenLayer Studio explorer`}
                    >
                      {short(addr)} ↗
                    </a>
                  ) : (
                    <span className="ftr-contract-addr is-unset">not deployed</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="ftr-base">
        <span>Two claims. One truth.</span>
        <span className="t-data">chain {CHAIN_ID}</span>
      </div>
    </footer>
  );
}
