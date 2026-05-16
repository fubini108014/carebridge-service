import { Router } from 'express';
import { requireAuth, requireSubscription } from '../middlewares/auth.middleware';
import { prisma } from '../lib/prisma';
import { pushBookingRequestToAgent, pushText } from '../lib/line-notify';
import type { AuthRequest } from '../types';

const router = Router();

// Authenticated civilian — own profile (subscription status, etc.)
router.get('/me', requireAuth, async (req, res) => {
  const civilian = (req as AuthRequest).user;
  res.json({
    user: {
      id: civilian.id,
      displayName: civilian.displayName,
      isSubscribed: civilian.isSubscribed,
      subscriptionExpiresAt: civilian.subscriptionExpiresAt,
    },
  });
});

// Public — list active agents with their next available slot
router.get('/agents', async (_req, res) => {
  const agents = await prisma.agentProfile.findMany({
    where: {
      kycStatus: 'APPROVED',
      isSuspended: false,
    },
    include: {
      user: { select: { displayName: true, pictureUrl: true } },
      availabilitySlots: {
        where: { status: 'AVAILABLE', startAt: { gt: new Date() } },
        orderBy: { startAt: 'asc' },
        take: 1,
      },
    },
  });
  res.json({ agents });
});

// Public — agent profile + upcoming available slots
router.get('/agents/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentId },
    include: {
      user: { select: { displayName: true, pictureUrl: true } },
      availabilitySlots: {
        where: { status: 'AVAILABLE', startAt: { gt: new Date() } },
        orderBy: { startAt: 'asc' },
      },
    },
  });
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json({ agent });
});

// Subscribed civilian only — create booking request
router.post('/bookings', requireAuth, requireSubscription, async (req, res) => {
  const { slotId } = req.body as { slotId: string };
  const civilian = (req as AuthRequest).user;

  if (!slotId) {
    res.status(400).json({ error: 'slotId is required' });
    return;
  }

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: { agentProfile: { include: { user: true } } },
  });

  if (!slot || slot.status !== 'AVAILABLE') {
    res.status(409).json({ error: 'Slot not available' });
    return;
  }

  // Reject if slot is in the past
  if (slot.startAt <= new Date()) {
    res.status(409).json({ error: 'Slot has already passed' });
    return;
  }

  // Ensure no concurrent active booking for this slot
  const activeBooking = await prisma.booking.findFirst({
    where: { slotId, status: { in: ['PENDING_AGENT', 'LOCKED', 'CONFIRMED'] } },
  });
  if (activeBooking) {
    res.status(409).json({ error: 'Slot already booked' });
    return;
  }

  // 1-hour buffer conflict check against the agent's LOCKED / BOOKED slots
  const bufferStart = new Date(slot.startAt.getTime() - 60 * 60 * 1000);
  const bufferEnd = new Date(slot.endAt.getTime() + 60 * 60 * 1000);
  const conflicts = await prisma.availabilitySlot.findMany({
    where: {
      agentProfileId: slot.agentProfileId,
      status: { in: ['LOCKED', 'BOOKED'] },
      startAt: { lt: bufferEnd },
      endAt: { gt: bufferStart },
      id: { not: slotId },
    },
  });
  if (conflicts.length > 0) {
    res.status(409).json({ error: 'Slot is within the 1-hour buffer of an existing booking' });
    return;
  }

  const feeSetting = await prisma.adminSetting.findUnique({ where: { key: 'booking_fee' } });
  const amount = feeSetting ? parseFloat(feeSetting.value) : 500;
  const agentResponseDeadline = new Date(Date.now() + 30 * 60 * 1000);

  const booking = await prisma.booking.create({
    data: {
      civilianId: civilian.id,
      agentProfileId: slot.agentProfileId,
      slotId,
      status: 'PENDING_AGENT',
      agentResponseDeadline,
      amount,
    },
    include: { slot: true, agentProfile: { include: { user: true } } },
  });

  await pushBookingRequestToAgent(
    booking.agentProfile.user.lineUserId,
    { id: booking.id, amount: booking.amount.toString() },
    { startAt: booking.slot.startAt, endAt: booking.slot.endAt },
    { displayName: civilian.displayName }
  );

  res.status(201).json({ booking });
});

// Authenticated civilian — list own bookings
router.get('/bookings', requireAuth, async (req, res) => {
  const civilian = (req as AuthRequest).user;
  const bookings = await prisma.booking.findMany({
    where: { civilianId: civilian.id },
    include: {
      slot: true,
      agentProfile: { include: { user: { select: { displayName: true, pictureUrl: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ bookings });
});

// Civilian cancels a booking — 24h policy: full refund if ≥24h before slot, no refund otherwise
router.delete('/bookings/:bookingId', requireAuth, async (req, res) => {
  const { bookingId } = req.params;
  const civilian = (req as AuthRequest).user;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: true, agentProfile: { include: { user: true } } },
  });

  if (!booking || booking.civilianId !== civilian.id) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }

  if (!['PENDING_AGENT', 'LOCKED', 'CONFIRMED'].includes(booking.status)) {
    res.status(409).json({ error: 'Booking cannot be cancelled in its current state' });
    return;
  }

  const hoursUntilSlot = (booking.slot.startAt.getTime() - Date.now()) / 3_600_000;
  const fullRefund = hoursUntilSlot >= 24;

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED_CIVILIAN',
        cancelledBy: 'civilian',
        cancelledAt: new Date(),
        cancelReason: req.body?.reason ?? null,
      },
    });

    // Release slot if it was locked for payment
    if (booking.status === 'LOCKED' || booking.status === 'CONFIRMED') {
      await tx.availabilitySlot.update({
        where: { id: booking.slotId },
        data: { status: 'AVAILABLE' },
      });
    }
  });

  // TODO: call 藍新 refund API when fullRefund === true and booking was CONFIRMED

  await pushText(
    booking.agentProfile.user.lineUserId,
    `民眾已取消預約（${booking.slot.startAt.toLocaleDateString('zh-TW')}）。`
  );

  res.json({ ok: true, fullRefund });
});

// Generate 藍新 subscription payment link
router.post('/subscribe', requireAuth, async (req, res) => {
  const civilian = (req as AuthRequest).user;

  const feeSetting = await prisma.adminSetting.findUnique({ where: { key: 'subscription_fee' } });
  const amount = feeSetting ? Math.round(parseFloat(feeSetting.value)) : 99;

  const { generateMerchantOrderNo } = await import('../lib/newebpay');
  const merchantOrderNo = generateMerchantOrderNo();

  // Persist mapping so the webhook can resolve user when payment arrives
  await prisma.adminSetting.upsert({
    where: { key: `sub_order_${merchantOrderNo}` },
    create: { key: `sub_order_${merchantOrderNo}`, value: civilian.id, description: 'Pending subscription order' },
    update: { value: civilian.id },
  });

  const paymentUrl = `${process.env.APP_BASE_URL ?? 'http://localhost:3000'}/api/payment/subscribe/${merchantOrderNo}`;
  res.json({ paymentUrl });
});

export default router;
