import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import {
  createStreamOnChain,
  getClaimableOnChain,
  cancelStreamOnChain,
} from '../services/movementBlockchain.js';
import {
  verifyCreateStreamAuthorization,
  createSocialHash,
  createAuthorizationMessage,
} from '../utils/signatureVerification.js';
import { sendStreamNotificationEmail } from '../services/notification.js';
import { env } from '../config/env.js';

const router = Router();
const prisma = new PrismaClient();

// Schema for creating a stream
const createStreamSchema = z.object({
  recipientType: z.enum(['email', 'twitter', 'wallet']),
  recipientValue: z.string(),
  amount: z.string(),
  durationSeconds: z.number().positive(),
  startTime: z.number().optional(),
  message: z.string().optional(),
  senderAddress: z.string(),
  // Signature fields for on-chain authorization
  signature: z.string().optional(),
  signedMessage: z.string().optional(),
});

// Get authorization message to sign (called before creating stream)
router.post('/prepare-create', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { recipientType, recipientValue, amount, durationSeconds, message, senderAddress } = req.body;

    const { message: authMessage, data } = createAuthorizationMessage('create_stream', {
      recipientType,
      recipientValue,
      amount,
      durationSeconds,
      message: message || '',
      senderAddress,
    });

    res.json({
      message: authMessage,
      data,
      instructions: 'Sign this message with your wallet to authorize the stream creation',
    });
  } catch (error) {
    console.error('Failed to prepare stream creation:', error);
    res.status(500).json({ error: 'Failed to prepare stream creation' });
  }
});

// Create a new stream
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = createStreamSchema.parse(req.body);

    const senderAddress = body.senderAddress;
    if (!senderAddress) {
      res.status(400).json({ error: 'Sender address is required' });
      return;
    }

    // Determine recipient address
    let recipientAddress = '';
    let socialHash = new Uint8Array(32);

    if (body.recipientType === 'wallet') {
  recipientAddress = body.recipientValue;
} else {
  // For email/twitter, check if they have a registered address
  const existingMapping = await prisma.socialMapping.findUnique({
    where: {
      socialType_socialHandle: {
        socialType: body.recipientType,
        socialHandle: body.recipientValue.toLowerCase().replace('@', ''),
      },
    },
  });

      if (existingMapping) {
        recipientAddress = existingMapping.walletAddress;
      } else {
        // Use a placeholder address - recipient will register their address when claiming
        recipientAddress = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }

      socialHash = createSocialHash(body.recipientType, body.recipientValue);
    }

    const startTime = body.startTime || Math.floor(Date.now() / 1000);
    const endTime = startTime + body.durationSeconds;
    const ratePerSecond = (BigInt(body.amount) / BigInt(body.durationSeconds)).toString();

    // If signature provided, verify and submit on-chain
    let onChainId = 0;
    let transactionHash: string | undefined;
    let onChainStatus = 'PENDING';

    if (body.signature && body.signedMessage) {
      // Verify the signature
      const verification = await verifyCreateStreamAuthorization({
        senderAddress,
        recipientAddress,
        amount: body.amount,
        durationSeconds: body.durationSeconds,
        message: body.message,
        signature: body.signature,
        signedMessage: body.signedMessage,
      });

      if (!verification.valid) {
        res.status(400).json({ error: verification.error || 'Invalid authorization' });
        return;
      }

      // Submit to blockchain
      try {
        const onChainResult = await createStreamOnChain({
          senderAddress,
          recipientAddress,
          socialHash,
          amount: body.amount,
          durationSeconds: body.durationSeconds,
          startTime,
          message: body.message || '',
          signature: body.signature,
        });

        onChainId = onChainResult.streamId;
        transactionHash = onChainResult.hash;
        onChainStatus = 'CONFIRMED';
        console.log(`Stream created on-chain: ID ${onChainId}, TX: ${transactionHash}`);
      } catch (onChainError: any) {
        console.error('On-chain creation failed:', onChainError);
        // Continue with database-only creation for demo purposes
        onChainStatus = 'FAILED';
      }
    }

    // Convert socialHash to hex string for storage
    const socialHashHex = body.recipientType !== 'wallet'
      ? Buffer.from(socialHash).toString('hex')
      : null;

    // Save to database
    const stream = await prisma.stream.create({
      data: {
        senderAddress,
        recipientAddress,
        recipientSocialType: body.recipientType !== 'wallet' ? body.recipientType : null,
        recipientSocialHandle: body.recipientType !== 'wallet' ? body.recipientValue.toLowerCase().replace('@', '') : null,
        recipientSocialHash: socialHashHex,
        totalAmount: body.amount,
        claimedAmount: '0',
        ratePerSecond,
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        message: body.message || null,
        status: 'ACTIVE',
        onChainId,
      },
    });

    // Send notification email if recipient is email
    if (body.recipientType === 'email') {
      const claimUrl = `${env.FRONTEND_URL}/claim/${stream.id}`;
      try {
        await sendStreamNotificationEmail(
          body.recipientValue,
          (BigInt(body.amount) / BigInt(1e8)).toString(),
          claimUrl
        );
      } catch (emailError) {
        console.error('Failed to send notification email:', emailError);
      }
    }

    res.status(201).json({
      stream: {
        id: stream.id,
        onChainId: Number(stream.onChainId),
        sender: stream.senderAddress,
        recipient: stream.recipientAddress,
        recipientSocial: stream.recipientSocialType
          ? { type: stream.recipientSocialType, handle: stream.recipientSocialHandle }
          : null,
        totalAmount: stream.totalAmount,
        claimedAmount: stream.claimedAmount,
        ratePerSecond: stream.ratePerSecond,
        startTime: stream.startTime.toISOString(),
        endTime: stream.endTime.toISOString(),
        message: stream.message,
        status: stream.status,
      },
      transaction: {
        hash: transactionHash,
        status: onChainStatus,
        explorerUrl: transactionHash
          ? `https://explorer.movementnetwork.xyz/txn/${transactionHash}?network=bardock+testnet`
          : null,
      },
    });
  } catch (error) {
    console.error('Failed to create stream:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request body', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create stream' });
  }
});

// Get a specific stream
router.get('/:id', async (req, res) => {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.id },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    // Calculate current claimable amount
    // Formula: claimable = min(totalAccrued, totalAmount) - claimedAmount
    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(stream.startTime.getTime() / 1000);
    const endTime = Math.floor(stream.endTime.getTime() / 1000);
    let claimable = '0';

    if (now > startTime && stream.status === 'ACTIVE') {
      const effectiveTime = Math.min(now, endTime);
      const elapsed = effectiveTime - startTime;
      const totalAccrued = BigInt(elapsed) * BigInt(stream.ratePerSecond);
      // Cap at totalAmount, then subtract what's already claimed
      const cappedAccrued = totalAccrued > BigInt(stream.totalAmount) ? BigInt(stream.totalAmount) : totalAccrued;
      const claimableAmount = cappedAccrued - BigInt(stream.claimedAmount);
      claimable = (claimableAmount > 0n ? claimableAmount : 0n).toString();
    }

    // Try to get on-chain claimable if available
    const onChainIdNum = Number(stream.onChainId);
    if (onChainIdNum > 0) {
      try {
        const onChainClaimable = await getClaimableOnChain(onChainIdNum);
        if (onChainClaimable > 0n) {
          claimable = onChainClaimable.toString();
        }
      } catch (e) {
        // Use calculated value
      }
    }

    res.json({
      id: stream.id,
      onChainId: onChainIdNum,
      sender: stream.senderAddress,
      recipient: stream.recipientAddress,
      recipientSocial: stream.recipientSocialType
        ? { type: stream.recipientSocialType, handle: stream.recipientSocialHandle }
        : null,
      totalAmount: stream.totalAmount,
      claimedAmount: stream.claimedAmount,
      claimable,
      ratePerSecond: stream.ratePerSecond,
      startTime: stream.startTime.toISOString(),
      endTime: stream.endTime.toISOString(),
      message: stream.message,
      status: stream.status,
    });
  } catch (error) {
    console.error('Failed to get stream:', error);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

// Get outgoing streams for a user
router.get('/user/outgoing', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;

    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address required' });
      return;
    }

    const streams = await prisma.stream.findMany({
      where: { senderAddress: walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      streams: streams.map((stream) => ({
        id: stream.id,
        onChainId: Number(stream.onChainId),
        sender: stream.senderAddress,
        recipient: stream.recipientAddress,
        recipientSocial: stream.recipientSocialType
          ? { type: stream.recipientSocialType, handle: stream.recipientSocialHandle }
          : null,
        totalAmount: stream.totalAmount,
        claimedAmount: stream.claimedAmount,
        ratePerSecond: stream.ratePerSecond,
        startTime: stream.startTime.toISOString(),
        endTime: stream.endTime.toISOString(),
        message: stream.message,
        status: stream.status,
      })),
    });
  } catch (error) {
    console.error('Failed to get outgoing streams:', error);
    res.status(500).json({ error: 'Failed to get outgoing streams' });
  }
});

// Get incoming streams for a user
// Get incoming streams for a user

  // Get incoming streams for a user
router.get('/user/incoming', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const walletAddress = req.query.walletAddress as string;
    const email = req.query.email as string;

    if (!walletAddress && !email) {
      res.status(400).json({ error: 'Wallet address or email required' });
      return;
    }

    // Build OR conditions for finding streams
    const orConditions: any[] = [];
    
    if (walletAddress) {
      orConditions.push({ recipientAddress: walletAddress });
    }
    
    if (email) {
  orConditions.push({ 
    recipientSocialType: 'email', 
    recipientSocialHandle: email.toLowerCase().replace('@', '') 
  });
}

    const streams = await prisma.stream.findMany({
      where: {
        OR: orConditions,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      streams: streams.map((stream) => ({
        id: stream.id,
        onChainId: Number(stream.onChainId),
        sender: stream.senderAddress,
        recipient: stream.recipientAddress,
        recipientSocial: stream.recipientSocialType
          ? { type: stream.recipientSocialType, handle: stream.recipientSocialHandle }
          : null,
        totalAmount: stream.totalAmount,
        claimedAmount: stream.claimedAmount,
        ratePerSecond: stream.ratePerSecond,
        startTime: stream.startTime.toISOString(),
        endTime: stream.endTime.toISOString(),
        message: stream.message,
        status: stream.status,
      })),
    });
  } catch (error) {
    console.error('Failed to get incoming streams:', error);
    res.status(500).json({ error: 'Failed to get incoming streams' });
  }
});

// Cancel a stream (sender only)
router.post('/:id/cancel', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.id },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    const userWalletAddress = req.body.walletAddress || req.user!.walletAddress;

    if (!userWalletAddress) {
      res.status(400).json({ error: 'No wallet address provided' });
      return;
    }

    // Verify the user is the stream creator
    if (stream.senderAddress.toLowerCase() !== userWalletAddress.toLowerCase()) {
      res.status(403).json({ error: 'Only the stream creator can cancel this stream' });
      return;
    }

    if (stream.status !== 'ACTIVE') {
      res.status(400).json({ error: `Cannot cancel stream with status: ${stream.status}` });
      return;
    }

    if (stream.onChainId <= 0) {
      res.status(400).json({ error: 'Stream not found on-chain' });
      return;
    }

    // Calculate refund amounts
    const totalAmount = BigInt(stream.totalAmount);
    const claimedAmount = BigInt(stream.claimedAmount);
    const now = Math.floor(Date.now() / 1000);
    const startTime = Math.floor(stream.startTime.getTime() / 1000);
    const elapsed = Math.max(0, now - startTime);
    const accrued = BigInt(elapsed) * BigInt(stream.ratePerSecond);
    const remaining = totalAmount - claimedAmount;
    const claimableByRecipient = accrued > remaining ? remaining : accrued;
    const refundToSender = remaining - claimableByRecipient;

    // Execute on-chain cancellation
    let txResult;
    try {
      console.log(`Cancelling stream ${stream.onChainId} for sender ${stream.senderAddress}`);
      txResult = await cancelStreamOnChain(stream.onChainId, stream.senderAddress);
      console.log(`Stream cancelled successfully. Tx: ${txResult.hash}`);
    } catch (cancelError: any) {
      console.error('Failed to cancel stream on-chain:', cancelError);
      res.status(500).json({
        error: 'Failed to cancel stream on blockchain',
        details: cancelError.message,
      });
      return;
    }

    // Update database
    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        status: 'CANCELLED',
      },
    });

    res.json({
      success: true,
      refundedAmount: refundToSender.toString(),
      recipientAmount: claimableByRecipient.toString(),
      transaction: {
        hash: txResult.hash,
        explorerUrl: `https://explorer.movementnetwork.xyz/txn/${txResult.hash}?network=bardock+testnet`,
      },
    });
  } catch (error: any) {
    console.error('Failed to cancel stream:', error);
    res.status(500).json({ error: 'Failed to cancel stream', details: error.message });
  }
});

export default router;
