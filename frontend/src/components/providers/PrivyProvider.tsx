'use client';

import { ReactNode, useEffect, useState } from 'react';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!;

interface Props {
  children: ReactNode;
}

const movementTestnet = {
  id: 250,
  name: 'Movement Testnet',
  network: 'movement-testnet',
  nativeCurrency: {
    name: 'MOVE',
    symbol: 'MOVE',
    decimals: 8,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_MOVEMENT_NODE_URL || 'https://testnet.movementnetwork.xyz'],
    },
    public: {
      http: [process.env.NEXT_PUBLIC_MOVEMENT_NODE_URL || 'https://testnet.movementnetwork.xyz'],
    },
  },
};

export function PrivyProvider({ children }: Props) {
  const [BasePrivyProvider, setBasePrivyProvider] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const spec = '@privy' + '-io/react-auth';
    // construct spec at runtime to avoid bundler static analysis
    // so Turbopack/webpack do not attempt to pre-resolve test-only deps.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    import(spec)
      .then((mod) => {
        if (mounted) setBasePrivyProvider(() => mod.PrivyProvider || mod.default || mod.Privy);
      })
      .catch(() => {
        // noop - avoid throwing during client dynamic import failures
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!BasePrivyProvider) return <>{children}</>;

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#7C3AED',
        },
        loginMethods: ['email', 'google', 'twitter'],
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        supportedChains: [movementTestnet],
        defaultChain: movementTestnet,
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}