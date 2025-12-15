import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { AuthenticatedRequest, authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { hashSocialHandle } from '../utils/crypto.js';
import { registerRecipient, getClaimableAmount, getContractAddress } from '../services/movement.js';
import { sendStreamCreatedEmail } from '../services/notification.js';
import { env } from '../config/env.js';

const router = Router();
const prisma = new PrismaClient();

const createStreamSchema = z.object({
  recipientType: z.enum(['email', 'twitter', 'wallet']),
  recipientValue: z.string(),
  amount: z.string(),
  durationSeconds: z.number().positive(),
  startTime: z.number().optional(),
  message: z.string().optional(),
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = createStreamSchema.parse(req.body);
    const senderAddress = req.user!.walletAddress;

    if (!senderAddress) {
      res.status(400).json({ error: 'Sender wallet address not found' });
      return;
    }

    let recipientAddress: string;
    let socialHash: string | null = null;

    if (body.recipientType === 'wallet') {
      recipientAddress = body.recipientValue;
    } else {
      socialHash = hashSocialHandle(body.recipientType, body.recipientValue);
      
      const existingMapping = await prisma.socialMapping.findUnique({
        where: { socialHash },
      });

      if (existingMapping) {
        recipientAddress = existingMapping.walletAddress;
      } else {
        recipientAddress = `0x${nanoid(64).replace(/[^a-f0-9]/gi, '0').substring(0, 64)}`;
        
        await prisma.socialMapping.create({
          data: {
            socialType: body.recipientType,
            socialHandle: body.recipientValue,
            socialHash,
            walletAddress: recipientAddress,
          },
        });

        await registerRecipient(socialHash, recipientAddress);
      }
    }

    const startTime = body.startTime || Math.floor(Date.now() / 1000);
    const endTime = startTime + body.durationSeconds;
    const ratePerSecond = (BigInt(body.amount) / BigInt(body.durationSeconds)).toString();

    const stream = await prisma.stream.create({
      data: {
        id: nanoid(),
        onChainId: 0,
        senderAddress,
        recipientAddress,
        recipientSocialType: body.recipientType !== 'wallet' ? body.recipientType : null,
        recipientSocialHandle: body.recipientType !== 'wallet' ? body.recipientValue : null,
        recipientSocialHash: socialHash,
        totalAmount: body.amount,
        ratePerSecond,
        startTime: new Date(startTime * 1000),
        endTime: new Date(endTime * 1000),
        message: body.message,
      },
    });

    const claimUrl = `${env.FRONTEND_URL}/claim/${stream.id}`;

    if (body.recipientType === 'email') {
      const durationDays = Math.ceil(body.durationSeconds / 86400);
      await sendStreamCreatedEmail(body.recipientValue, {
        streamId: stream.id,
        senderName: senderAddress.substring(0, 8) + '...',
        amount: (BigInt(body.amount) / BigInt(1e8)).toString(),
        duration: `${durationDays} day${durationDays > 1 ? 's' : ''}`,
        message: body.message,
        claimUrl,
      });
    }

    res.status(201).json({
      stream: {
        id: stream.id,
        contractAddress: getContractAddress(),
        recipientAddress,
        claimUrl,
      },
      transaction: {
        function: `${getContractAddress()}::stream::create_stream`,
        arguments: [
          getContractAddress(),
          recipientAddress,
          socialHash ? Array.from(Buffer.from(socialHash, 'hex')) : [],
          body.amount,
          body.durationSeconds,
          startTime,
          body.message || '',
        ],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request body', details: error.errors });
      return;
    }
    console.error('Failed to prepare stream:', error);
    res.status(500).json({ error: 'Failed to prepare stream' });
  }
});

router.get('/:id', optionalAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.id },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    let claimable = '0';
    if (stream.onChainId > 0) {
      try {
        const claimableAmount = await getClaimableAmount(stream.onChainId);
        claimable = claimableAmount.toString();
      } catch {
        const now = Math.floor(Date.now() / 1000);
        const startTime = Math.floor(stream.startTime.getTime() / 1000);
        if (now > startTime) {
          const elapsed = now - startTime;
          const accrued = BigInt(elapsed) * BigInt(stream.ratePerSecond);
          const remaining = BigInt(stream.totalAmount) - BigInt(stream.claimedAmount);
          claimable = (accrued > remaining ? remaining : accrued).toString();
        }
      }
    }

    res.json({
      id: stream.id,
      onChainId: stream.onChainId,
      sender: stream.senderAddress,
      recipient: stream.recipientAddress,
      recipientSocial: stream.recipientSocialHandle
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
      createdAt: stream.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Failed to get stream:', error);
    res.status(500).json({ error: 'Failed to get stream' });
  }
});

router.get('/user/outgoing', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const streams = await prisma.stream.findMany({
      where: { senderAddress: req.user!.walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ streams });
  } catch (error) {
    console.error('Failed to get outgoing streams:', error);
    res.status(500).json({ error: 'Failed to get streams' });
  }
});

router.get('/user/incoming', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const streams = await prisma.stream.findMany({
      where: { recipientAddress: req.user!.walletAddress },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ streams });
  } catch (error) {
    console.error('Failed to get incoming streams:', error);
    res.status(500).json({ error: 'Failed to get streams' });
  }
});

router.patch('/:id/confirm', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { onChainId, transactionHash } = req.body;

    const stream = await prisma.stream.update({
      where: { id: req.params.id },
      data: { onChainId },
    });

    res.json({ stream });
  } catch (error) {
    console.error('Failed to confirm stream:', error);
    res.status(500).json({ error: 'Failed to confirm stream' });
  }
});

export default router;