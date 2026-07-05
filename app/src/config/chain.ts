/** Typed chain config — GenLayer Studio Network (StudioNet) only.
 *  StudioNet is GenLayer's hosted, gasless studio network (chain 61999).
 *  Contract addresses come from env; with none set the app runs on the
 *  built-in mock adapter so the full UX is explorable without a deploy. */

import { studionet } from "genlayer-js/chains";

export const CHAIN = studionet;
export const CHAIN_ID = studionet.id; // 61999
export const CHAIN_NAME = "STUDIONET";
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? studionet.rpcUrls.default.http[0];

export const ADDRESSES = {
  registry: import.meta.env.VITE_ADDR_REGISTRY ?? "",
  arbiter: import.meta.env.VITE_ADDR_ARBITER ?? "",
  vault: import.meta.env.VITE_ADDR_VAULT ?? "",
  log: import.meta.env.VITE_ADDR_LOG ?? "",
  appeals: import.meta.env.VITE_ADDR_APPEALS ?? "",
} as const;

/** Mock mode: explicit VITE_MOCK=1, or no registry address configured. */
export const MOCK_MODE =
  import.meta.env.VITE_MOCK === "1" || ADDRESSES.registry === "";

/** Privy app id — from the Privy dashboard. Wallet connect is inert without it. */
export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? "";

export const TOKEN = "GEN";
// Must match the deployed DisputeRegistry's min_bond (1 GEN — scripts/deploy.sh MIN_BOND).
export const MIN_BOND_GEN = 1.0;
