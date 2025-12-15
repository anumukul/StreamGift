import { GasStationClient } from '@shinami/clients/aptos';
import { env } from '../config/env.js';

const gasStation = new GasStationClient(env.SHINAMI_ACCESS_KEY);

export async function sponsorTransaction(
  transactionBytes: Uint8Array
): Promise<{
  sponsoredTransaction: Uint8Array;
  feePayerAddress: string;
  feePayerSignature: Uint8Array;
}> {
  const result = await gasStation.sponsorTransaction(transactionBytes);
  
  return {
    sponsoredTransaction: result.sponsoredTransaction,
    feePayerAddress: result.feePayerAddress,
    feePayerSignature: result.feePayerSignature,
  };
}

export async function getFundBalance(): Promise<bigint> {
  const fund = await gasStation.getFund();
  return BigInt(fund.balance);
}

export { gasStation };