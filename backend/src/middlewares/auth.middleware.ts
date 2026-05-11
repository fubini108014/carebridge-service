import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// LIFF sends the decoded LINE user ID in this header.
// Production: validate the LIFF access token against LINE's /oauth2/v2.1/verify
// endpoint instead of trusting the header blindly.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const lineUserId = req.headers['x-line-user-id'] as string | undefined;

  if (!lineUserId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { lineUserId } });

  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  (req as any).user = user;
  next();
}

export function requireSubscription(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  const valid =
    user.isSubscribed &&
    (!user.subscriptionExpiresAt || user.subscriptionExpiresAt > new Date());

  if (!valid) {
    res.status(403).json({ error: 'Subscription required' });
    return;
  }
  next();
}

export async function requireAgent(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (user.role !== 'AGENT') {
    res.status(403).json({ error: 'Agent access required' });
    return;
  }

  const agentProfile = await prisma.agentProfile.findUnique({ where: { userId: user.id } });

  if (!agentProfile || agentProfile.isSuspended) {
    res.status(403).json({ error: 'Agent account suspended or not found' });
    return;
  }

  (req as any).agentProfile = agentProfile;
  next();
}

export async function requireClinic(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (user.role !== 'CLINIC') {
    res.status(403).json({ error: 'Clinic access required' });
    return;
  }

  const clinicProfile = await prisma.clinicProfile.findUnique({ where: { userId: user.id } });

  if (!clinicProfile) {
    res.status(403).json({ error: 'Clinic profile not found' });
    return;
  }

  (req as any).clinicProfile = clinicProfile;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Admin panel uses a secret key header (non-LIFF web app)
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && adminKey === process.env.ADMIN_SECRET_KEY) {
    next();
    return;
  }

  const user = (req as any).user;
  if (user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}
