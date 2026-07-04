/** genlayer-js client (real-chain path). Only loaded when MOCK_MODE is off.
 *  VERIFY: regenerate schemas with `genlayer schema` after deploy and confirm
 *  the chain export name for Bradbury in the installed genlayer-js version. */

import { MOCK_MODE, RPC_URL, CHAIN_ID } from "../config/chain";

let clientPromise: Promise<any> | null = null;

export function getClient(): Promise<any> {
  if (MOCK_MODE) return Promise.reject(new Error("mock mode"));
  if (!clientPromise) {
    clientPromise = (async () => {
      const { createClient } = await import("genlayer-js");
      const chain = {
        id: CHAIN_ID,
        name: "GenLayer Bradbury Testnet",
        rpcUrls: { default: { http: [RPC_URL] } },
        nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
      } as any;
      return createClient({ chain });
    })();
  }
  return clientPromise;
}
