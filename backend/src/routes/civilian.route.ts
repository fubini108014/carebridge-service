import { Router } from 'express';
import { requireAuth, requireSubscription } from '../middlewares/auth.middleware';

const router = Router();

// Public — list active agents with their next available slot
router.get('/agents', async (_req, res) => {
  res.json({ agents: [] });
});

// Public — agent profile + calendar slots
router.get('/agents/:agentId', async (req, res) => {
  res.json({ agent: null, slots: [] });
});

// Subscribed civilian only — create booking request
router.post('/bookings', requireAuth, requireSubscription, async (req, res) => {
  // 1. Check slot is AVAILABLE + no conflict with 1-hour buffer
  // 2. Create Booking with status PENDING_AGENT, deadline = now + 30 min
  // 3. Send Flex Message to agent with Accept / Reject postback buttons
  res.json({ booking: null });
});

router.get('/bookings', requireAuth, async (_req, res) => {
  res.json({ bookings: [] });
});

// Civilian cancels — refund per cancellation policy (≥24h: full refund, <24h: no refund)
router.delete('/bookings/:bookingId', requireAuth, async (req, res) => {
  res.json({ ok: true });
});

// Generate 藍新 payment link for platform subscription
router.post('/subscribe', requireAuth, async (_req, res) => {
  res.json({ paymentUrl: '' });
});

export default router;
