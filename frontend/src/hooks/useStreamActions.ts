'use client';

import { useState, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { api } from '@/lib/api';

export interface CreateStreamParams {
  recipientType: 'email' | 'twitter' | 'wallet';
  recipientValue: string;
  amount: string;
  durationSeconds: number;
  message?: string;
}

export interface StreamResult {
  success: boolean;
  stream?: {
    id: string;
    onChainId: number;
    sender: string;
    recipient: string;
    totalAmount: string;
    status: string;
  };
  transaction?: {
    hash?: string;
    status: string;
    explorerUrl?: string;
  };
  error?: string;
}

export interface ClaimResult {
  success: boolean;
  claimedAmount?: string;
  totalClaimed?: string;
  remaining?: string;
  transaction?: {
    hash?: string;
    onChain: boolean;
    explorerUrl?: string;
  };
  error?: string;
}

export function useStreamActions() {
  const { authenticated, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = wallets[0]?.address;
  const embeddedWallet = wallets[0];
  const userEmail = user?.email?.address;

  const createStream = useCallback(
    async (params: CreateStreamParams): Promise<StreamResult> => {
      if (!authenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!walletAddress) {
        return { success: false, error: 'No wallet connected' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Failed to get access token');
        }

        const prepareResponse = await api.streams.prepareCreate(
          {
            recipientType: params.recipientType,
            recipientValue: params.recipientValue.replace('@', ''),
            amount: params.amount,
            durationSeconds: params.durationSeconds,
            message: params.message || '',
            senderAddress: walletAddress,
          },
          token
        );

        const wallet = wallets[0];
        if (!wallet) {
          throw new Error('No wallet available');
        }
        const provider = await wallet.getEthereumProvider();
        const signature = await provider.request({
          method: 'personal_sign',
          params: [prepareResponse.message, walletAddress],
        });

        const createResponse = await api.streams.create(
          {
            recipientType: params.recipientType,
            recipientValue: params.recipientValue.replace('@', ''),
            amount: params.amount,
            durationSeconds: params.durationSeconds,
            message: params.message || '',
            senderAddress: walletAddress,
            signature,
            signedMessage: prepareResponse.message,
          },
          token
        );

        return {
          success: true,
          stream: createResponse.stream,
          transaction: createResponse.transaction,
        };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to create stream';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authenticated, walletAddress, getAccessToken, wallets, embeddedWallet]
  );

  const claimStream = useCallback(
    async (streamId: string, overrideWalletAddress?: string): Promise<ClaimResult> => {
      if (!authenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      const effectiveWalletAddress = overrideWalletAddress || walletAddress;

      if (!effectiveWalletAddress) {
        return { success: false, error: 'No wallet connected' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Failed to get access token');
        }

        const prepareResponse = await api.claim.prepare(
          streamId,
          { walletAddress: effectiveWalletAddress, email: userEmail },
          token
        );

        const wallet = wallets.find(w => w.address.toLowerCase() === effectiveWalletAddress.toLowerCase()) || wallets[0];
        if (!wallet) {
          throw new Error('No wallet available');
        }
        const provider = await wallet.getEthereumProvider();
        const signature = await provider.request({
          method: 'personal_sign',
          params: [prepareResponse.authorization.message, effectiveWalletAddress],
        });

        const executeResponse = await api.claim.execute(
          streamId,
          {
            walletAddress: effectiveWalletAddress,
            signature,
            signedMessage: prepareResponse.authorization.message,
            email: userEmail,
          },
          token
        );

        return {
          success: executeResponse.success,
          claimedAmount: executeResponse.claimedAmount,
          totalClaimed: executeResponse.totalClaimed,
          remaining: executeResponse.remaining,
          transaction: executeResponse.transaction,
        };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to claim';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authenticated, walletAddress, getAccessToken, userEmail, wallets]
  );

  const cancelStream = useCallback(
    async (streamId: string): Promise<{ success: boolean; error?: string }> => {
      if (!authenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      if (!walletAddress) {
        return { success: false, error: 'No wallet connected' };
      }

      setIsLoading(true);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          throw new Error('Failed to get access token');
        }

        return { success: false, error: 'Cancel not implemented yet' };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to cancel stream';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      } finally {
        setIsLoading(false);
      }
    },
    [authenticated, walletAddress, getAccessToken]
  );

  return {
    isLoading,
    error,
    walletAddress,
    isConnected: !!walletAddress,
    createStream,
    claimStream,
    cancelStream,
  };
}