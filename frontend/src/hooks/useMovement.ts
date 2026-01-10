'use client';

import { useState, useCallback } from 'react';
import { useWallets } from '@privy-io/react-auth';
import {
  Aptos,
  AptosConfig,
  Network,
  InputEntryFunctionData,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const MOVEMENT_NODE_URL = process.env.NEXT_PUBLIC_MOVEMENT_NODE_URL!;

const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_NODE_URL,
});

const aptos = new Aptos(config);

export function useMovement() {
  const { wallets } = useWallets();
  const [isLoading, setIsLoading] = useState(false);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === 'privy'
  );

  const sendTransaction = useCallback(
    async (payload: InputEntryFunctionData) => {
      if (!embeddedWallet) {
        throw new Error('No embedded wallet found');
      }

      setIsLoading(true);

      try {
        const provider = await embeddedWallet.getEthereumProvider();
        
        // For Privy embedded wallets, we need to use their signing method
        // Since Movement is Aptos-based, we'll use a different approach
        
        // Get the wallet address
        const address = embeddedWallet.address;
        
        // Build the transaction
        const transaction = await aptos.transaction.build.simple({
          sender: address,
          data: payload,
        });

        // Note: In this app, all on-chain transactions go through the backend
        // which handles signing with the admin account. This hook is kept for
        // future use cases where client-side signing might be needed.

        return {
          success: true,
          hash: 'pending-backend-execution',
          transaction,
        };
      } catch (error) {
        console.error('Transaction error:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [embeddedWallet]
  );

  const createStream = useCallback(
    async (params: {
      recipientAddress: string;
      socialHash: number[];
      amount: string;
      durationSeconds: number;
      startTime: number;
      message: string;
    }) => {
      const payload: InputEntryFunctionData = {
        function: `${CONTRACT_ADDRESS}::stream::create_stream`,
        functionArguments: [
          CONTRACT_ADDRESS,
          params.recipientAddress,
          params.socialHash,
          BigInt(params.amount),
          BigInt(params.durationSeconds),
          BigInt(params.startTime),
          params.message,
        ],
      };

      return sendTransaction(payload);
    },
    [sendTransaction]
  );

  const claimStream = useCallback(
    async (streamId: number, amount: string = '0') => {
      const payload: InputEntryFunctionData = {
        function: `${CONTRACT_ADDRESS}::stream::claim_stream`,
        functionArguments: [
          CONTRACT_ADDRESS,
          BigInt(streamId),
          BigInt(amount),
        ],
      };

      return sendTransaction(payload);
    },
    [sendTransaction]
  );

  const cancelStream = useCallback(
    async (streamId: number) => {
      const payload: InputEntryFunctionData = {
        function: `${CONTRACT_ADDRESS}::stream::cancel_stream`,
        functionArguments: [CONTRACT_ADDRESS, BigInt(streamId)],
      };

      return sendTransaction(payload);
    },
    [sendTransaction]
  );

  const getClaimable = useCallback(async (streamId: number): Promise<bigint> => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::stream::get_claimable`,
          functionArguments: [CONTRACT_ADDRESS, streamId],
        },
      });
      return BigInt(result[0] as string);
    } catch (error) {
      console.error('Failed to get claimable:', error);
      return BigInt(0);
    }
  }, []);

  return {
    isLoading,
    walletAddress: embeddedWallet?.address,
    createStream,
    claimStream,
    cancelStream,
    getClaimable,
    aptos,
  };
}