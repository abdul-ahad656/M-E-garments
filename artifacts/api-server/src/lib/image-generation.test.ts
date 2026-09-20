import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("image-generation configuration and validation", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...envBackup };
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.resetModules();
  });

  it("is not configured without GEMINI_API_KEY", async () => {
    const { isImageGenerationConfigured } = await import("./image-generation");
    expect(isImageGenerationConfigured()).toBe(false);
  });

  it("rejects placeholder API keys", async () => {
    process.env.GEMINI_API_KEY = "YOUR_API_KEY_HERE";
    const { isImageGenerationConfigured } = await import("./image-generation");
    expect(isImageGenerationConfigured()).toBe(false);
  });

  it("rejects unsupported garment types before spawning Python", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const { generateGarmentImageFile, ImageGenerationValidationError } =
      await import("./image-generation");
    await expect(
      generateGarmentImageFile({
        buffer: Buffer.from([1, 2, 3]),
        mimetype: "image/webp",
        originalname: "shirt.webp",
        size: 3,
      }),
    ).rejects.toBeInstanceOf(ImageGenerationValidationError);
  });

  it("rejects empty garment files", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    const { generateGarmentImageFile, ImageGenerationValidationError } =
      await import("./image-generation");
    await expect(
      generateGarmentImageFile({
        buffer: Buffer.alloc(0),
        mimetype: "image/jpeg",
        originalname: "shirt.jpg",
        size: 0,
      }),
    ).rejects.toBeInstanceOf(ImageGenerationValidationError);
  });

  it("fails closed when the API key is missing", async () => {
    const { generateGarmentImageFile, ImageGenerationNotConfiguredError } =
      await import("./image-generation");
    await expect(
      generateGarmentImageFile({
        buffer: Buffer.from([1, 2, 3]),
        mimetype: "image/jpeg",
        originalname: "shirt.jpg",
        size: 3,
      }),
    ).rejects.toBeInstanceOf(ImageGenerationNotConfiguredError);
  });
});
