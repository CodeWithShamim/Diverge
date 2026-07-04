/** Typed chain config — GenLayer Bradbury Testnet (PRD FR-7.5).
 *  Contract addresses come from env; with none set the app runs on the
 *  built-in mock adapter so the full UX is explorable without a deploy. */

export const CHAIN_ID = 4221;
export const RPC_URL =
  import.meta.env.VITE_RPC_URL ?? "https://rpc-bradbury.genlayer.com";

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

export const TOKEN = "GEN";
export const MIN_BOND_GEN = 5.0;
