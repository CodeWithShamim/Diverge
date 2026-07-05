import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { PRIVY_APP_ID, CHAIN_ID } from "../config/chain";
import { setActiveWallet } from "../lib/wallet";
import type { Eip1193Provider } from "../lib/client";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Header wallet control. Rendered only when a Privy app id is set; otherwise
 *  the header shows <WalletHint/>. Syncs the connected wallet's EIP-1193
 *  provider into the write layer so genlayer-js can sign StudioNet writes. */
export function WalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [address, setAddress] = useState<string | null>(null);

  const wallet = wallets[0];

  useEffect(() => {
    let cancelled = false;
    if (!authenticated || !wallet) {
      setActiveWallet(null, null);
      setAddress(null);
      return;
    }
    (async () => {
      try {
        // Best-effort: ensure the wallet is on StudioNet before signing.
        await wallet.switchChain(CHAIN_ID).catch(() => {});
        const provider = (await wallet.getEthereumProvider()) as unknown as Eip1193Provider;
        if (cancelled) return;
        setActiveWallet(provider, wallet.address);
        setAddress(wallet.address);
      } catch {
        if (!cancelled) {
          setActiveWallet(null, null);
          setAddress(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, wallet]);

  if (!ready) {
    return <span className="wallet-chip pending">connecting…</span>;
  }

  if (!authenticated) {
    return (
      <button className="btn btn-secondary wallet-connect" onClick={() => login()}>
        Connect wallet
      </button>
    );
  }

  return (
    <span className="wallet-connected">
      <span className="wallet-dot" aria-hidden />
      <span className="wallet-addr t-data" title={address ?? undefined}>
        {address ? short(address) : "no wallet"}
      </span>
      <button className="wallet-disconnect" onClick={() => logout()} aria-label="Disconnect wallet">
        disconnect
      </button>
    </span>
  );
}

/** Shown when no Privy app id is configured — the app still runs on the mock
 *  adapter; wallet-signed writes need VITE_PRIVY_APP_ID. */
export function WalletHint() {
  return (
    <span
      className="wallet-chip hint"
      title="Set VITE_PRIVY_APP_ID in app/.env.local to enable wallet connect"
    >
      wallet · set app id
    </span>
  );
}

export function WalletControl() {
  return PRIVY_APP_ID ? <WalletButton /> : <WalletHint />;
}
