import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface SettlementRecord {
  date: string;       // "YYYY-MM-DD"
  civilianName: string;
  clinicName: string;
  transactionAmount: number;
  agentEarning: number;
}

export interface AgentSettlementData {
  agentName: string;
  bankAccountName: string;
  bankCode: string;
  bankAccount: string;
  period: string;     // "2026年5月"
  records: SettlementRecord[];
  totalEarning: number;
}

export async function generateSettlementPdf(data: AgentSettlementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .text('市場推廣費結算單', { align: 'center' });

    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(12)
      .text(`結算期間：${data.period}`, { align: 'center' });

    doc.moveDown(1.5);

    // Agent info
    doc.font('Helvetica-Bold').fontSize(12).text('業務資訊');
    doc.moveDown(0.3);
    doc
      .font('Helvetica')
      .fontSize(11)
      .text(`姓名：${data.agentName}`)
      .text(`銀行帳戶名稱：${data.bankAccountName || '未填寫'}`)
      .text(`銀行代碼：${data.bankCode || '未填寫'}`)
      .text(`帳號：${data.bankAccount || '未填寫'}`);

    doc.moveDown(1.5);

    // Table header
    doc.font('Helvetica-Bold').fontSize(11).text('成交紀錄');
    doc.moveDown(0.5);

    const colX = [50, 120, 210, 310, 400, 490];
    const headers = ['日期', '民眾', '診所', '成交金額', '業務收益'];

    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] - colX[i] - 5, lineBreak: false }));
    doc.moveDown(0.3);

    // Separator line
    const lineY = doc.y;
    doc.moveTo(50, lineY).lineTo(540, lineY).stroke();
    doc.moveDown(0.2);

    // Table rows
    doc.font('Helvetica').fontSize(10);
    for (const r of data.records) {
      const rowY = doc.y;
      doc.text(r.date, colX[0], rowY, { width: colX[1] - colX[0] - 5, lineBreak: false });
      doc.text(r.civilianName, colX[1], rowY, { width: colX[2] - colX[1] - 5, lineBreak: false });
      doc.text(r.clinicName, colX[2], rowY, { width: colX[3] - colX[2] - 5, lineBreak: false });
      doc.text(`NT$${r.transactionAmount.toLocaleString()}`, colX[3], rowY, { width: colX[4] - colX[3] - 5, lineBreak: false });
      doc.text(`NT$${r.agentEarning.toLocaleString()}`, colX[4], rowY, { width: 90, lineBreak: false });
      doc.moveDown(0.8);
    }

    // Total
    doc.moveDown(0.5);
    const totalLineY = doc.y;
    doc.moveTo(50, totalLineY).lineTo(540, totalLineY).stroke();
    doc.moveDown(0.5);

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(`本月應撥款合計：NT$${data.totalEarning.toLocaleString()}`, { align: 'right' });

    doc.moveDown(2);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('grey')
      .text('本結算單由 CareBridge 平台自動產生，如有疑問請聯絡客服。', { align: 'center' });

    doc.end();
  });
}

export async function uploadPdfToS3(buffer: Buffer, key: string): Promise<string> {
  const bucket = process.env.AWS_S3_BUCKET ?? 'carebridge-uploads';

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    })
  );

  // 7-day presigned URL so agent can download
  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 7 * 24 * 3600 }
  );

  return url;
}
