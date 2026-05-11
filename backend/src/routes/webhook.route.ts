import { Router, Request, Response } from 'express';
import { Client, middleware, WebhookEvent, PostbackEvent } from '@line/bot-sdk';

const router = Router();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'placeholder',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'placeholder',
};

export const lineClient = new Client(lineConfig);

// LINE Messaging API webhook
router.post('/line', middleware(lineConfig), async (req: Request, res: Response) => {
  const events: WebhookEvent[] = req.body.events;
  await Promise.all(events.map(handleLineEvent));
  res.json({ ok: true });
});

async function handleLineEvent(event: WebhookEvent) {
  if (event.type === 'follow') {
    // New follower → upsert user record, assign default Rich Menu
    return;
  }

  if (event.type === 'postback') {
    await handlePostback(event);
  }
}

async function handlePostback(event: PostbackEvent) {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action');
  const bookingId = params.get('bookingId');

  switch (action) {
    case 'booking:accept':
      // Agent accepts → lock slot, start 30-min payment countdown, send payment URL to civilian
      break;
    case 'booking:reject':
      // Agent rejects → cancel booking, notify civilian
      break;
    case 'transaction:confirm':
      // Agent confirms clinic-submitted transaction amount
      break;
  }

  void bookingId;
}

// 藍新金流 async payment notification
router.post('/newebpay', async (req: Request, res: Response) => {
  // 1. Decrypt TradeInfo with AES-256-CBC using HASH_KEY / HASH_IV
  // 2. Validate SHA256 checksum
  // 3. On Status === "SUCCESS":
  //    - Update booking → CONFIRMED
  //    - Create CommissionSnapshot (lock current rates)
  //    - Update slot → BOOKED
  //    - Block surrounding 1-hour buffer slots
  //    - Send LINE notifications to civilian + agent
  res.send('OK');
});

export default router;
