import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputEntryFunctionData,
  AccountAddress,
} from '@aptos-labs/ts-sdk';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!;
const MOVEMENT_NODE_URL = process.env.NEXT_PUBLIC_MOVEMENT_NODE_URL!;

const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_NODE_URL,
});

export const aptos = new Aptos(config);
export const contractAddress = CONTRACT_ADDRESS;

export interface CreateStreamParams {
  recipientAddress: string;
  socialHash: Uint8Array;
  amount: bigint;
  durationSeconds: number;
  startTime: number;
  message: string;
}

export interface StreamDetails {
  id: number;
  sender: string;
  recipient: string;
  recipientSocialHash: Uint8Array;
  totalAmount: bigint;
  claimedAmount: bigint;
  ratePerSecond: bigint;
  startTime: number;
  endTime: number;
  lastClaimTime: number;
  message: string;
  status: number;
  createdAt: number;
}

export async function getStreamCount(): Promise<number> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::stream::get_stream_count`,
        functionArguments: [CONTRACT_ADDRESS],
      },
    });
    return Number(result[0]);
  } catch (error) {
    console.error('Failed to get stream count:', error);
    return 0;
  }
}

export async function getClaimableAmount(streamId: number): Promise<bigint> {
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
}

export async function isContractInitialized(): Promise<boolean> {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::stream::is_initialized`,
        functionArguments: [CONTRACT_ADDRESS],
      },
    });
    return result[0] as boolean;
  } catch (error) {
    console.error('Failed to check initialization:', error);
    return false;
  }
}

export function buildCreateStreamPayload(params: CreateStreamParams): InputEntryFunctionData {
  return {
    function: `${CONTRACT_ADDRESS}::stream::create_stream`,
    functionArguments: [
      CONTRACT_ADDRESS,
      params.recipientAddress,
      Array.from(params.socialHash),
      params.amount.toString(),
      params.durationSeconds,
      params.startTime,
      params.message,
    ],
  };
}

export function buildClaimStreamPayload(streamId: number, amount: bigint = BigInt(0)): InputEntryFunctionData {
  return {
    function: `${CONTRACT_ADDRESS}::stream::claim_stream`,
    functionArguments: [
      CONTRACT_ADDRESS,
      streamId,
      amount.toString(),
    ],
  };
}

export function buildCancelStreamPayload(streamId: number): InputEntryFunctionData {
  return {
    function: `${CONTRACT_ADDRESS}::stream::cancel_stream`,
    functionArguments: [CONTRACT_ADDRESS, streamId],
  };
}