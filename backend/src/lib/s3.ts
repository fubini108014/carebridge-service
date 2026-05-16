import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET = () => process.env.AWS_S3_BUCKET ?? 'carebridge-uploads';

/** Generate a presigned PUT URL valid for 5 minutes. Returns { uploadUrl, objectKey }. */
export async function getPresignedPutUrl(
  prefix: string,
  contentType: string
): Promise<{ uploadUrl: string; objectKey: string }> {
  const ext = contentType.split('/')[1] ?? 'bin';
  const objectKey = `${prefix}/${crypto.randomBytes(12).toString('hex')}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: objectKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { uploadUrl, objectKey };
}
