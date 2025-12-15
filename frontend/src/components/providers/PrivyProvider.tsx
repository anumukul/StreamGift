'use client';

import { PrivyProvider as BasePrivyProvider } from '@privy-io/react-auth';
import { ReactNode } from 'react';

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