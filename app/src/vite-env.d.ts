/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_MOCK?: string;
  readonly VITE_ADDR_REGISTRY?: string;
  readonly VITE_ADDR_ARBITER?: string;
  readonly VITE_ADDR_VAULT?: string;
  readonly VITE_ADDR_LOG?: string;
  readonly VITE_ADDR_APPEALS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
