import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import {
  getClaimableAmount,
  updateStreamRecipientOnChain,
  claimStreamAsAdmin,
} from '../services/movementBlockchain.js';
import { sendClaimConfirmationEmail } from '../services/notification.js';
import { verifyUserWallet } from '../services/privy.js';
import { env } from '../config/env.js';

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/claim/:streamId/prepare
 * Prepare a claim - handles email-based authorization
 */
router.post('/:streamId/prepare', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.streamId },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    const userEmail = req.body.email;
    let userWalletAddress = req.body.walletAddress || req.user!.walletAddress;

    if (!userWalletAddress) {
      res.status(400).json({ error: 'No wallet address provided' });
      return;
    }

    if (req.body.walletAddress) {
      const isValid = await verifyUserWallet(req.user!.privyId, req.body.walletAddress);
      if (!isValid) {
        res.status(403).json({ error: 'Wallet address does not belong to authenticated user' });
        return;
      }
    }

    const isEmailStream = stream.recipientSocialType === 'email' && stream.recipientSocialHandle;
    
    let isAuthorized = false;
    let needsOnChainUpdate = false;

    if (stream.recipientAddress === userWalletAddress) {
      isAuthorized = true;
    } else if (isEmailStream && userEmail) {
      const normalizedUserEmail = userEmail.toLowerCase().replace('@', '');
      const normalizedStreamEmail = stream.recipientSocialHandle!.toLowerCase().replace('@', '');
      
      if (normalizedUserEmail === normalizedStreamEmail) {
        isAuthorized = true;
        needsOnChainUpdate = stream.recipientAddress !== userWalletAddress;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ 
        error: 'You are not authorized to claim this stream',
      });
      return;
    }

    // Update recipient on-chain FIRST if needed
    if (needsOnChainUpdate) {
      if (stream.onChainId <= 0) {
        console.warn(`Stream ${stream.id} has invalid onChainId: ${stream.onChainId}, skipping on-chain update`);
      } else if (!stream.recipientSocialHash) {
        console.warn(`Stream ${stream.id} has no socialHash, skipping on-chain update`);
      } else {
        console.log(`Updating stream ${stream.onChainId} recipient from ${stream.recipientAddress} to ${userWalletAddress}`);
        console.log(`Social hash: ${stream.recipientSocialHash}`);

        try {
          const txHash = await updateStreamRecipientOnChain(
            stream.onChainId,
            userWalletAddress,
            stream.recipientSocialHash
          );

          console.log(`On-chain recipient updated successfully. Tx: ${txHash}`);

          await prisma.stream.update({
            where: { id: stream.id },
            data: { recipientAddress: userWalletAddress },
          });

          await prisma.socialMapping.upsert({
            where: { socialHash: stream.recipientSocialHash },
            update: { walletAddress: userWalletAddress, claimed: true },
            create: {
              socialType: stream.recipientSocialType!,
              socialHandle: stream.recipientSocialHandle!,
              socialHash: stream.recipientSocialHash,
              walletAddress: userWalletAddress,
              claimed: true,
            },
          });

        } catch (error: any) {
          console.error('Failed to update recipient on-chain:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          res.status(500).json({
            error: 'Failed to update stream recipient on blockchain',
            details: error.message
          });
          return;
        }
      }
    }

    // Generate authorization message for the user to sign
    const timestamp = Date.now();
    const authMessage = `Claim stream ${stream.id}\nWallet: ${userWalletAddress}\nTimestamp: ${timestamp}`;

    res.json({
      stream: {
        id: stream.id,
        onChainId: stream.onChainId,
        claimable: stream.totalAmount,
        totalAmount: stream.totalAmount,
        claimedAmount: stream.claimedAmount,
      },
      authorization: {
        message: authMessage,
        data: {
          streamId: stream.id,
          onChainId: stream.onChainId,
          walletAddress: userWalletAddress,
          timestamp,
        },
      },
      instructions: 'Sign this message to authorize the claim',
      recipientUpdated: needsOnChainUpdate,
    });
  } catch (error: any) {
    console.error('Failed to prepare claim:', error);
    res.status(500).json({ error: 'Failed to prepare claim', details: error.message });
  }
});

/**
 * POST /api/claim/:streamId/execute
 */
router.post('/:streamId/execute', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stream = await prisma.stream.findUnique({
      where: { id: req.params.streamId },
    });

    if (!stream) {
      res.status(404).json({ error: 'Stream not found' });
      return;
    }

    const userEmail = req.body.email;
    let userWalletAddress = req.body.walletAddress || req.user!.walletAddress;

    if (!userWalletAddress) {
      res.status(400).json({ error: 'No wallet address provided' });
      return;
    }

    if (req.body.walletAddress) {
      const isValid = await verifyUserWallet(req.user!.privyId, req.body.walletAddress);
      if (!isValid) {
        res.status(403).json({ error: 'Wallet address does not belong to authenticated user' });
        return;
      }
    }

    const isEmailStream = stream.recipientSocialType === 'email' && stream.recipientSocialHandle;
    let isAuthorized = false;

    if (stream.recipientAddress === userWalletAddress) {
      isAuthorized = true;
    } else if (isEmailStream && userEmail) {
      const normalizedUserEmail = userEmail.toLowerCase().replace('@', '');
      const normalizedStreamEmail = stream.recipientSocialHandle!.toLowerCase().replace('@', '');
      if (normalizedUserEmail === normalizedStreamEmail) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      res.status(403).json({ error: 'Not authorized to claim this stream' });
      return;
    }

    if (stream.recipientAddress !== userWalletAddress && stream.onChainId > 0 && stream.recipientSocialHash) {
      try {
        await updateStreamRecipientOnChain(stream.onChainId, userWalletAddress, stream.recipientSocialHash);
        await prisma.stream.update({
          where: { id: stream.id },
          data: { recipientAddress: userWalletAddress },
        });
      } catch (error: any) {
        console.error('Failed to update recipient:', error);
        res.status(500).json({ error: 'Failed to update stream recipient' });
        return;
      }
    }

    let claimableAmount: bigint;
    try {
      claimableAmount = await getClaimableAmount(stream.onChainId);
    } catch {
      const now = Math.floor(Date.now() / 1000);
      const startTime = Math.floor(stream.startTime.getTime() / 1000);
      const elapsed = Math.max(0, now - startTime);
      const accrued = BigInt(elapsed) * BigInt(stream.ratePerSecond);
      const remaining = BigInt(stream.totalAmount) - BigInt(stream.claimedAmount);
      claimableAmount = accrued > remaining ? remaining : accrued;
    }

    if (claimableAmount <= 0n) {
      res.status(400).json({ error: 'Nothing to claim yet' });
      return;
    }

    const claimAmount = req.body.amount ? BigInt(req.body.amount) : claimableAmount;
    const actualClaimAmount = claimAmount > claimableAmount ? claimableAmount : claimAmount;

    // Actually execute the on-chain claim
    if (stream.onChainId <= 0) {
      res.status(400).json({ error: 'Stream not found on-chain' });
      return;
    }

    let txResult;
    try {
      console.log(`Executing on-chain claim for stream ${stream.onChainId}, recipient ${userWalletAddress}, amount ${actualClaimAmount}`);
      txResult = await claimStreamAsAdmin(
        stream.onChainId,
        userWalletAddress,
        actualClaimAmount
      );
      console.log(`Claim executed successfully. Tx: ${txResult.hash}`);
    } catch (claimError: any) {
      console.error('Failed to execute on-chain claim:', claimError);
      res.status(500).json({
        error: 'Failed to execute claim on blockchain',
        details: claimError.message,
      });
      return;
    }

    // Update database
    const newClaimedAmount = (BigInt(stream.claimedAmount) + actualClaimAmount).toString();
    const isComplete = BigInt(newClaimedAmount) >= BigInt(stream.totalAmount);

    await prisma.stream.update({
      where: { id: stream.id },
      data: {
        claimedAmount: newClaimedAmount,
        status: isComplete ? 'COMPLETED' : 'ACTIVE',
      },
    });

    res.json({
      success: true,
      claimedAmount: actualClaimAmount.toString(),
      totalClaimed: newClaimedAmount,
      remaining: (BigInt(stream.totalAmount) - BigInt(newClaimedAmount)).toString(),
      status: isComplete ? 'COMPLETED' : 'ACTIVE',
      transaction: {
        hash: txResult.hash,
        onChain: true,
        explorerUrl: `https://explorer.movementnetwork.xyz/txn/${txResult.hash}?network=bardock+testnet`,
      },
    });
  } catch (error: any) {
    console.error('Failed to execute claim:', error);
    res.status(500).json({ error: 'Failed to execute claim', details: error.message });
  }
});

/**
 * POST /api/claim/:streamId/confirm
 */
router.post('/:streamId/confirm', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { amountClaimed, transactionHash } = req.body;
    
    if (!amountClaimed) {
      res.status(400).json({ error: 'amountClaimed is required' });
      return;
    }

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
      try {
        await sendClaimConfirmationEmail(
          stream.recipientSocialHandle,
          (BigInt(amountClaimed) / BigInt(1e8)).toString(),
          (BigInt(remainingAmount) / BigInt(1e8)).toString(),
          `${env.FRONTEND_URL}/claim/${stream.id}`
        );
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    res.json({
      success: true,
      transactionHash,
      claimedAmount: amountClaimed,
      totalClaimed: newClaimedAmount,
      status: isComplete ? 'COMPLETED' : 'ACTIVE',
      remainingAmount: (BigInt(stream.totalAmount) - BigInt(newClaimedAmount)).toString(),
    });
  } catch (error: any) {
    console.error('Failed to confirm claim:', error);
    res.status(500).json({ error: 'Failed to confirm claim', details: error.message });
  }
});

export default router;