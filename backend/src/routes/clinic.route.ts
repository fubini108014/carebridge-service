import { Router } from 'express';
import { requireAuth, requireClinic } from '../middlewares/auth.middleware';

const router = Router();

// Validate QR code token from agent (called after liff.scanCode())
router.get('/verify/:bookingId', requireAuth, requireClinic, async (req, res) => {
  res.json({ booking: null });
});

// Clinic submits transaction amount → notify agent, start 30-min confirmation window
router.post('/verify/:bookingId/amount', requireAuth, requireClinic, async (req, res) => {
  res.json({ ok: true });
});

// Monthly reconciliation report
router.get('/report', requireAuth, requireClinic, async (_req, res) => {
  res.json({ report: [] });
});

// Request to push a promotional broadcast (requires admin approval)
router.post('/broadcast', requireAuth, requireClinic, async (_req, res) => {
  res.json({ ok: true });
});

export default router;
