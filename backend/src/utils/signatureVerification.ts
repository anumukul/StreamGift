import { verifyMessage } from 'viem';
import { createHash } from 'crypto';

/**
 * Message format that users sign to authorize transactions
 */
export interface AuthorizationMessage {
  action: 'create_stream' | 'claim_stream' | 'cancel_stream';
  params: Record<string, any>;
  timestamp: number;
  nonce: string;
}

/**
 * Generate a nonce for preventing replay attacks
 */
export function generateNonce(): string {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .slice(0, 16);
}

/**
 * Create the message that user should sign
 */
export function createAuthorizationMessage(
  action: AuthorizationMessage['action'],
  params: Record<string, any>
): { message: string; data: AuthorizationMessage } {
  const data: AuthorizationMessage = {
    action,
    params,
    timestamp: Math.floor(Date.now() / 1000),
    nonce: generateNonce(),
  };

  const message = `StreamGift Authorization\n\nAction: ${action}\nTimestamp: ${data.timestamp}\nNonce: ${data.nonce}\n\nParameters:\n${JSON.stringify(params, null, 2)}`;

  return { message, data };
}

/**
 * Verify that a signature is valid for the given message and address
 */
export async function verifySignature(
  message: string,
  signature: `0x${string}`,
  expectedAddress: string
): Promise<boolean> {
  try {
    const isValid = await verifyMessage({
      address: expectedAddress as `0x${string}`,
      message,
      signature,
    });
    return isValid;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Verify authorization for create_stream action
 */
export async function verifyCreateStreamAuthorization(params: {
  senderAddress: string;
  recipientAddress: string;
  amount: string;
  durationSeconds: number;
  message?: string;
  signature: string;
  signedMessage: string;
}): Promise<{ valid: boolean; error?: string }> {
  // Check timestamp is recent (within 5 minutes)
  const messageMatch = params.signedMessage.match(/Timestamp: (\d+)/);
  if (messageMatch) {
    const timestamp = parseInt(messageMatch[1]);
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 300) {
      return { valid: false, error: 'Authorization expired' };
    }
  }

  // Verify signature
  const isValid = await verifySignature(
    params.signedMessage,
    params.signature as `0x${string}`,
    params.senderAddress
  );

  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Verify authorization for claim_stream action
 */
export async function verifyClaimAuthorization(params: {
  recipientAddress: string;
  streamId: number;
  signature: string;
  signedMessage: string;
}): Promise<{ valid: boolean; error?: string }> {
  // Check timestamp
  const messageMatch = params.signedMessage.match(/Timestamp: (\d+)/);
  if (messageMatch) {
    const timestamp = parseInt(messageMatch[1]);
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 300) {
      return { valid: false, error: 'Authorization expired' };
    }
  }

  // Verify signature
  const isValid = await verifySignature(
    params.signedMessage,
    params.signature as `0x${string}`,
    params.recipientAddress
  );

  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Verify authorization for cancel_stream action
 */
export async function verifyCancelAuthorization(params: {
  senderAddress: string;
  streamId: number;
  signature: string;
  signedMessage: string;
}): Promise<{ valid: boolean; error?: string }> {
  // Check timestamp
  const messageMatch = params.signedMessage.match(/Timestamp: (\d+)/);
  if (messageMatch) {
    const timestamp = parseInt(messageMatch[1]);
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 300) {
      return { valid: false, error: 'Authorization expired' };
    }
  }

  // Verify signature
  const isValid = await verifySignature(
    params.signedMessage,
    params.signature as `0x${string}`,
    params.senderAddress
  );

  if (!isValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * Create a hash of social handle for on-chain storage
 */
export function createSocialHash(type: string, handle: string): Uint8Array {
  const normalized = `${type}:${handle.toLowerCase().replace('@', '')}`;
  const hash = createHash('sha256').update(normalized).digest();
  return new Uint8Array(hash);
}
