import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { getClaimableAmount, getContractAddress } from '../services/movement.js';
import { sponsorTransaction } from '../services/shinami.js';
import { sendClaimConfirmationEmail } from '../services/notification.js';
import { env } from '../config/env.js';

const router = Router();
const prisma = new PrismaClient();

router.post('/:streamId/prepare', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.streamId },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    if (stream.recipientAddress !== req.user!.walletAddress) {
      const mapping = await prisma.socialMapping.findFirst({
        where: {
          walletAddress: stream.recipientAddress,
          claimed: false,
        },
      });

      if (!mapping) {
        res.status(403).json({ error: 'You are not the recipient of this stream' });
        return;
      }

      await prisma.socialMapping.update({
        where: { id: mapping.id },
        data: {
          walletAddress: req.user!.walletAddress!,
          claimed: true,
        },
      });

      await prisma.stream.update({
        where: { id: stream.id },
        data: { recipientAddress: req.user!.walletAddress! },
      });
    }

    const amount = req.body.amount || 0;

    res.json({
      transaction: {
        function: `${getContractAddress()}::stream::claim_stream`,
        arguments: [
          getContractAddress(),
          stream.onChainId,
          amount,
        ],
      },
      sponsorship: {
        enabled: true,
        message: 'This transaction is sponsored. You pay no gas fees.',
      },
    });
  } catch (error) {
    console.error('Failed to prepare claim:', error);
    res.status(500).json({ error: 'Failed to prepare claim' });
  }
});

router.post('/:streamId/sponsor', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { transactionBytes } = req.body;

    if (!transactionBytes) {
      res.status(400).json({ error: 'Transaction bytes required' });
      return;
    }

    const bytes = new Uint8Array(Buffer.from(transactionBytes, 'base64'));
    const result = await sponsorTransaction(bytes);

    res.json({
      sponsoredTransaction: Buffer.from(result.sponsoredTransaction).toString('base64'),
      feePayerAddress: result.feePayerAddress,
      feePayerSignature: Buffer.from(result.feePayerSignature).toString('base64'),
    });
  } catch (error) {
    console.error('Failed to sponsor transaction:', error);
    res.status(500).json({ error: 'Failed to sponsor transaction' });
  }
});

router.post('/:streamId/confirm', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amountClaimed, transactionHash } = req.body;
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.streamId },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    const newClaimedAmount = (BigInt(stream.claimedAmount) + BigInt(amountClaimed)).toString();
    const isComplete = BigInt(newClaimedAmount) >= BigInt(stream.totalAmount);

    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        claimedAmount: newClaimedAmount,
        status: isComplete ? 'COMPLETED' : 'ACTIVE',
      },
    });

    if (stream.recipientSocialType === 'email' && stream.recipientSocialHandle) {
      const remainingAmount = (BigInt(stream.totalAmount) - BigInt(newClaimedAmount)).toString();
      await sendClaimConfirmationEmail(
        stream.recipientSocialHandle,
        (BigInt(amountClaimed) / BigInt(1e8)).toString(),
        (BigInt(remainingAmount) / BigInt(1e8)).toString(),
        `${env.FRONTEND_URL}/claim/${stream.id}`
      );
    }

    res.json({
      success: true,
      claimedAmount: amountClaimed,
      totalClaimed: newClaimedAmount,
      status: isComplete ? 'COMPLETED' : 'ACTIVE',
    });
  } catch (error) {
    console.error('Failed to confirm claim:', error);
    res.status(500).json({ error: 'Failed to confirm claim' });
  }
});

export default router;