import { PrivyClient } from '@privy-io/server-auth';
import { env } from '../config/env.js';

const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET);

export async function verifyAuthToken(authToken: string): Promise<any> {
  try {
    const verifiedClaims = await privy.verifyAuthToken(authToken);
    return verifiedClaims;
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}

export async function getUser(privyId: string): Promise<any> {
  try {
    const user = await privy.getUser(privyId);
    return user;
  } catch (error) {
    return null;
  }
}

export async function createWalletForUser(privyId: string): Promise<string> {
  const user = await privy.getUser(privyId);

  if (user.wallet) {
    return user.wallet.address;
  }

  throw new Error('User does not have an embedded wallet');
}

export async function verifyUserWallet(privyId: string, walletAddress: string): Promise<boolean> {
  try {
    const user = await privy.getUser(privyId);
    const normalizedWallet = walletAddress.toLowerCase();

    if (user.wallet?.address?.toLowerCase() === normalizedWallet) {
      return true;
    }

    if (user.linkedAccounts) {
      for (const account of user.linkedAccounts) {
        if (account.type === 'wallet' &&
            (account as any).address?.toLowerCase() === normalizedWallet) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Failed to verify user wallet:', error);
    return false;
  }
}

export { privy };