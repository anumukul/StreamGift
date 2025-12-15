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
import { hashToBytes } from '../utils/crypto.js';

const config = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: env.MOVEMENT_NODE_URL,
});

const aptos = new Aptos(config);

const adminPrivateKey = new Ed25519PrivateKey(env.ADMIN_PRIVATE_KEY);
const adminAccount = Account.fromPrivateKey({ privateKey: adminPrivateKey });

export async function registerRecipient(
  socialHash: string,
  recipientAddress: string
): Promise<string> {
  const payload: InputEntryFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::register_recipient`,
    functionArguments: [
      Array.from(hashToBytes(socialHash)),
      recipientAddress,
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

  return committedTxn.hash;
}

export async function getStreamDetails(streamId: number): Promise<any> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_stream`,
    functionArguments: [env.CONTRACT_ADDRESS, streamId],
  };

  const result = await aptos.view({ payload });
  return result[0];
}

export async function getClaimableAmount(streamId: number): Promise<bigint> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_claimable`,
    functionArguments: [env.CONTRACT_ADDRESS, streamId],
  };

  const result = await aptos.view({ payload });
  return BigInt(result[0] as string);
}

export async function getStreamCount(): Promise<number> {
  const payload: InputViewFunctionData = {
    function: `${env.CONTRACT_ADDRESS}::stream::get_stream_count`,
    functionArguments: [env.CONTRACT_ADDRESS],
  };

  const result = await aptos.view({ payload });
  return Number(result[0]);
}

export function getContractAddress(): string {
  return env.CONTRACT_ADDRESS;
}

export { aptos, adminAccount };