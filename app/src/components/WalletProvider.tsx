import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { CHAIN, PRIVY_APP_ID } from "../config/chain";

/** Wraps the app in Privy only when an app id is configured. Without one, the
 *  app renders normally on the mock adapter and the header shows a hint — Privy
 *  can't initialize without a real app id, so we must not mount it blindly. */
export function WalletProvider({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // StudioNet is the only network Diverge targets.
        defaultChain: CHAIN as any,
        supportedChains: [CHAIN as any],
        // Match the instrument aesthetic (Design System §2).
        appearance: {
          theme: "dark",
          accentColor: "#5B8BF0", // --signal
          logo: undefined,
          walletChainType: "ethereum-only",
        },
        // Give social-login users a wallet so every account can sign writes.
        embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
