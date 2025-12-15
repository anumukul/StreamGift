import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../services/privy.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    privyId: string;
    walletAddress?: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const claims = await verifyAuthToken(token);
    req.user = {
      privyId: claims.userId,
      walletAddress: claims.wallet?.address,
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
}

export function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.substring(7);

  verifyAuthToken(token)
    .then((claims) => {
      req.user = {
        privyId: claims.userId,
        walletAddress: claims.wallet?.address,
      };
      next();
    })
    .catch(() => {
      next();
    });
}