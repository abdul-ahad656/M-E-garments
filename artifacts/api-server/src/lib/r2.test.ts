import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const send = vi.fn();
const destroy = vi.fn();

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send = send;
    destroy = destroy;
  },
  PutObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

describe("r2 uploadProductImages", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    send.mockResolvedValue({});
    process.env.R2_ACCOUNT_ID = "acct";
    process.env.R2_ACCESS_KEY_ID = "key";
    process.env.R2_SECRET_ACCESS_KEY = "secret";
    process.env.R2_BUCKET_NAME = "me-garments-products";
    process.env.R2_PUBLIC_BASE_URL = "https://pub-example.r2.dev";
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.resetModules();
  });

  it("returns public URLs after PutObject", async () => {
    const { uploadProductImages } = await import("../lib/r2");
    const urls = await uploadProductImages([
      {
        buffer: Buffer.from([1, 2, 3]),
        mimetype: "image/jpeg",
        originalname: "shirt front.jpg",
        size: 3,
      },
    ]);

    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(
      /^https:\/\/pub-example\.r2\.dev\/products\/.+-shirt-front\.jpg$/,
    );
    expect(send).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("rejects unsupported MIME types", async () => {
    const { uploadProductImages, R2ValidationError } = await import("../lib/r2");
    await expect(
      uploadProductImages([
        {
          buffer: Buffer.from("hello"),
          mimetype: "text/plain",
          originalname: "notes.txt",
          size: 5,
        },
      ]),
    ).rejects.toBeInstanceOf(R2ValidationError);
    expect(send).not.toHaveBeenCalled();
  });

  it("fails when R2 env is missing", async () => {
    delete process.env.R2_ACCOUNT_ID;
    const { uploadProductImages, R2NotConfiguredError } = await import("../lib/r2");
    await expect(
      uploadProductImages([
        {
          buffer: Buffer.from([1]),
          mimetype: "image/png",
          originalname: "a.png",
          size: 1,
        },
      ]),
    ).rejects.toBeInstanceOf(R2NotConfiguredError);
  });
});
