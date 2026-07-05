/** genlayer-js client (real-chain path). Only loaded when MOCK_MODE is off.
 *  Targets GenLayer StudioNet (chain 61999). Reads use a provider-less client;
 *  writes use a client bridged to the connected Privy wallet's EIP-1193 provider.
 *  VERIFY on live StudioNet: regenerate schemas with `genlayer schema` after
 *  deploy; confirm whether the first write needs `client.connect()`. */

import { MOCK_MODE, RPC_URL, CHAIN } from "../config/chain";

/** Minimal EIP-1193 surface — what a Privy wallet's provider exposes and what
 *  genlayer-js consumes (eth_requestAccounts / eth_sendTransaction / …). */
export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
};

let readClient: Promise<any> | null = null;

/** Read-only client — view calls, never opens a wallet prompt (FR-7.3). */
export function getReadClient(): Promise<any> {
  if (MOCK_MODE) return Promise.reject(new Error("mock mode"));
  if (!readClient) {
    readClient = (async () => {
      const { createClient } = await import("genlayer-js");
      return createClient({ chain: CHAIN, endpoint: RPC_URL });
    })();
  }
  return readClient;
}

let writeClient: { provider: Eip1193Provider; client: Promise<any> } | null = null;

/** Write client bridged to a connected wallet. genlayer-js signs via the
 *  provider's standard EIP-1193 methods (eth_signTypedData / eth_sendTransaction). */
export function getWriteClient(provider: Eip1193Provider): Promise<any> {
  if (MOCK_MODE) return Promise.reject(new Error("mock mode"));
  if (!writeClient || writeClient.provider !== provider) {
    writeClient = {
      provider,
      client: (async () => {
        const { createClient } = await import("genlayer-js");
        return createClient({
          chain: CHAIN,
          endpoint: RPC_URL,
          provider: provider as any,
        });
      })(),
    };
  }
  return writeClient.client;
}
