import { Router } from 'express';
import { createHmac } from 'crypto';
import { requireAuth, requireAgent } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';
import { pushText } from '../lib/line-notify';
import { getPresignedPutUrl } from '../lib/s3';
import { expandRule } from '../lib/scheduling';
import type { AgentRequest } from '../types';

function generateQrToken(bookingId: string): string {
  const exp = Date.now() + 5 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ bookingId, exp })).toString('base64url');
  const secret = process.env.QRCODE_SECRET ?? 'dev-qrcode-secret';
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyQrToken(token: string): { bookingId: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const secret = process.env.QRCODE_SECRET ?? 'dev-qrcode-secret';
  const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
  if (sig !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { bookingId: string; exp: number };
    if (data.exp < Date.now()) return null;
    return { bookingId: data.bookingId };
  } catch {
    return null;
  }
}

const router = Router();

// Agent profile (kycStatus, bio, etc.)
router.get('/me', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  res.json({
    kycStatus: agentProfile.kycStatus,
    bio: agentProfile.bio,
    photoUrl: agentProfile.photoUrl,
    demeritPoints: agentProfile.demeritPoints,
    isSuspended: agentProfile.isSuspended,
  });
});

// Return a presigned S3 PUT URL for direct browser upload
router.get('/presigned-url', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const { category, contentType } = req.query as { category?: string; contentType?: string };

  if (!category || !contentType) {
    res.status(400).json({ error: 'category and contentType are required' });
    return;
  }

  const allowed = ['id_card', 'bank_book'];
  if (!allowed.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${allowed.join(', ')}` });
    return;
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowedTypes.includes(contentType)) {
    res.status(400).json({ error: 'Unsupported contentType' });
    return;
  }

  const { uploadUrl, objectKey } = await getPresignedPutUrl(
    `kyc/${agentProfile.id}/${category}`,
    contentType
  );

  res.json({ uploadUrl, objectKey });
});

// KYC — frontend uploads to S3 directly; backend records the object keys
router.post('/kyc', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const { idCardUrl, bankBookUrl } = req.body as { idCardUrl?: string; bankBookUrl?: string };

  if (!idCardUrl || !bankBookUrl) {
    res.status(400).json({ error: 'idCardUrl and bankBookUrl are required' });
    return;
  }

  // Create KYC submission and mark profile as PENDING
  const [submission] = await prisma.$transaction([
    prisma.kycSubmission.create({
      data: {
        agentProfileId: agentProfile.id,
        idCardUrl,
        bankBookUrl,
        status: 'PENDING',
      },
    }),
    prisma.agentProfile.update({
      where: { id: agentProfile.id },
      data: { kycStatus: 'PENDING' },
    }),
  ]);

  // Notify admin users via LINE
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  await Promise.all(
    admins.map((admin) =>
      pushText(admin.lineUserId, `新 KYC 審核申請（submissionId: ${submission.id}），請至後台處理。`)
    )
  );

  res.status(201).json({ submission });
});

// ─── Availability Slots ────────────────────────────────────────────────────────

router.get('/slots', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const slots = await prisma.availabilitySlot.findMany({
    where: { agentProfileId: agentProfile.id },
    orderBy: { startAt: 'asc' },
  });
  res.json({ slots });
});

router.post('/slots', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const { startAt, endAt } = req.body as { startAt?: string; endAt?: string };

  if (!startAt || !endAt) {
    res.status(400).json({ error: 'startAt and endAt are required' });
    return;
  }

  const start = new Date(startAt);
  const end = new Date(endAt);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    res.status(400).json({ error: 'Invalid startAt / endAt' });
    return;
  }

  if (start <= new Date()) {
    res.status(400).json({ error: 'Cannot create a slot in the past' });
    return;
  }

  // Conflict check: overlapping AVAILABLE/LOCKED/BOOKED slots
  const conflicts = await prisma.availabilitySlot.findMany({
    where: {
      agentProfileId: agentProfile.id,
      status: { in: ['AVAILABLE', 'LOCKED', 'BOOKED'] },
      startAt: { lt: end },
      endAt: { gt: start },
    },
  });

  if (conflicts.length > 0) {
    res.status(409).json({ error: 'Time slot conflicts with an existing slot' });
    return;
  }

  const slot = await prisma.availabilitySlot.create({
    data: {
      agentProfileId: agentProfile.id,
      startAt: start,
      endAt: end,
      status: 'AVAILABLE',
    },
  });

  res.status(201).json({ slot });
});

router.delete('/slots/:slotId', requireAuth, requireAgent, async (req, res) => {
  const { slotId } = req.params;
  const agentProfile = (req as AgentRequest).agentProfile;

  const slot = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });

  if (!slot || slot.agentProfileId !== agentProfile.id) {
    res.status(404).json({ error: 'Slot not found' });
    return;
  }

  if (['LOCKED', 'BOOKED'].includes(slot.status)) {
    res.status(409).json({ error: 'Cannot delete a slot that is LOCKED or BOOKED' });
    return;
  }

  await prisma.availabilitySlot.delete({ where: { id: slotId } });
  res.json({ ok: true });
});

// ─── Recurring Rules ───────────────────────────────────────────────────────────

router.get('/rules', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const rules = await prisma.availabilityRule.findMany({
    where: { agentProfileId: agentProfile.id },
    orderBy: { dayOfWeek: 'asc' },
  });
  res.json({ rules });
});

router.post('/rules', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const { dayOfWeek, startTime, endTime } = req.body as {
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
  };

  if (dayOfWeek === undefined || !startTime || !endTime) {
    res.status(400).json({ error: 'dayOfWeek, startTime, endTime are required' });
    return;
  }

  if (dayOfWeek < 0 || dayOfWeek > 6) {
    res.status(400).json({ error: 'dayOfWeek must be 0–6' });
    return;
  }

  // Basic time format validation HH:MM
  const timeRe = /^\d{2}:\d{2}$/;
  if (!timeRe.test(startTime) || !timeRe.test(endTime) || startTime >= endTime) {
    res.status(400).json({ error: 'Invalid startTime / endTime (format HH:MM, start < end)' });
    return;
  }

  const rule = await prisma.availabilityRule.create({
    data: { agentProfileId: agentProfile.id, dayOfWeek, startTime, endTime },
  });

  // Immediately expand this rule for the next 4 weeks
  await expandRule(rule, 4);

  res.status(201).json({ rule });
});

router.delete('/rules/:ruleId', requireAuth, requireAgent, async (req, res) => {
  const { ruleId } = req.params;
  const agentProfile = (req as AgentRequest).agentProfile;

  const rule = await prisma.availabilityRule.findUnique({ where: { id: ruleId } });

  if (!rule || rule.agentProfileId !== agentProfile.id) {
    res.status(404).json({ error: 'Rule not found' });
    return;
  }

  // Mark rule inactive + remove future AVAILABLE slots generated from this rule
  await prisma.$transaction([
    prisma.availabilityRule.update({ where: { id: ruleId }, data: { isActive: false } }),
    prisma.availabilitySlot.deleteMany({
      where: { ruleId, status: 'AVAILABLE', startAt: { gt: new Date() } },
    }),
  ]);

  res.json({ ok: true });
});

// ─── Bookings ─────────────────────────────────────────────────────────────────

// Agent cancels an accepted booking → full refund + notify civilian
router.delete('/bookings/:bookingId', requireAuth, requireAgent, async (req, res) => {
  const { bookingId } = req.params;
  const agentProfile = (req as AgentRequest).agentProfile;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { civilian: true, slot: true },
  });

  if (!booking || booking.agentProfileId !== agentProfile.id) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  if (!['LOCKED', 'CONFIRMED'].includes(booking.status)) {
    res.status(409).json({ error: 'Booking cannot be cancelled in its current state' });
    return;
  }

  const { reason } = req.body as { reason?: string };

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED_AGENT',
        cancelledBy: 'agent',
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
      },
    }),
    prisma.availabilitySlot.update({
      where: { id: booking.slotId },
      data: { status: 'AVAILABLE' },
    }),
  ]);

  // TODO: call 藍新 full refund API for CONFIRMED bookings

  await pushText(
    booking.civilian.lineUserId,
    `很抱歉，業務因故取消了您的預約（${booking.slot.startAt.toLocaleDateString('zh-TW')}），將全額退款，請重新選擇時段。`
  );

  res.json({ ok: true });
});

// Issue a signed QR code token for clinic scan
router.get('/bookings/:bookingId/qrcode-token', requireAuth, requireAgent, async (req, res) => {
  const { bookingId } = req.params;
  const agentProfile = (req as AgentRequest).agentProfile;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });

  if (!booking || booking.agentProfileId !== agentProfile.id) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  if (booking.status !== 'CONFIRMED') {
    res.status(409).json({ error: 'Booking must be CONFIRMED to generate QR code' });
    return;
  }

  const token = generateQrToken(bookingId);
  res.json({ token });
});

// ─── Wallet & Commission ──────────────────────────────────────────────────────

router.get('/wallet', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const transactions = await prisma.walletTransaction.findMany({
    where: { agentProfileId: agentProfile.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ transactions });
});

router.get('/commission', requireAuth, requireAgent, async (req, res) => {
  const agentProfile = (req as AgentRequest).agentProfile;
  const commissions = await prisma.commissionSnapshot.findMany({
    where: { booking: { agentProfileId: agentProfile.id } },
    include: { booking: { include: { slot: true, civilian: { select: { displayName: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  const watermark = {
    userId: agentProfile.userId,
    timestamp: new Date().toISOString(),
  };
  res.json({ commissions, watermark });
});

export default router;
