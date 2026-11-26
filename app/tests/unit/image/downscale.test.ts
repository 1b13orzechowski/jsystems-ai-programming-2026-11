// ADR-004 §3.5 / AC-07, AC-10: client-side photo validation and JPEG downscaling.
// Canvas APIs are injected as mocks (not an endpoint). Inputs are real photos from assets/example-images.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { COPY } from "@/lib/domain/copy-pl";
import {
  FALLBACK_EDGE,
  MAX_EDGE,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_BYTES,
  type DecodedImage,
  type ImageEnv,
  downscaleImage,
  targetSize,
  validatePhotoFile,
} from "@/lib/image/downscale";

const MB = 1024 * 1024;

function loadPhoto(name: string, type: string): File {
  const bytes = readFileSync(join(process.cwd(), "..", "assets", "example-images", name));
  return new File([bytes], name, { type });
}

function jpegBlob(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "image/jpeg" });
}

function decodedImage(width: number, height: number, close = vi.fn()): DecodedImage {
  return { width, height, source: document.createElement("canvas"), close };
}

type EncodeCall = { width: number; height: number; quality: number };

function callsOf(encode: { mock: { calls: ReadonlyArray<readonly unknown[]> } }): EncodeCall[] {
  return encode.mock.calls.map((args) => {
    const [, width, height, quality] = args;
    return { width: Number(width), height: Number(height), quality: Number(quality) };
  });
}

describe("validatePhotoFile", () => {
  it("rejects a GIF with the format error", () => {
    expect(validatePhotoFile({ type: "image/gif", size: 1000 })).toBe("format");
  });

  it("rejects HEIC with the format error", () => {
    expect(validatePhotoFile({ type: "image/heic", size: 1000 })).toBe("format");
  });

  it("rejects a JPEG one byte above 10 MB with the size error", () => {
    expect(validatePhotoFile({ type: "image/jpeg", size: 10 * MB + 1 })).toBe("size");
  });

  it("accepts a WebP of exactly 10 MB", () => {
    expect(validatePhotoFile({ type: "image/webp", size: 10 * MB })).toBeNull();
  });

  it("uses the documented limits", () => {
    expect(MAX_INPUT_BYTES).toBe(10 * MB);
    expect(MAX_OUTPUT_BYTES).toBe(1.5 * MB);
    expect(MAX_EDGE).toBe(1568);
    expect(FALLBACK_EDGE).toBe(1280);
  });
});

describe("targetSize", () => {
  it("scales the longest edge down to the limit and keeps the aspect ratio", () => {
    const size = targetSize(3024, 3135, MAX_EDGE);
    expect(size.height).toBe(1568);
    expect(Math.abs(size.width - 3024 * (1568 / 3135))).toBeLessThanOrEqual(1);
  });

  it("never upscales", () => {
    expect(targetSize(387, 516, MAX_EDGE)).toEqual({ width: 387, height: 516 });
  });
});

describe("downscaleImage", () => {
  it("downscales a large laptop photo to a 1568 px longest edge at quality 0.82", async () => {
    const file = loadPhoto("laptop-1.png", "image/png");
    const close = vi.fn();
    const decode = vi.fn(async () => decodedImage(3024, 3135, close));
    const encode = vi.fn(async () => jpegBlob(400 * 1024));
    const env: ImageEnv = { decode, encode };

    const result = await downscaleImage(file, env);

    expect(decode).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledTimes(1);
    const [call] = callsOf(encode);
    expect(call?.height).toBe(1568);
    expect(call?.width).toBeLessThanOrEqual(1568);
    expect(call?.quality).toBe(0.82);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blob.type).toBe("image/jpeg");
      expect(result.width).toBeLessThanOrEqual(1568);
      expect(result.height).toBe(1568);
    }
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("does not upscale a small phone photo", async () => {
    const file = loadPhoto("phone-2.jpeg", "image/jpeg");
    const encode = vi.fn(async () => jpegBlob(15 * 1024));
    const env: ImageEnv = { decode: vi.fn(async () => decodedImage(387, 516)), encode };

    const result = await downscaleImage(file, env);

    expect(callsOf(encode)).toEqual([{ width: 387, height: 516, quality: 0.82 }]);
    expect(result.ok).toBe(true);
  });

  it("walks the quality chain 0.82, 0.7, 0.6 at 1568 px, then falls back to 1280 px at 0.6", async () => {
    const file = loadPhoto("laptop-1.png", "image/png");
    const encode = vi.fn(async (_image: DecodedImage, width: number, height: number) =>
      Math.max(width, height) === MAX_EDGE ? jpegBlob(2 * MB) : jpegBlob(1 * MB),
    );
    const env: ImageEnv = { decode: vi.fn(async () => decodedImage(3024, 3135)), encode };

    const result = await downscaleImage(file, env);

    const calls = callsOf(encode);
    expect(calls.map((c) => [c.height, c.quality])).toEqual([
      [1568, 0.82],
      [1568, 0.7],
      [1568, 0.6],
      [1280, 0.6],
    ]);
    expect(Math.abs((calls[3]?.width ?? 0) - 3024 * (1280 / 3135))).toBeLessThanOrEqual(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.height).toBe(1280);
      expect(result.blob.size).toBe(1 * MB);
    }
  });

  it("returns a decode error when the output is still too large after the fallback", async () => {
    const file = loadPhoto("laptop-1.png", "image/png");
    const close = vi.fn();
    const encode = vi.fn(async () => jpegBlob(2 * MB));
    const env: ImageEnv = { decode: vi.fn(async () => decodedImage(3024, 3135, close)), encode };

    const result = await downscaleImage(file, env);

    // Spec: 0.82, 0.7, 0.6 at 1568 px, then one fallback attempt at 1280 px.
    expect(encode).toHaveBeenCalledTimes(4);
    expect(result).toEqual({ ok: false, error: "decode", message: COPY.form.errors.photoUnreadable });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("returns a decode error when the encoder produces a non-JPEG blob", async () => {
    const file = loadPhoto("phone-2.jpeg", "image/jpeg");
    const close = vi.fn();
    const encode = vi.fn(async () => new Blob([new Uint8Array(1024)], { type: "image/png" }));
    const env: ImageEnv = { decode: vi.fn(async () => decodedImage(387, 516, close)), encode };

    const result = await downscaleImage(file, env);

    expect(result).toEqual({ ok: false, error: "decode", message: COPY.form.errors.photoUnreadable });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("returns a decode error without encoding when decoding throws", async () => {
    const file = loadPhoto("phone-3.jpeg", "image/jpeg");
    const encode = vi.fn(async () => jpegBlob(1024));
    const env: ImageEnv = {
      decode: vi.fn(async (): Promise<DecodedImage> => {
        throw new Error("corrupt");
      }),
      encode,
    };

    const result = await downscaleImage(file, env);

    expect(result).toEqual({ ok: false, error: "decode", message: COPY.form.errors.photoUnreadable });
    expect(encode).not.toHaveBeenCalled();
  });

  it("rejects a HEIC-typed file with the format error before decoding", async () => {
    const file = loadPhoto("phone-1.jpg", "image/heic");
    const decode = vi.fn(async () => decodedImage(900, 1200));
    const encode = vi.fn(async () => jpegBlob(1024));

    const result = await downscaleImage(file, { decode, encode });

    expect(result).toEqual({ ok: false, error: "format", message: COPY.form.errors.photoFormat });
    expect(decode).not.toHaveBeenCalled();
    expect(encode).not.toHaveBeenCalled();
  });
});
