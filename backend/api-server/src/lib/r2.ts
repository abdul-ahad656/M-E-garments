import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import path from "node:path";

export const R2_MAX_FILES = 20;
export const R2_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const R2_ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export class R2NotConfiguredError extends Error {
  constructor(message = "Cloudflare R2 is not configured") {
    super(message);
    this.name = "R2NotConfiguredError";
  }
}

export class R2UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2UploadError";
  }
}

export class R2ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2ValidationError";
  }
}

export type R2UploadFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

function trimEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

export function isR2Configured(): boolean {
  return Boolean(
    trimEnv("R2_ACCOUNT_ID") &&
      trimEnv("R2_ACCESS_KEY_ID") &&
      trimEnv("R2_SECRET_ACCESS_KEY") &&
      trimEnv("R2_BUCKET_NAME") &&
      trimEnv("R2_PUBLIC_BASE_URL"),
  );
}

function requireR2Config(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
} {
  const accountId = trimEnv("R2_ACCOUNT_ID");
  const accessKeyId = trimEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = trimEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = trimEnv("R2_BUCKET_NAME");
  const publicBaseUrl = trimEnv("R2_PUBLIC_BASE_URL")?.replace(/\/+$/, "");

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicBaseUrl
  ) {
    throw new R2NotConfiguredError(
      "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL.",
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicBaseUrl,
  };
}

function createR2Client(accountId: string, accessKeyId: string, secretAccessKey: string) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function sanitizeFilename(originalname: string): string {
  const base = path.basename(originalname).replace(/[^a-zA-Z0-9._-]+/g, "-");
  const cleaned = base.replace(/^-+|-+$/g, "").slice(0, 80);
  return cleaned || "image";
}

function validateFiles(files: R2UploadFile[]): void {
  if (!files.length) {
    throw new R2ValidationError("At least one image file is required");
  }
  if (files.length > R2_MAX_FILES) {
    throw new R2ValidationError(`At most ${R2_MAX_FILES} images can be uploaded at once`);
  }

  for (const file of files) {
    if (!R2_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new R2ValidationError(
        `Unsupported file type "${file.mimetype}". Use JPEG, PNG, WebP, or GIF.`,
      );
    }
    if (file.size <= 0 || file.buffer.length <= 0) {
      throw new R2ValidationError(`Empty file "${file.originalname}" is not allowed`);
    }
    if (file.size > R2_MAX_FILE_BYTES) {
      throw new R2ValidationError(
        `File "${file.originalname}" exceeds the ${R2_MAX_FILE_BYTES / (1024 * 1024)}MB limit`,
      );
    }
  }
}

export async function uploadProductImages(files: R2UploadFile[]): Promise<string[]> {
  validateFiles(files);
  const config = requireR2Config();
  const client = createR2Client(
    config.accountId,
    config.accessKeyId,
    config.secretAccessKey,
  );

  const urls: string[] = [];
  try {
    for (const file of files) {
      const key = `products/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      urls.push(`${config.publicBaseUrl}/${key}`);
    }
  } catch (error) {
    if (
      error instanceof R2NotConfiguredError ||
      error instanceof R2ValidationError ||
      error instanceof R2UploadError
    ) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Cloudflare R2 upload failed";
    throw new R2UploadError(message);
  } finally {
    client.destroy();
  }

  return urls;
}
