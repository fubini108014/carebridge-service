import { Client } from '@line/bot-sdk';
import type { Message } from '@line/bot-sdk';

export const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
  channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
});

function formatTW(date: Date): string {
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function safePush(lineUserId: string, message: Message): Promise<void> {
  try {
    await lineClient.pushMessage(lineUserId, message);
  } catch (err) {
    console.error(`LINE push failed for ${lineUserId}:`, err);
  }
}

export async function pushBookingRequestToAgent(
  agentLineUserId: string,
  booking: { id: string; amount: string },
  slot: { startAt: Date; endAt: Date },
  civilian: { displayName: string }
): Promise<void> {
  await safePush(agentLineUserId, {
    type: 'flex',
    altText: `新預約申請 — ${civilian.displayName}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755',
        contents: [
          { type: 'text', text: '新預約申請', weight: 'bold', color: '#ffffff', size: 'lg' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `民眾：${civilian.displayName}` },
          { type: 'text', text: `時段：${formatTW(slot.startAt)} ～ ${formatTW(slot.endAt)}` },
          { type: 'text', text: `媒合費：NT$ ${booking.amount}` },
          { type: 'text', text: '請於 30 分鐘內回應', color: '#ff5555', size: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: '接受',
              data: `action=booking:accept&bookingId=${booking.id}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: '拒絕',
              data: `action=booking:reject&bookingId=${booking.id}`,
            },
          },
        ],
      },
    },
  } as Message);
}

export async function pushPaymentUrlToCivilian(
  civilianLineUserId: string,
  booking: { id: string; paymentUrl: string; amount: string },
  slot: { startAt: Date; endAt: Date }
): Promise<void> {
  await safePush(civilianLineUserId, {
    type: 'flex',
    altText: '預約已接受，請完成付款',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '業務已接受您的預約！', weight: 'bold' },
          { type: 'text', text: `時段：${formatTW(slot.startAt)}` },
          { type: 'text', text: `媒合費：NT$ ${booking.amount}` },
          { type: 'text', text: '請於 30 分鐘內完成付款', color: '#ff5555', size: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: { type: 'uri', label: '立即付款', uri: booking.paymentUrl },
          },
        ],
      },
    },
  } as Message);
}

export async function pushBookingConfirmedToCivilian(
  civilianLineUserId: string,
  slot: { startAt: Date; endAt: Date }
): Promise<void> {
  await safePush(civilianLineUserId, {
    type: 'text',
    text: `付款成功！您的預約已確認。\n時段：${formatTW(slot.startAt)} ～ ${formatTW(slot.endAt)}\n期待為您服務！`,
  });
}

export async function pushBookingConfirmedToAgent(
  agentLineUserId: string,
  slot: { startAt: Date; endAt: Date },
  civilian: { displayName: string }
): Promise<void> {
  await safePush(agentLineUserId, {
    type: 'text',
    text: `預約已確認。\n民眾：${civilian.displayName}\n時段：${formatTW(slot.startAt)} ～ ${formatTW(slot.endAt)}`,
  });
}

export async function pushText(lineUserId: string, text: string): Promise<void> {
  await safePush(lineUserId, { type: 'text', text });
}

export async function pushVerificationRequestToAgent(
  agentLineUserId: string,
  verification: { id: string; transactionAmount: string },
  booking: { id: string },
  civilian: { displayName: string },
  clinic: { name: string }
): Promise<void> {
  await safePush(agentLineUserId, {
    type: 'flex',
    altText: `診所核銷確認 — ${clinic.name}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#4A90E2',
        contents: [
          { type: 'text', text: '診所核銷通知', weight: 'bold', color: '#ffffff', size: 'lg' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: `診所：${clinic.name}` },
          { type: 'text', text: `民眾：${civilian.displayName}` },
          { type: 'text', text: `成交金額：NT$ ${verification.transactionAmount}`, weight: 'bold', size: 'lg', color: '#333333' },
          { type: 'text', text: '請於 30 分鐘內確認，否則自動核銷', color: '#ff5555', size: 'sm' },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'postback',
              label: '確認',
              data: `action=transaction:confirm&verificationId=${verification.id}`,
            },
          },
          {
            type: 'button',
            style: 'secondary',
            action: {
              type: 'postback',
              label: '申請爭議',
              data: `action=transaction:dispute&verificationId=${verification.id}`,
            },
          },
        ],
      },
    },
  } as Message);
}

export async function bindRichMenu(lineUserId: string, richMenuId: string): Promise<void> {
  if (!richMenuId) return;
  try {
    await lineClient.linkRichMenuToUser(lineUserId, richMenuId);
  } catch (err) {
    console.error(`Rich menu bind failed for ${lineUserId}:`, err);
  }
}
