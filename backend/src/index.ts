import 'dotenv/config';
import 'express-async-errors';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { router } from './routes';
import { startScheduler } from './lib/scheduler';
import { prisma } from './lib/prisma';
import { buildPaymentForm } from './lib/newebpay';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());

// Raw body must be preserved for LINE webhook signature verification
app.use('/api/webhook/line', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Payment redirect page — serves an auto-submit HTML form to NewebPay
app.get('/api/payment/:bookingId', async (req: Request, res: Response) => {
  const booking = await prisma.booking.findUnique({
    where: { id: req.params.bookingId },
  });

  if (!booking || booking.status !== 'LOCKED' || !booking.newebpayTradeNo) {
    res.status(404).send('<h1>付款連結已失效</h1>');
    return;
  }

  const { apiUrl, fields } = buildPaymentForm({
    merchantOrderNo: booking.newebpayTradeNo,
    amount: Math.round(Number(booking.amount)),
    itemDesc: '陪診媒合服務費',
  });

  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
    .join('\n    ');

  res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>付款中...</title></head>
<body>
  <p>正在跳轉至付款頁面，請稍候…</p>
  <form id="f" method="POST" action="${apiUrl}">
    ${inputs}
  </form>
  <script>document.getElementById('f').submit();</script>
</body>
</html>`);
});

// Subscription payment redirect page
app.get('/api/payment/subscribe/:merchantOrderNo', async (req: Request, res: Response) => {
  const { merchantOrderNo } = req.params;

  const setting = await prisma.adminSetting.findUnique({
    where: { key: `sub_order_${merchantOrderNo}` },
  });
  if (!setting) {
    res.status(404).send('<h1>付款連結已失效</h1>');
    return;
  }

  const feeSetting = await prisma.adminSetting.findUnique({ where: { key: 'subscription_fee' } });
  const amount = feeSetting ? Math.round(parseFloat(feeSetting.value)) : 99;

  const { buildPaymentForm } = require('./lib/newebpay');
  const { apiUrl, fields } = buildPaymentForm({
    merchantOrderNo,
    amount,
    itemDesc: '陪診橋民眾訂閱月費',
  });

  const inputs = Object.entries(fields as Record<string, string>)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}">`)
    .join('\n    ');

  res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>付款中...</title></head>
<body>
  <p>正在跳轉至付款頁面，請稍候…</p>
  <form id="f" method="POST" action="${apiUrl}">
    ${inputs}
  </form>
  <script>document.getElementById('f').submit();</script>
</body>
</html>`);
});

app.use('/api', router);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV}]`);
  startScheduler();
});
