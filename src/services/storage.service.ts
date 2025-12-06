import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../lib/env";

// Initialize S3 client for Cloudflare R2
const s3Client =
  env.R2_ENDPOINT_URL && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
    ? new S3Client({
        region: "auto",
        endpoint: env.R2_ENDPOINT_URL,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

const bucketName = env.R2_BUCKET_NAME || "uploads";

/**
 * Generate a unique file key
 */
function generateFileKey(folder: string, filename: string, userId?: number): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split(".").pop() || "bin";
  const prefix = userId ? `${userId}/` : "";
  return `${folder}/${prefix}${timestamp}-${random}.${ext}`;
}

/**
 * Upload a file to R2
 */
export async function uploadFile(params: {
  file: Blob | Buffer;
  filename: string;
  folder: string;
  contentType: string;
  userId?: number;
}): Promise<{ key: string; url: string } | null> {
  if (!s3Client) {
    console.warn("[DEV] R2 not configured");
    return null;
  }

  const key = generateFileKey(params.folder, params.filename, params.userId);

  const body =
    params.file instanceof Blob ? Buffer.from(await params.file.arrayBuffer()) : params.file;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: params.contentType,
    }),
  );

  const url = env.R2_PUBLIC_URL
    ? `${env.R2_PUBLIC_URL}/${key}`
    : `${env.R2_ENDPOINT_URL}/${bucketName}/${key}`;

  return { key, url };
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<boolean> {
  if (!s3Client) {
    console.warn("[DEV] R2 not configured");
    return false;
  }

  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    return true;
  } catch (error) {
    console.error("Failed to delete file:", error);
    return false;
  }
}

/**
 * Get a presigned URL for downloading a file
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string | null> {
  if (!s3Client) {
    console.warn("[DEV] R2 not configured");
    return null;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Get a presigned URL for uploading a file
 */
export async function getUploadPresignedUrl(params: {
  filename: string;
  folder: string;
  contentType: string;
  userId?: number;
  expiresIn?: number;
}): Promise<{ key: string; uploadUrl: string } | null> {
  if (!s3Client) {
    console.warn("[DEV] R2 not configured");
    return null;
  }

  const key = generateFileKey(params.folder, params.filename, params.userId);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, {
    expiresIn: params.expiresIn || 3600,
  });

  return { key, uploadUrl };
}

// Allowed file types
export const ALLOWED_FILE_TYPES = [
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * Validate file type
 */
export function isValidFileType(
  contentType: string,
  allowedTypes: string[] = ALLOWED_FILE_TYPES,
): boolean {
  return allowedTypes.includes(contentType);
}
