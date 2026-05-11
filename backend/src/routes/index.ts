import { Router } from 'express';
import webhookRouter from './webhook.route';
import civilianRouter from './civilian.route';
import agentRouter from './agent.route';
import clinicRouter from './clinic.route';
import adminRouter from './admin.route';

export const router = Router();

router.use('/webhook', webhookRouter);
router.use('/civilian', civilianRouter);
router.use('/agent', agentRouter);
router.use('/clinic', clinicRouter);
router.use('/admin', adminRouter);
