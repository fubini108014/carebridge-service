import { Router } from 'express';
import { requireAuth, requireAgent } from '../middlewares/auth.middleware';

const router = Router();

// KYC — frontend uploads to S3 directly; backend records the object keys
router.post('/kyc', requireAuth, requireAgent, async (_req, res) => {
  res.json({ ok: true });
});

// Availability slots
router.get('/slots', requireAuth, requireAgent, async (_req, res) => {
  res.json({ slots: [] });
});

router.post('/slots', requireAuth, requireAgent, async (_req, res) => {
  res.json({ slot: null });
});

router.delete('/slots/:slotId', requireAuth, requireAgent, async (req, res) => {
  res.json({ ok: true });
});

// Recurring rules
router.get('/rules', requireAuth, requireAgent, async (_req, res) => {
  res.json({ rules: [] });
});

router.post('/rules', requireAuth, requireAgent, async (_req, res) => {
  res.json({ rule: null });
});

router.delete('/rules/:ruleId', requireAuth, requireAgent, async (req, res) => {
  res.json({ ok: true });
});

// Agent cancels an accepted booking → full refund to civilian, log cancel reason
router.delete('/bookings/:bookingId', requireAuth, requireAgent, async (req, res) => {
  res.json({ ok: true });
});

// Issue a signed QR code token for clinic scan
router.get('/bookings/:bookingId/qrcode-token', requireAuth, requireAgent, async (req, res) => {
  res.json({ token: '' });
});

// Wallet (Pending / Available / Paid)
router.get('/wallet', requireAuth, requireAgent, async (_req, res) => {
  res.json({ transactions: [] });
});

// Commission board — returns data + watermark metadata (userId + timestamp)
router.get('/commission', requireAuth, requireAgent, async (_req, res) => {
  res.json({ commissions: [], watermark: { userId: '', timestamp: '' } });
});

export default router;
