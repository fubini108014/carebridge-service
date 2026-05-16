import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';
import { pushText, bindRichMenu } from '../lib/line-notify';

const router = Router();

// ─── KYC Review ───────────────────────────────────────────────────────────────

router.get('/kyc', requireAdmin, async (_req, res) => {
  const submissions = await prisma.kycSubmission.findMany({
    where: { status: 'PENDING' },
    include: {
      agentProfile: {
        include: { user: { select: { displayName: true, lineUserId: true } } },
      },
    },
    orderBy: { submittedAt: 'asc' },
  });
  res.json({ submissions });
});

router.patch('/kyc/:submissionId', requireAdmin, async (req, res) => {
  const { submissionId } = req.params;
  const { action, reviewNote } = req.body as {
    action?: 'approve' | 'reject';
    reviewNote?: string;
  };

  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"' });
    return;
  }

  const submission = await prisma.kycSubmission.findUnique({
    where: { id: submissionId },
    include: { agentProfile: { include: { user: true } } },
  });

  if (!submission || submission.status !== 'PENDING') {
    res.status(404).json({ error: 'Pending KYC submission not found' });
    return;
  }

  const newKycStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

  await prisma.$transaction([
    prisma.kycSubmission.update({
      where: { id: submissionId },
      data: {
        status: newKycStatus,
        reviewNote: reviewNote ?? null,
        reviewedAt: new Date(),
      },
    }),
    prisma.agentProfile.update({
      where: { id: submission.agentProfileId },
      data: { kycStatus: newKycStatus },
    }),
  ]);

  const agentLineUserId = submission.agentProfile.user.lineUserId;

  if (action === 'approve') {
    await bindRichMenu(agentLineUserId, process.env.LINE_RICH_MENU_AGENT_APPROVED ?? '');
    await pushText(agentLineUserId, '恭喜！您的 KYC 審核已通過，現在可以開始接單了。');
  } else {
    await bindRichMenu(agentLineUserId, process.env.LINE_RICH_MENU_AGENT_KYC_PENDING ?? '');
    const note = reviewNote ? `\n原因：${reviewNote}` : '';
    await pushText(agentLineUserId, `很遺憾，您的 KYC 審核未通過，請重新上傳資料。${note}`);
  }

  res.json({ ok: true, kycStatus: newKycStatus });
});

// ─── Agent Management ─────────────────────────────────────────────────────────

router.get('/agents', requireAdmin, async (_req, res) => {
  const agents = await prisma.agentProfile.findMany({
    include: {
      user: { select: { displayName: true, lineUserId: true, createdAt: true } },
      _count: { select: { bookings: true, kycSubmissions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ agents });
});

router.post('/agents/:agentId/demerit', requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { points, reason, bookingId, adminNote } = req.body as {
    points?: number;
    reason?: string;
    bookingId?: string;
    adminNote?: string;
  };

  if (!points || !reason) {
    res.status(400).json({ error: 'points and reason are required' });
    return;
  }

  const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  await prisma.$transaction([
    prisma.demeritLog.create({
      data: { agentProfileId: agentId, points, reason, bookingId, adminNote },
    }),
    prisma.agentProfile.update({
      where: { id: agentId },
      data: { demeritPoints: { increment: points } },
    }),
  ]);

  res.json({ ok: true });
});

router.patch('/agents/:agentId/suspend', requireAdmin, async (req, res) => {
  const { agentId } = req.params;
  const { suspend } = req.body as { suspend?: boolean };

  if (suspend === undefined) {
    res.status(400).json({ error: 'suspend (boolean) is required' });
    return;
  }

  await prisma.agentProfile.update({
    where: { id: agentId },
    data: { isSuspended: suspend },
  });

  res.json({ ok: true });
});

// ─── Wallet Adjustment ────────────────────────────────────────────────────────

router.post('/wallet/adjust', requireAdmin, async (req, res) => {
  const { agentProfileId, amount, note } = req.body as {
    agentProfileId?: string;
    amount?: number;
    note?: string;
  };

  if (!agentProfileId || amount === undefined) {
    res.status(400).json({ error: 'agentProfileId and amount are required' });
    return;
  }

  const tx = await prisma.walletTransaction.create({
    data: {
      agentProfileId,
      type: 'ADJUSTMENT',
      amount,
      status: 'AVAILABLE',
      note: note ?? null,
    },
  });

  res.json({ transaction: tx });
});

// ─── Broadcast Approval ───────────────────────────────────────────────────────

router.get('/broadcast', requireAdmin, async (_req, res) => {
  const requests = await prisma.broadcastRequest.findMany({
    where: { status: 'PENDING' },
    include: { clinicProfile: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ requests });
});

router.patch('/broadcast/:requestId', requireAdmin, async (req, res) => {
  const { requestId } = req.params;
  const { action, reviewNote } = req.body as { action?: string; reviewNote?: string };

  if (!action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'action must be "approve" or "reject"' });
    return;
  }

  await prisma.broadcastRequest.update({
    where: { id: requestId },
    data: {
      status: action === 'approve' ? 'APPROVED' : 'REJECTED',
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    },
  });

  // TODO: if approved, trigger LINE multicast to all subscribed civilians

  res.json({ ok: true });
});

// ─── Platform Settings ────────────────────────────────────────────────────────

router.get('/settings', requireAdmin, async (_req, res) => {
  const rows = await prisma.adminSetting.findMany();
  const settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  res.json({ settings });
});

router.put('/settings', requireAdmin, async (req, res) => {
  const updates = req.body as Record<string, string>;
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      prisma.adminSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    )
  );
  res.json({ ok: true });
});

export default router;
