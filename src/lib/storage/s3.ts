import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Panel yüklemeleri (kart görselleri, profil fotoğrafları) için özel S3 bucket.
 * Env: S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.
 * Bucket tanımlı değilse çağıranlar yerel diske düşer (geliştirme).
 */

/** Presigned GET süresi (sn). */
export const S3_SIGNED_URL_TTL = 600;

let client: S3Client | null = null;

function bucket(): string | null {
  return process.env.S3_BUCKET?.trim() || null;
}

export function s3Enabled(): boolean {
  return bucket() != null;
}

function s3(): S3Client {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  client ??= new S3Client({
    region: process.env.S3_REGION?.trim() || "eu-north-1",
    // Anahtar yoksa SDK’nın varsayılan zinciri (IAM rolü vb.) kullanılır.
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });
  return client;
}

export async function s3Put(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket()!,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "private, max-age=31536000, immutable",
    }),
  );
}

export async function s3Delete(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket()!, Key: key }));
}

export async function s3SignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket()!, Key: key }),
    { expiresIn: S3_SIGNED_URL_TTL },
  );
}
