import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const IMAGE_GENERATION_TIMEOUT_MS = 120_000;
const ALLOWED_GARMENT_TYPES = new Set(["image/jpeg", "image/png"]);

export class ImageGenerationNotConfiguredError extends Error {
  constructor(message = "Gemini image generation is not configured") {
    super(message);
    this.name = "ImageGenerationNotConfiguredError";
  }
}

export class ImageGenerationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationValidationError";
  }
}

export class ImageGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageGenerationError";
  }
}

export type GenerateGarmentImageInput = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
  age?: string;
  gender?: string;
  background?: string;
  customPrompt?: string;
  aspectRatio?: string;
};

export type GeneratedImageFile = {
  buffer: Buffer;
  mimetype: "image/png";
  originalname: string;
  size: number;
};

export function isImageGenerationConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== "YOUR_API_KEY_HERE");
}

function resolveModuleRoot(): string {
  const override = process.env.IMAGE_GENERATION_MODULE_PATH?.trim();
  const candidates = [
    override,
    path.resolve(process.cwd(), "Image_Generation_Module"),
    path.resolve(process.cwd(), "..", "..", "Image_Generation_Module"),
    path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..", "Image_Generation_Module"),
    path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "Image_Generation_Module"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, "generate_cli.py"))) {
      return candidate;
    }
  }

  throw new ImageGenerationError(
    "Image_Generation_Module was not found. Set IMAGE_GENERATION_MODULE_PATH if the module is elsewhere.",
  );
}

function pythonInvocations(): Array<{ command: string; prefixArgs: string[] }> {
  const override = process.env.IMAGE_GENERATION_PYTHON?.trim();
  if (override) {
    const parts = override.split(/\s+/).filter(Boolean);
    return [{ command: parts[0] ?? override, prefixArgs: parts.slice(1) }];
  }
  if (process.platform === "win32") {
    return [
      { command: "py", prefixArgs: ["-3"] },
      { command: "python", prefixArgs: [] },
      { command: "python3", prefixArgs: [] },
    ];
  }
  return [
    { command: "python3", prefixArgs: [] },
    { command: "python", prefixArgs: [] },
  ];
}

function spawnPython(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(
        new ImageGenerationError(
          `Image generation timed out after ${IMAGE_GENERATION_TIMEOUT_MS / 1000} seconds`,
        ),
      );
    }, IMAGE_GENERATION_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const detail = stderr.trim() || stdout.trim() || `exit code ${code}`;
      reject(new ImageGenerationError(detail));
    });
  });
}

async function runGenerateCli(moduleRoot: string, configPath: string): Promise<void> {
  let lastMissing: Error | undefined;
  for (const invocation of pythonInvocations()) {
    try {
      await spawnPython(
        invocation.command,
        [...invocation.prefixArgs, "generate_cli.py", "--config", configPath],
        moduleRoot,
      );
      return;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (errno.code === "ENOENT") {
        lastMissing = errno;
        continue;
      }
      throw error;
    }
  }
  throw new ImageGenerationError(
    lastMissing
      ? "Python 3 was not found. Install Python and the Image_Generation_Module requirements, or set IMAGE_GENERATION_PYTHON."
      : "Image generation failed to start Python",
  );
}

export async function generateGarmentImageFile(
  input: GenerateGarmentImageInput,
): Promise<GeneratedImageFile> {
  if (!isImageGenerationConfigured()) {
    throw new ImageGenerationNotConfiguredError(
      "Gemini image generation is not configured. Set GEMINI_API_KEY.",
    );
  }
  if (!ALLOWED_GARMENT_TYPES.has(input.mimetype)) {
    throw new ImageGenerationValidationError(
      "Garment image must be JPEG or PNG for generation.",
    );
  }
  if (input.size <= 0 || input.buffer.length <= 0) {
    throw new ImageGenerationValidationError("Garment image file is empty.");
  }

  const aspectRatio = input.aspectRatio?.trim() || "1:1";
  if (!["1:1", "4:5", "3:4", "16:9"].includes(aspectRatio)) {
    throw new ImageGenerationValidationError(
      'aspectRatio must be one of "1:1", "4:5", "3:4", or "16:9".',
    );
  }

  const moduleRoot = resolveModuleRoot();
  const tempRoot = await mkdtemp(path.join(tmpdir(), "me-garment-gen-"));
  try {
    const ext = input.mimetype === "image/png" ? ".png" : ".jpg";
    const garmentPath = path.join(tempRoot, `garment${ext}`);
    const outputPath = path.join(tempRoot, "generated.png");
    const configPath = path.join(tempRoot, "config.json");
    await writeFile(garmentPath, input.buffer);
    await writeFile(
      configPath,
      JSON.stringify({
        garment_image_path: garmentPath,
        output_path: outputPath,
        age: input.age?.trim() || undefined,
        gender: input.gender?.trim() || undefined,
        background: input.background?.trim() || undefined,
        custom_prompt: input.customPrompt?.trim() || undefined,
        aspect_ratio: aspectRatio,
      }),
    );

    await runGenerateCli(moduleRoot, configPath);
    const buffer = await readFile(outputPath);
    if (!buffer.length) {
      throw new ImageGenerationError("Generation produced an empty image");
    }
    return {
      buffer,
      mimetype: "image/png",
      originalname: "generated-garment.png",
      size: buffer.length,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}
