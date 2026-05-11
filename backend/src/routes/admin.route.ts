import { Router } from 'express';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

// KYC review
router.get('/kyc', requireAdmin, async (_req, res) => {
  res.json({ submissions: [] });
});

router.patch('/kyc/:submissionId', requireAdmin, async (req, res) => {
  // Approve/reject → update agentProfile.kycStatus, switch LINE Rich Menu
  res.json({ ok: true });
});

// Agent management
router.get('/agents', requireAdmin, async (_req, res) => {
  res.json({ agents: [] });
});

// Add demerit points (manual, with admin note)
router.post('/agents/:agentId/demerit', requireAdmin, async (req, res) => {
  res.json({ ok: true });
});

router.patch('/agents/:agentId/suspend', requireAdmin, async (req, res) => {
  res.json({ ok: true });
});

// Manual wallet adjustment
router.post('/wallet/adjust', requireAdmin, async (_req, res) => {
  res.json({ ok: true });
});

// Broadcast approval
router.get('/broadcast', requireAdmin, async (_req, res) => {
  res.json({ requests: [] });
});

router.patch('/broadcast/:requestId', requireAdmin, async (req, res) => {
  // Approve → trigger LINE multicast; Reject → notify clinic
  res.json({ ok: true });
});

// Platform settings (cancel_window_hours, max_demerit_points, platform_fee_rate, etc.)
router.get('/settings', requireAdmin, async (_req, res) => {
  res.json({ settings: {} });
});

router.put('/settings', requireAdmin, async (_req, res) => {
  res.json({ ok: true });
});

export default router;
