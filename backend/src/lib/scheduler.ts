import { prisma } from './prisma';
import { pushText } from './line-notify';
import { expandAllActiveRules } from './scheduling';
import { createEarningFromVerification } from '../routes/webhook.route';
import { generateSettlementPdf, uploadPdfToS3 } from './pdf';

let lastExpandAt = 0;
let lastReminderDate = '';
let lastPayoutMonth = '';

function getTaiwanHour(): number {
  return (new Date().getUTCHours() + 8) % 24;
}

function getTaiwanDateStr(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// Returns "YYYY-MM" in Taiwan time
function getTaiwanYearMonth(): string {
  return getTaiwanDateStr().slice(0, 7);
}

// Returns day-of-month (1–31) in Taiwan time
function getTaiwanDay(): number {
  return parseInt(getTaiwanDateStr().slice(8, 10), 10);
}

export function startScheduler(): void {
  setInterval(checkExpiredBookings, 60_000);
  setInterval(checkExpiredVerifications, 60_000);
  setInterval(runDailyTasks, 60_000);
  console.log('Scheduler started (60s interval)');
}

async function runDailyTasks(): Promise<void> {
  const now = Date.now();

  // Expand rules once per day
  if (now - lastExpandAt > 24 * 3600 * 1000) {
    lastExpandAt = now;
    try {
      await expandAllActiveRules(4);
    } catch (err) {
      console.error('Rule expansion failed:', err);
    }
  }

  const hour = getTaiwanHour();
  const dateStr = getTaiwanDateStr();

  // Send service day reminders at 8 AM Taiwan time
  if (hour >= 8 && lastReminderDate !== dateStr) {
    lastReminderDate = dateStr;
    try {
      await sendServiceDayReminders(dateStr);
    } catch (err) {
      console.error('Service day reminder failed:', err);
    }
  }

  // Monthly payout on the 5th at 10 AM Taiwan time
  const yearMonth = getTaiwanYearMonth();
  if (getTaiwanDay() === 5 && hour >= 10 && lastPayoutMonth !== yearMonth) {
    lastPayoutMonth = yearMonth;
    try {
      await runMonthlyPayout(yearMonth);
    } catch (err) {
      console.error('Monthly payout failed:', err);
    }
  }
}

async function runMonthlyPayout(yearMonth: string): Promise<void> {
  // Find all agents with AVAILABLE wallet transactions
  const agents = await prisma.agentProfile.findMany({
    where: {
      walletTransactions: { some: { status: 'AVAILABLE' } },
    },
    include: {
      user: { select: { displayName: true, lineUserId: true } },
      walletTransactions: {
        where: { status: 'AVAILABLE' },
        include: {
          verification: {
            include: {
              booking: {
                include: {
                  civilian: { select: { displayName: true } },
                  slot: true,
                  commissionSnapshot: true,
                },
              },
              clinicProfile: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  const [prevYear, prevMonth] = getPrevYearMonth(yearMonth);
  const periodLabel = `${prevYear}年${prevMonth}月`;

  for (const agent of agents) {
    const available = agent.walletTransactions;
    const total = available.reduce((sum, tx) => sum + Number(tx.amount), 0);

    if (total <= 0) continue;

    // Generate a payout reference
    const payoutRef = `PAY-${yearMonth}-${agent.id.slice(0, 8).toUpperCase()}`;

    // Build settlement records for PDF
    const records = available
      .filter((tx) => tx.verification)
      .map((tx) => {
        const v = tx.verification!;
        const dateStr = v.booking.slot.startAt.toISOString().slice(0, 10);
        const agentEarning = v.booking.commissionSnapshot
          ? Number(v.booking.commissionSnapshot.agentEarning)
          : Number(tx.amount);
        return {
          date: dateStr,
          civilianName: v.booking.civilian.displayName,
          clinicName: v.clinicProfile.name,
          transactionAmount: Number(v.transactionAmount),
          agentEarning,
        };
      });

    // Generate PDF
    const pdfBuffer = await generateSettlementPdf({
      agentName: agent.user.displayName,
      bankAccountName: agent.bankAccountName ?? '',
      bankCode: agent.bankCode ?? '',
      bankAccount: agent.bankAccount ?? '',
      period: periodLabel,
      records,
      totalEarning: total,
    });

    const s3Key = `settlements/${yearMonth}/${agent.id}.pdf`;
    const pdfUrl = await uploadPdfToS3(pdfBuffer, s3Key);

    // Mark all AVAILABLE transactions as PAID and create a PAYOUT record
    await prisma.$transaction([
      ...available.map((tx) =>
        prisma.walletTransaction.update({
          where: { id: tx.id },
          data: { status: 'PAID', paidAt: new Date(), newebpayPayoutRef: payoutRef },
        })
      ),
      prisma.walletTransaction.create({
        data: {
          agentProfileId: agent.id,
          type: 'PAYOUT',
          amount: -total,
          status: 'PAID',
          paidAt: new Date(),
          newebpayPayoutRef: payoutRef,
          note: `${periodLabel} 月結撥款`,
        },
      }),
    ]);

    await pushText(
      agent.user.lineUserId,
      `CareBridge ${periodLabel} 月結完成！\n撥款金額：NT$${total.toLocaleString()}\n結算單：${pdfUrl}\n\n款項將依銀行處理時間入帳，如有疑問請聯絡客服。`
    );

    console.log(`Monthly payout done for agent ${agent.id}: NT$${total}, ref ${payoutRef}`);
  }
}

function getPrevYearMonth(yearMonth: string): [number, number] {
  const [y, m] = yearMonth.split('-').map(Number);
  if (m === 1) return [y - 1, 12];
  return [y, m - 1];
}

async function sendServiceDayReminders(dateStr: string): Promise<void> {
  const start = new Date(`${dateStr}T00:00:00+08:00`);
  const end = new Date(`${dateStr}T23:59:59+08:00`);

  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      slot: { startAt: { gte: start, lte: end } },
    },
    include: {
      civilian: true,
      agentProfile: { include: { user: true } },
      slot: true,
    },
  });

  for (const booking of bookings) {
    const timeStr = booking.slot.startAt.toLocaleTimeString('zh-TW', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    await pushText(
      booking.civilian.lineUserId,
      `提醒：您今天 ${timeStr} 有陪診預約服務，請準時與業務 ${booking.agentProfile.user.displayName} 會合。`
    );
    await pushText(
      booking.agentProfile.user.lineUserId,
      `提醒：您今天 ${timeStr} 有陪診服務，民眾：${booking.civilian.displayName}，請準時赴約。`
    );
  }
}

async function checkExpiredVerifications(): Promise<void> {
  const now = new Date();

  const expired = await prisma.transactionVerification.findMany({
    where: { status: 'PENDING_AGENT', agentConfirmDeadline: { lt: now } },
    include: {
      booking: { include: { agentProfile: { include: { user: true } } } },
      clinicProfile: { include: { user: true } },
    },
  });

  for (const v of expired) {
    await prisma.transactionVerification.update({
      where: { id: v.id },
      data: { status: 'AUTO_CONFIRMED', confirmedAt: now },
    });

    await createEarningFromVerification(v.id);

    await pushText(
      v.booking.agentProfile.user.lineUserId,
      `核銷已自動確認（逾時未回應），成交金額 NT$${v.transactionAmount}，收益將在月結時撥款。`
    );
    await pushText(
      v.clinicProfile.user.lineUserId,
      `業務未在時限內回應，核銷已自動確認，成交金額 NT$${v.transactionAmount}。`
    );
  }
}

async function checkExpiredBookings(): Promise<void> {
  const now = new Date();

  // PENDING_AGENT bookings where agent did not respond in time
  const agentExpired = await prisma.booking.findMany({
    where: { status: 'PENDING_AGENT', agentResponseDeadline: { lt: now } },
    include: { civilian: true },
  });

  for (const booking of agentExpired) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'EXPIRED_AGENT', cancelledBy: 'system', cancelledAt: now },
    });
    await pushText(
      booking.civilian.lineUserId,
      `很抱歉，您的預約因業務未在時限內回應而自動取消，請重新選擇時段。`
    );
  }

  // LOCKED bookings where civilian did not pay in time
  const paymentExpired = await prisma.booking.findMany({
    where: { status: 'LOCKED', paymentDeadline: { lt: now } },
    include: {
      civilian: true,
      agentProfile: { include: { user: true } },
    },
  });

  for (const booking of paymentExpired) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'EXPIRED_PAYMENT', cancelledBy: 'system', cancelledAt: now },
      }),
      prisma.availabilitySlot.update({
        where: { id: booking.slotId },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    await pushText(booking.civilian.lineUserId, `您的預約因未在時限內完成付款而自動取消。`);
    await pushText(
      booking.agentProfile.user.lineUserId,
      `民眾未完成付款，預約已自動取消，時段已釋放。`
    );
  }
}
