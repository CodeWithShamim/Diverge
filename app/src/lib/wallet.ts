/** Active-wallet registry — the connected Privy wallet's EIP-1193 provider and
 *  address, set by the Privy integration (components/WalletButton) and read by
 *  the write layer. Keeps writes.ts free of prop-drilling and React coupling. */

import type { Eip1193Provider } from "./client";

let activeProvider: Eip1193Provider | null = null;
let activeAddress: string | null = null;

export function setActiveWallet(
  provider: Eip1193Provider | null,
  address: string | null
) {
  activeProvider = provider;
  activeAddress = address;
}

export function getActiveProvider(): Eip1193Provider | null {
  return activeProvider;
}

export function getActiveAddress(): string | null {
  return activeAddress;
}

export function isWalletConnected(): boolean {
  return activeProvider !== null && activeAddress !== null;
}
