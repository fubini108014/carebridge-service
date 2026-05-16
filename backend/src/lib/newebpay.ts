import crypto from 'crypto';
import qs from 'querystring';

const HASH_KEY = () => process.env.NEWEBPAY_HASH_KEY!;
const HASH_IV = () => process.env.NEWEBPAY_HASH_IV!;
const MERCHANT_ID = () => process.env.NEWEBPAY_MERCHANT_ID!;

// NewebPay sandbox vs production gateway
const GATEWAY_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://core.newebpay.com/MPG/mpg_gateway'
    : 'https://ccore.newebpay.com/MPG/mpg_gateway';

function aesEncrypt(data: string): string {
  const cipher = crypto.createCipheriv('aes-256-cbc', HASH_KEY(), HASH_IV());
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

function aesDecrypt(hex: string): string {
  const decipher = crypto.createDecipheriv('aes-256-cbc', HASH_KEY(), HASH_IV());
  return decipher.update(hex, 'hex', 'utf8') + decipher.final('utf8');
}

function buildTradeSha(tradeInfo: string): string {
  const raw = `HashKey=${HASH_KEY()}&${tradeInfo}&HashIV=${HASH_IV()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').toUpperCase();
}

export interface PaymentFormInput {
  merchantOrderNo: string;
  amount: number; // integer NTD
  itemDesc: string;
  email?: string;
}

export function generateMerchantOrderNo(): string {
  return crypto.randomBytes(10).toString('hex').toUpperCase();
}

export function buildPaymentForm(params: PaymentFormInput): {
  apiUrl: string;
  fields: Record<string, string>;
} {
  const tradeParams = qs.stringify({
    MerchantID: MERCHANT_ID(),
    RespondType: 'JSON',
    TimeStamp: Math.floor(Date.now() / 1000).toString(),
    Version: '2.0',
    MerchantOrderNo: params.merchantOrderNo,
    Amt: params.amount.toString(),
    ItemDesc: params.itemDesc,
    ReturnURL: process.env.NEWEBPAY_RETURN_URL ?? '',
    NotifyURL: process.env.NEWEBPAY_NOTIFY_URL ?? '',
    Email: params.email ?? '',
  });

  const tradeInfo = aesEncrypt(tradeParams);
  const tradeSha = buildTradeSha(tradeInfo);

  return {
    apiUrl: GATEWAY_URL,
    fields: {
      MerchantID: MERCHANT_ID(),
      TradeInfo: tradeInfo,
      TradeSha: tradeSha,
      Version: '2.0',
    },
  };
}

export function decryptWebhookPayload(tradeInfo: string, tradeSha: string): Record<string, unknown> {
  const expected = buildTradeSha(tradeInfo);
  if (expected !== tradeSha) throw new Error('TradeSha mismatch');
  const raw = aesDecrypt(tradeInfo);
  return JSON.parse(raw) as Record<string, unknown>;
}
