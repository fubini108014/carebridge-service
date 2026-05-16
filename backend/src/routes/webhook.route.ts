import { Router, Request, Response } from 'express';
import { middleware, WebhookEvent, PostbackEvent } from '@line/bot-sdk';
import { prisma } from '../lib/prisma';
import { lineClient, pushPaymentUrlToCivilian, pushBookingConfirmedToCivilian, pushBookingConfirmedToAgent, pushText, bindRichMenu } from '../lib/line-notify';
import { decryptWebhookPayload, generateMerchantOrderNo, buildPaymentForm } from '../lib/newebpay';

// Create WalletTransaction EARNING entry from a confirmed/auto-confirmed verification
export async function createEarningFromVerification(verificationId: string): Promise<void> {
  const verification = await prisma.transactionVerification.findUnique({
    where: { id: verificationId },
    include: {
      booking: {
        include: {
          commissionSnapshot: true,
          agentProfile: true,
        },
      },
      walletTransaction: true,
    },
  });

  if (!verification || verification.walletTransaction) return;

  const agentEarning = verification.booking.commissionSnapshot?.agentEarning ?? 0;

  await prisma.walletTransaction.create({
    data: {
      agentProfileId: verification.booking.agentProfileId,
      verificationId: verification.id,
      type: 'EARNING',
      amount: agentEarning,
      status: 'PENDING',
      note: `核銷確認：成交金額 NT$${verification.transactionAmount}`,
    },
  });
}

const router = Router();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? 'placeholder',
  channelSecret: process.env.LINE_CHANNEL_SECRET ?? 'placeholder',
};

// LINE Messaging API webhook
router.post('/line', middleware(lineConfig), async (req: Request, res: Response) => {
  const events: WebhookEvent[] = req.body.events;
  await Promise.all(events.map(handleLineEvent));
  res.json({ ok: true });
});

async function handleLineEvent(event: WebhookEvent): Promise<void> {
  if (event.type === 'follow') {
    await handleFollow(event.source.userId ?? '');
    return;
  }
  if (event.type === 'postback') {
    await handlePostback(event);
  }
}

async function handleFollow(lineUserId: string): Promise<void> {
  if (!lineUserId) return;

  let profile: { displayName: string; pictureUrl?: string };
  try {
    profile = await lineClient.getProfile(lineUserId);
  } catch {
    profile = { displayName: lineUserId };
  }

  const user = await prisma.user.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? null,
      role: 'CIVILIAN',
    },
    update: {
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl ?? null,
    },
    include: { agentProfile: true },
  });

  await applyRichMenu(user as typeof user & { agentProfile: { kycStatus: string } | null });
}

async function applyRichMenu(user: {
  lineUserId: string;
  role: string;
  isSubscribed: boolean;
  subscriptionExpiresAt: Date | null;
  agentProfile: { kycStatus: string } | null;
}): Promise<void> {
  const {
    LINE_RICH_MENU_CIVILIAN = '',
    LINE_RICH_MENU_CIVILIAN_SUBSCRIBED = '',
    LINE_RICH_MENU_AGENT_KYC_PENDING = '',
    LINE_RICH_MENU_AGENT_APPROVED = '',
  } = process.env;

  if (user.role === 'AGENT' && user.agentProfile) {
    const kyc = user.agentProfile.kycStatus;
    if (kyc === 'APPROVED') {
      await bindRichMenu(user.lineUserId, LINE_RICH_MENU_AGENT_APPROVED);
    } else if (kyc === 'PENDING') {
      await bindRichMenu(user.lineUserId, LINE_RICH_MENU_AGENT_KYC_PENDING);
    } else {
      await bindRichMenu(user.lineUserId, LINE_RICH_MENU_CIVILIAN);
    }
    return;
  }

  const isActiveSub =
    user.isSubscribed &&
    user.subscriptionExpiresAt !== null &&
    user.subscriptionExpiresAt > new Date();

  await bindRichMenu(
    user.lineUserId,
    isActiveSub ? LINE_RICH_MENU_CIVILIAN_SUBSCRIBED : LINE_RICH_MENU_CIVILIAN
  );
}

async function handlePostback(event: PostbackEvent): Promise<void> {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action');
  const bookingId = params.get('bookingId');

  if (!bookingId) return;

  switch (action) {
    case 'booking:accept':
      await handleBookingAccept(bookingId);
      break;
    case 'booking:reject':
      await handleBookingReject(bookingId, event.source.userId ?? '');
      break;
    case 'transaction:confirm': {
      const verificationId = params.get('verificationId');
      if (verificationId) await handleTransactionConfirm(verificationId, event.source.userId ?? '');
      break;
    }
    case 'transaction:dispute': {
      const verificationId = params.get('verificationId');
      if (verificationId) await handleTransactionDispute(verificationId, event.source.userId ?? '');
      break;
    }
  }
}

async function handleBookingAccept(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      civilian: true,
      slot: true,
    },
  });

  if (!booking || booking.status !== 'PENDING_AGENT') return;

  const paymentDeadline = new Date(Date.now() + 30 * 60 * 1000);
  const merchantOrderNo = generateMerchantOrderNo();
  const appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
  const paymentUrl = `${appBaseUrl}/api/payment/${booking.id}`;

  const { fields: _fields } = buildPaymentForm({
    merchantOrderNo,
    amount: Math.round(Number(booking.amount)),
    itemDesc: '陪診媒合服務費',
    email: undefined,
  });

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'LOCKED',
        paymentDeadline,
        paymentUrl,
        newebpayTradeNo: merchantOrderNo, // store our order no for webhook lookup
      },
    }),
    prisma.availabilitySlot.update({
      where: { id: booking.slotId },
      data: { status: 'LOCKED' },
    }),
  ]);

  await pushPaymentUrlToCivilian(
    booking.civilian.lineUserId,
    { id: booking.id, paymentUrl, amount: booking.amount.toString() },
    { startAt: booking.slot.startAt, endAt: booking.slot.endAt }
  );
}

async function handleBookingReject(bookingId: string, _agentLineUserId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { civilian: true },
  });

  if (!booking || booking.status !== 'PENDING_AGENT') return;

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'CANCELLED_AGENT',
      cancelledBy: 'agent',
      cancelledAt: new Date(),
    },
  });

  await pushText(booking.civilian.lineUserId, '很抱歉，業務拒絕了您的預約申請，請重新選擇時段。');
}

// 藍新金流 async payment notification
router.post('/newebpay', async (req: Request, res: Response) => {
  try {
    const { TradeInfo, TradeSha, Status } = req.body as Record<string, string>;

    // Always respond 200 to NewebPay regardless of outcome
    if (Status !== 'SUCCESS') {
      res.send('OK');
      return;
    }

    const payload = decryptWebhookPayload(TradeInfo, TradeSha);
    const result = payload.Result as Record<string, string> | undefined;
    const merchantOrderNo = result?.MerchantOrderNo;

    if (!merchantOrderNo) {
      res.send('OK');
      return;
    }

    // Look up booking by the merchant order no we stored at accept time
    const booking = await prisma.booking.findFirst({
      where: { newebpayTradeNo: merchantOrderNo, status: 'LOCKED' },
      include: {
        civilian: true,
        agentProfile: { include: { user: true } },
        slot: true,
      },
    });

    if (!booking) {
      // Check if this is a subscription payment
      const subSetting = await prisma.adminSetting.findUnique({
        where: { key: `sub_order_${merchantOrderNo}` },
      });
      if (subSetting) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const user = await prisma.user.update({
          where: { id: subSetting.value },
          data: { isSubscribed: true, subscriptionExpiresAt: expiresAt },
        });
        // Clean up temp order record
        await prisma.adminSetting.delete({ where: { key: `sub_order_${merchantOrderNo}` } });
        await pushText(user.lineUserId, `訂閱成功！您的陪診橋民眾訂閱已啟用，到期日：${expiresAt.toLocaleDateString('zh-TW')}。`);
        await bindRichMenu(user.lineUserId, process.env.LINE_RICH_MENU_CIVILIAN_SUBSCRIBED ?? '');
      }
      res.send('OK');
      return;
    }

    const paidAt = new Date();

    // Fetch current admin settings for commission split
    const settings = await prisma.adminSetting.findMany({
      where: { key: { in: ['clinic_commission_rate', 'platform_cut_rate', 'agent_earning_rate'] } },
    });
    const getSetting = (key: string, fallback: number) =>
      parseFloat(settings.find((s) => s.key === key)?.value ?? String(fallback));

    const clinicCommissionRate = getSetting('clinic_commission_rate', 0.1);
    const platformCutRate = getSetting('platform_cut_rate', 0.2);
    const agentEarningRate = getSetting('agent_earning_rate', 0.7);
    const totalAmount = Number(booking.amount);
    const agentEarning = totalAmount * agentEarningRate;
    const platformEarning = totalAmount * platformCutRate;

    // 1-hour buffer slots to block around the confirmed booking
    const bufferStart = new Date(booking.slot.startAt.getTime() - 60 * 60 * 1000);
    const bufferEnd = new Date(booking.slot.endAt.getTime() + 60 * 60 * 1000);
    const bufferSlots = await prisma.availabilitySlot.findMany({
      where: {
        agentProfileId: booking.agentProfileId,
        status: 'AVAILABLE',
        startAt: { gte: bufferStart, lt: booking.slot.startAt },
        endAt: { gt: booking.slot.startAt, lte: bufferEnd },
        id: { not: booking.slotId },
      },
    });

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED', paidAt },
      }),
      prisma.availabilitySlot.update({
        where: { id: booking.slotId },
        data: { status: 'BOOKED' },
      }),
      prisma.commissionSnapshot.create({
        data: {
          bookingId: booking.id,
          clinicCommissionRate,
          platformCutRate,
          agentEarningRate,
          totalAmount,
          agentEarning,
          platformEarning,
        },
      }),
      // Block buffer slots
      ...bufferSlots.map((s) =>
        prisma.availabilitySlot.update({ where: { id: s.id }, data: { status: 'BLOCKED' } })
      ),
    ]);

    await pushBookingConfirmedToCivilian(booking.civilian.lineUserId, {
      startAt: booking.slot.startAt,
      endAt: booking.slot.endAt,
    });
    await pushBookingConfirmedToAgent(booking.agentProfile.user.lineUserId, {
      startAt: booking.slot.startAt,
      endAt: booking.slot.endAt,
    }, { displayName: booking.civilian.displayName });
  } catch (err) {
    console.error('NewebPay webhook error:', err);
  }

  res.send('OK');
});

async function handleTransactionConfirm(verificationId: string, agentLineUserId: string): Promise<void> {
  const verification = await prisma.transactionVerification.findUnique({
    where: { id: verificationId },
    include: {
      booking: { include: { agentProfile: { include: { user: true } } } },
      clinicProfile: { include: { user: true } },
    },
  });

  if (!verification) return;
  if (verification.booking.agentProfile.user.lineUserId !== agentLineUserId) return;
  if (verification.status !== 'PENDING_AGENT') return;

  await prisma.transactionVerification.update({
    where: { id: verificationId },
    data: { status: 'CONFIRMED', confirmedAt: new Date() },
  });

  await createEarningFromVerification(verificationId);

  await pushText(agentLineUserId, `核銷已確認！成交金額 NT$${verification.transactionAmount}，收益將在月結時撥款。`);
  await pushText(
    verification.clinicProfile.user.lineUserId,
    `業務已確認核銷，成交金額 NT$${verification.transactionAmount}。`
  );
}

async function handleTransactionDispute(verificationId: string, agentLineUserId: string): Promise<void> {
  const verification = await prisma.transactionVerification.findUnique({
    where: { id: verificationId },
    include: { booking: { include: { agentProfile: { include: { user: true } } } } },
  });

  if (!verification) return;
  if (verification.booking.agentProfile.user.lineUserId !== agentLineUserId) return;
  if (verification.status !== 'PENDING_AGENT') return;

  await prisma.transactionVerification.update({
    where: { id: verificationId },
    data: { status: 'DISPUTED' },
  });

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  await Promise.all(
    admins.map((admin) =>
      pushText(admin.lineUserId, `核銷爭議：verificationId ${verificationId}，業務申請爭議，請至後台處理。`)
    )
  );

  await pushText(agentLineUserId, '爭議申請已送出，管理員將介入處理。');
}

export { lineClient };
export default router;
