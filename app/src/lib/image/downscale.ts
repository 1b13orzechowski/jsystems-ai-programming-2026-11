// ADR-004 §3.5 / AC-07, AC-10: validate the selected photo and convert it to a JPEG before upload.
// Browser-only module: no server imports. Canvas APIs are injectable through `ImageEnv` for unit tests.
import { COPY } from "@/lib/domain/copy-pl";

export const ACCEPTED_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024;
export const MAX_EDGE = 1568;
export const FALLBACK_EDGE = 1280;

const QUALITY_CHAIN: readonly number[] = [0.82, 0.7, 0.6];
const FALLBACK_QUALITY = 0.6;

export type DownscaleError = "format" | "size" | "decode";
export type DownscaleResult =
  | { ok: true; blob: Blob; width: number; height: number }
  | { ok: false; error: DownscaleError; message: string };

export type DecodedImage = { width: number; height: number; source: CanvasImageSource; close(): void };
export type ImageEnv = {
  decode(file: Blob): Promise<DecodedImage>;
  encode(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob>;
};

const MESSAGES: Record<DownscaleError, string> = {
  format: COPY.form.errors.photoFormat,
  size: COPY.form.errors.photoSize,
  decode: COPY.form.errors.photoUnreadable,
};

export function validatePhotoFile(file: { type: string; size: number }): DownscaleError | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "format";
  if (file.size > MAX_INPUT_BYTES) return "size";
  return null;
}

export function targetSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function browserDecode(file: Blob): Promise<DecodedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return {
    width: bitmap.width,
    height: bitmap.height,
    source: bitmap,
    close: () => bitmap.close(),
  };
}

async function browserEncode(image: DecodedImage, width: number, height: number, quality: number): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image.source, 0, 0, width, height);
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image.source, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}

const browserEnv: ImageEnv = { decode: browserDecode, encode: browserEncode };

const UNREADABLE = "decode";

// Encodes one attempt. Returns the blob when it fits and is a JPEG; null when it is too large.
// Throws on encoder failure or a wrong blob type, which the caller maps to a decode error.
async function attempt(
  env: ImageEnv,
  image: DecodedImage,
  edge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  const size = targetSize(image.width, image.height, edge);
  const blob = await env.encode(image, size.width, size.height, quality);
  if (blob.type !== "image/jpeg") throw new Error(`unexpected output type: ${blob.type}`);
  if (blob.size > MAX_OUTPUT_BYTES) return null;
  return { blob, width: size.width, height: size.height };
}

async function encodeWithinLimit(env: ImageEnv, image: DecodedImage) {
  for (const quality of QUALITY_CHAIN) {
    const result = await attempt(env, image, MAX_EDGE, quality);
    if (result) return result;
  }
  return attempt(env, image, FALLBACK_EDGE, FALLBACK_QUALITY);
}

export async function downscaleImage(file: File, env: ImageEnv = browserEnv): Promise<DownscaleResult> {
  const invalid = validatePhotoFile(file);
  if (invalid) return { ok: false, error: invalid, message: MESSAGES[invalid] };

  let image: DecodedImage;
  try {
    image = await env.decode(file);
  } catch {
    return { ok: false, error: UNREADABLE, message: MESSAGES[UNREADABLE] };
  }

  try {
    const result = await encodeWithinLimit(env, image);
    if (!result) return { ok: false, error: UNREADABLE, message: MESSAGES[UNREADABLE] };
    return { ok: true, blob: result.blob, width: result.width, height: result.height };
  } catch {
    return { ok: false, error: UNREADABLE, message: MESSAGES[UNREADABLE] };
  } finally {
    image.close();
  }
}
