import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  Ed25519PrivateKey,
  InputViewFunctionData,
  InputEntryFunctionData,
} from '@aptos-labs/ts-sdk';
import { env } from '../config/env.js';

// ============================================
// CONFIGURATION
// ============================================

const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: env.MOVEMENT_NODE_URL,
});

export const aptos = new Aptos(config);

const adminPrivateKey = new Ed25519PrivateKey(env.ADMIN_PRIVATE_KEY);
export const adminAccount = Account.fromPrivateKey({ privateKey: adminPrivateKey });

function hashToBytes(hexString: string): Uint8Array {
  const hex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function normalizeAddress(address: string): string {
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  const paddedAddress = cleanAddress.padStart(64, '0');
  return '0x' + paddedAddress;
}

// ============================================
// STREAM FUNCTIONS
// ============================================

export async function createStreamOnChain(params: {
  senderAddress: string;
  recipientAddress: string;
  socialHash: Uint8Array | string;
  amount: string;
  durationSeconds: number;
  startTime?: number;
  message: string;
  signature?: string;
}): Promise<{ hash: string; streamId: number }> {
  const {
    recipientAddress,
    socialHash,
    amount,
    durationSeconds,
    startTime = Math.floor(Date.now() / 1000),
    message,
  } = params;

  const socialHashBytes = typeof socialHash === 'string' 
    ? Array.from(hashToBytes(socialHash))
    : Array.from(socialHash);

  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::create_stream`,
    functionArguments: [
      env.CONTRACT_ADDRESS,
      normalizeAddress(recipientAddress),
      socialHashBytes,
      amount,
      durationSeconds,
      startTime,
      message,
    ],
  };

  const transaction = await aptos.transaction.build.simple({
    sender: adminAccount.accountAddress,
    data: payload,
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: adminAccount,
    transaction,
  });

  const result = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

  if (!result.success) {
    throw new Error(`Failed to create stream: ${result.vm_status}`);
  }

  const streamCount = await getStreamCountOnChain();
  console.log(`Stream created on-chain. ID: ${streamCount}, Tx: ${committedTxn.hash}`);
  return { hash: committedTxn.hash, streamId: streamCount };
}

export async function cancelStreamOnChain(streamId: number): Promise<string> {
  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::cancel_stream`,
    functionArguments: [env.CONTRACT_ADDRESS, streamId],
  };

  const transaction = await aptos.transaction.build.simple({
    sender: adminAccount.accountAddress,
    data: payload,
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: adminAccount,
    transaction,
  });

  await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
  return committedTxn.hash;
}

export async function registerRecipient(
  socialHash: string,
  recipientAddress: string
): Promise<string> {
  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::register_recipient`,
    functionArguments: [
      Array.from(hashToBytes(socialHash)),
      normalizeAddress(recipientAddress),
    ],
  };

  const transaction = await aptos.transaction.build.simple({
    sender: adminAccount.accountAddress,
    data: payload,
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: adminAccount,
    transaction,
  });

  await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
  console.log(`Registered recipient: ${recipientAddress}`);
  return committedTxn.hash;
}

export async function updateStreamRecipientOnChain(
  streamId: number,
  newRecipientAddress: string,
  socialHash: string
): Promise<string> {
  const normalizedAddress = normalizeAddress(newRecipientAddress);
  console.log(`Updating stream ${streamId} recipient to ${normalizedAddress}`);

  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::update_stream_recipient`,
    functionArguments: [
      env.CONTRACT_ADDRESS,
      streamId,
      normalizedAddress,
      Array.from(hashToBytes(socialHash)),
    ],
  };

  const transaction = await aptos.transaction.build.simple({
    sender: adminAccount.accountAddress,
    data: payload,
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: adminAccount,
    transaction,
  });

  const result = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
  
  if (!result.success) {
    throw new Error(`Failed to update stream recipient: ${result.vm_status}`);
  }

  console.log(`Stream ${streamId} recipient updated. Tx: ${committedTxn.hash}`);
  return committedTxn.hash;
}

export async function withdrawFees(amount: bigint): Promise<string> {
  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::withdraw_fees`,
    functionArguments: [env.CONTRACT_ADDRESS, amount.toString()],
  };

  const transaction = await aptos.transaction.build.simple({
    sender: adminAccount.accountAddress,
    data: payload,
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: adminAccount,
    transaction,
  });

  await aptos.waitForTransaction({ transactionHash: committedTxn.hash });
  return committedTxn.hash;
}

export async function claimStreamAsAdmin(
  streamId: number,
  recipientAddress: string,
  amount: bigint
): Promise<{ hash: string; claimedAmount: string }> {
  const normalizedRecipient = normalizeAddress(recipientAddress);
  console.log(`Admin claiming stream ${streamId} for recipient ${normalizedRecipient}, amount: ${amount}`);

  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::admin_claim_for_recipient`,
    functionArguments: [
      env.CONTRACT_ADDRESS,
      streamId,
      normalizedRecipient,
      amount.toString(),
    ],
  };

  const transaction = await aptos.transaction.build.simple({
    sender: adminAccount.accountAddress,
    data: payload,
  });

  const committedTxn = await aptos.signAndSubmitTransaction({
    signer: adminAccount,
    transaction,
  });

  const result = await aptos.waitForTransaction({ transactionHash: committedTxn.hash });

  if (!result.success) {
    throw new Error(`Failed to claim stream: ${result.vm_status}`);
  }

  console.log(`Stream ${streamId} claimed successfully. Tx: ${committedTxn.hash}`);
  return { hash: committedTxn.hash, claimedAmount: amount.toString() };
}

// ============================================
// VIEW FUNCTIONS
// ============================================

export async function getStreamDetails(streamId: number) {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_stream`,
    functionArguments: [env.CONTRACT_ADDRESS, streamId],
  };

  const result = await aptos.view({ payload });
  
  const [
    id, sender, recipient, recipientSocialHash,
    totalAmount, claimedAmount, ratePerSecond,
    startTime, endTime, lastClaimTime,
    message, status, createdAt
  ] = result as any[];

  return {
    id: Number(id),
    sender: sender as string,
    recipient: recipient as string,
    recipientSocialHash: Buffer.from(recipientSocialHash).toString('hex'),
    totalAmount: BigInt(totalAmount),
    claimedAmount: BigInt(claimedAmount),
    ratePerSecond: BigInt(ratePerSecond),
    startTime: Number(startTime),
    endTime: Number(endTime),
    lastClaimTime: Number(lastClaimTime),
    message: message as string,
    status: Number(status),
    createdAt: Number(createdAt),
  };
}

export async function getClaimableOnChain(streamId: number): Promise<bigint> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_claimable`,
    functionArguments: [env.CONTRACT_ADDRESS, streamId],
  };

  const result = await aptos.view({ payload });
  return BigInt(result[0] as string);
}

// Alias for claim.ts
export const getClaimableAmount = getClaimableOnChain;

export async function getStreamCountOnChain(): Promise<number> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_stream_count`,
    functionArguments: [env.CONTRACT_ADDRESS],
  };

  const result = await aptos.view({ payload });
  return Number(result[0]);
}

// Alias
export const getStreamCount = getStreamCountOnChain;

export async function getFeeCollected(): Promise<bigint> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_fee_collected`,
    functionArguments: [env.CONTRACT_ADDRESS],
  };

  const result = await aptos.view({ payload });
  return BigInt(result[0] as string);
}

export async function isInitialized(): Promise<boolean> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::is_initialized`,
    functionArguments: [env.CONTRACT_ADDRESS],
  };

  const result = await aptos.view({ payload });
  return result[0] as boolean;
}

export async function getUserOutgoingStreams(userAddress: string): Promise<number[]> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_user_outgoing_streams`,
    functionArguments: [userAddress],
  };

  const result = await aptos.view({ payload });
  return (result[0] as any[]).map(Number);
}

export async function getUserIncomingStreams(userAddress: string): Promise<number[]> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_user_incoming_streams`,
    functionArguments: [userAddress],
  };

  const result = await aptos.view({ payload });
  return (result[0] as any[]).map(Number);
}

// ============================================
// HELPERS
// ============================================

export function getContractAddress(): string {
  return env.CONTRACT_ADDRESS;
}

export function getAdminAddress(): string {
  return adminAccount.accountAddress.toString();
}

export function calculateClaimableLocally(
  totalAmount: bigint,
  claimedAmount: bigint,
  ratePerSecond: bigint,
  startTime: number,
  endTime: number,
  lastClaimTime: number
): bigint {
  const currentTime = Math.floor(Date.now() / 1000);
  
  if (currentTime < startTime) return 0n;

  const effectiveTime = currentTime > endTime ? endTime : currentTime;
  const elapsed = effectiveTime - lastClaimTime;
  const accrued = BigInt(elapsed) * ratePerSecond;
  const remaining = totalAmount - claimedAmount;

  return accrued > remaining ? remaining : accrued;
}

// ============================================
// WALLET FUNCTIONS
// ============================================

export async function initializeBackendWallet(): Promise<void> {
  console.log(`Backend wallet initialized: ${adminAccount.accountAddress.toString()}`);
}

export async function checkBackendWallet(): Promise<{ address: string; balance: bigint }> {
  const address = adminAccount.accountAddress.toString();
  
  try {
    const resources = await aptos.getAccountResources({ accountAddress: adminAccount.accountAddress });
    const coinResource = resources.find((r: any) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
    const balance = coinResource ? BigInt((coinResource.data as any).coin.value) : 0n;
    
    console.log(`Backend wallet: ${address}, Balance: ${balance} octas`);
    return { address, balance };
  } catch (error) {
    console.log(`Backend wallet: ${address}, Balance: Unable to fetch`);
    return { address, balance: 0n };
  }
}