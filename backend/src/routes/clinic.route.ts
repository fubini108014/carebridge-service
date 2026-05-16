import { Router } from 'express';
import { requireAuth, requireClinic } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';
import { pushText, pushVerificationRequestToAgent } from '../lib/line-notify';
import { verifyQrToken } from './agent.route';
import type { ClinicRequest } from '../types';

const router = Router();

// Validate QR code token from agent; returns booking info for clinic to review
router.get('/verify/:bookingId', requireAuth, requireClinic, async (req, res) => {
  const { bookingId } = req.params;
  const { token } = req.query as { token?: string };

  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  const payload = verifyQrToken(token);
  if (!payload || payload.bookingId !== bookingId) {
    res.status(401).json({ error: 'Invalid or expired QR token' });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      civilian: { select: { displayName: true } },
      agentProfile: {
        include: { user: { select: { displayName: true, pictureUrl: true } } },
      },
      slot: true,
      transactionVerification: true,
    },
  });

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  if (booking.status !== 'CONFIRMED') {
    res.status(409).json({ error: 'Booking is not in CONFIRMED status' });
    return;
  }

  if (booking.transactionVerification) {
    res.status(409).json({ error: 'Booking has already been verified' });
    return;
  }

  res.json({
    booking: {
      id: booking.id,
      slotStartAt: booking.slot.startAt,
      slotEndAt: booking.slot.endAt,
      civilianName: booking.civilian.displayName,
      agentName: booking.agentProfile.user.displayName,
      agentPhotoUrl: booking.agentProfile.user.pictureUrl,
    },
  });
});

// Clinic submits transaction amount → notify agent, start 30-min confirmation window
router.post('/verify/:bookingId/amount', requireAuth, requireClinic, async (req, res) => {
  const { bookingId } = req.params;
  const clinicProfile = (req as ClinicRequest).clinicProfile;
  const { transactionAmount, token } = req.body as { transactionAmount?: number; token?: string };

  if (!token) {
    res.status(400).json({ error: 'token is required' });
    return;
  }

  const payload = verifyQrToken(token);
  if (!payload || payload.bookingId !== bookingId) {
    res.status(401).json({ error: 'Invalid or expired QR token' });
    return;
  }

  if (transactionAmount === undefined || transactionAmount <= 0) {
    res.status(400).json({ error: 'transactionAmount must be a positive number' });
    return;
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      civilian: { select: { displayName: true } },
      agentProfile: {
        include: { user: { select: { lineUserId: true, displayName: true } } },
      },
      transactionVerification: true,
    },
  });

  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  if (booking.status !== 'CONFIRMED') {
    res.status(409).json({ error: 'Booking is not in CONFIRMED status' });
    return;
  }

  if (booking.transactionVerification) {
    res.status(409).json({ error: 'Booking has already been verified' });
    return;
  }

  const agentConfirmDeadline = new Date(Date.now() + 30 * 60 * 1000);

  const verification = await prisma.transactionVerification.create({
    data: {
      bookingId,
      clinicProfileId: clinicProfile.id,
      transactionAmount,
      agentConfirmDeadline,
    },
  });

  // Notify agent to confirm the transaction
  await pushVerificationRequestToAgent(
    booking.agentProfile.user.lineUserId,
    { id: verification.id, transactionAmount: transactionAmount.toString() },
    { id: booking.id },
    { displayName: booking.civilian.displayName },
    { name: clinicProfile.name }
  );

  res.status(201).json({ verificationId: verification.id });
});

// Monthly reconciliation report
router.get('/report', requireAuth, requireClinic, async (req, res) => {
  const clinicProfile = (req as ClinicRequest).clinicProfile;

  const verifications = await prisma.transactionVerification.findMany({
    where: { clinicProfileId: clinicProfile.id },
    include: {
      booking: {
        include: {
          civilian: { select: { displayName: true } },
          agentProfile: { include: { user: { select: { displayName: true } } } },
          slot: true,
          commissionSnapshot: true,
        },
      },
      walletTransaction: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ report: verifications });
});

// Request to push a promotional broadcast (requires admin approval)
router.post('/broadcast', requireAuth, requireClinic, async (req, res) => {
  const clinicProfile = (req as ClinicRequest).clinicProfile;
  const { content, scheduledAt } = req.body as { content?: string; scheduledAt?: string };

  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const request = await prisma.broadcastRequest.create({
    data: {
      clinicProfileId: clinicProfile.id,
      content,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  res.status(201).json({ request });
});

export default router;
