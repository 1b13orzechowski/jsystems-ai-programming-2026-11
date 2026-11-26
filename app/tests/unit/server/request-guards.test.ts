// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CASE_BODY_LIMIT_BYTES,
  CASE_PHOTO_LIMIT_BYTES,
  CHAT_BODY_LIMIT_BYTES,
  checkContentLength,
  failureResponse,
  isJpegBytes,
  isMultipart,
  parseCaseRequest,
  type GuardFailure,
} from "@/lib/server/request-guards";

// Real example images from the repository (synthetic test inputs, never sent anywhere).
const ASSETS = join(process.cwd(), "..", "assets", "example-images");
function loadAsset(fileName: string): Uint8Array<ArrayBuffer> {
  const source = readFileSync(join(ASSETS, fileName));
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

const PHONE_JPEG = loadAsset("phone-1.jpg");
const LAPTOP_WEBP = loadAsset("laptop-2.webp");
const TODAY = "2026-11-26";
const URL_CASE = "http://localhost/api/case";

type Fields = Record<string, string>;

function validFields(overrides: Fields = {}): Fields {
  return {
    caseType: "zwrot",
    category: "Smartfon",
    model: "Synthetic Model X",
    purchaseDate: "2026-11-21",
    reason: "",
    photoName: "phone-1.jpg",
    ...overrides,
  };
}

function buildMultipart(fields: Fields, photo: File | null): Request {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  if (photo) form.append("photo", photo);
  return new Request(URL_CASE, { method: "POST", body: form });
}

function jpegFile(bytes: Uint8Array<ArrayBuffer> = PHONE_JPEG): File {
  return new File([bytes], "phone-1.jpg", { type: "image/jpeg" });
}

async function expectFailure(pending: ReturnType<typeof parseCaseRequest>): Promise<GuardFailure> {
  const result = await pending;
  if (result.ok) throw new Error("expected the request to be rejected");
  return result.failure;
}

describe("checkContentLength", () => {
  it("rejects a Content-Length above the case body limit with 413 PAYLOAD_TOO_LARGE", () => {
    const request = new Request(URL_CASE, {
      method: "POST",
      headers: { "content-length": String(Math.floor(CASE_BODY_LIMIT_BYTES) + 1) },
      body: "x",
    });
    expect(checkContentLength(request, CASE_BODY_LIMIT_BYTES)).toEqual({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("accepts a Content-Length at or below the limit", () => {
    const request = new Request(URL_CASE, {
      method: "POST",
      headers: { "content-length": String(Math.floor(CASE_BODY_LIMIT_BYTES)) },
      body: "x",
    });
    expect(checkContentLength(request, CASE_BODY_LIMIT_BYTES)).toBeNull();
  });

  it("applies the limit it is given (chat body limit of 256 KB)", () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-length": String(CHAT_BODY_LIMIT_BYTES + 1) },
      body: "x",
    });
    expect(checkContentLength(request, CHAT_BODY_LIMIT_BYTES)).toEqual({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("returns null when the header is missing (the later bounded checks still apply)", () => {
    const request = new Request(URL_CASE, { method: "POST", body: "x" });
    expect(checkContentLength(request, CASE_BODY_LIMIT_BYTES)).toBeNull();
  });
});

describe("isMultipart", () => {
  it("accepts multipart/form-data with parameters", () => {
    const request = new Request(URL_CASE, {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=abc" },
      body: "x",
    });
    expect(isMultipart(request)).toBe(true);
  });

  it("rejects other content types and a missing content type", () => {
    const json = new Request(URL_CASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(isMultipart(json)).toBe(false);
    expect(isMultipart(new Request(URL_CASE, { method: "POST", body: "x" }))).toBe(false);
  });
});

describe("isJpegBytes", () => {
  it("recognises the FF D8 FF magic bytes of the real JPEG", () => {
    expect(isJpegBytes(PHONE_JPEG)).toBe(true);
    expect(Array.from(PHONE_JPEG.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
  });

  it("rejects real WebP bytes and arrays shorter than three bytes", () => {
    expect(isJpegBytes(LAPTOP_WEBP)).toBe(false);
    expect(isJpegBytes(new Uint8Array([0xff, 0xd8]))).toBe(false);
  });
});

describe("parseCaseRequest", () => {
  it("returns 413 before reading the body when Content-Length is too large", async () => {
    const request = new Request(URL_CASE, {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=abc",
        "content-length": String(Math.floor(CASE_BODY_LIMIT_BYTES) + 1),
      },
      body: "x",
    });
    const formDataSpy = vi.spyOn(request, "formData");

    const failure = await expectFailure(parseCaseRequest(request, TODAY));

    expect(failure).toEqual({ status: 413, code: "PAYLOAD_TOO_LARGE" });
    expect(formDataSpy).not.toHaveBeenCalled();
  });

  it("returns 415 UNSUPPORTED_MEDIA_TYPE for application/json", async () => {
    const request = new Request(URL_CASE, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validFields()),
    });

    expect(await expectFailure(parseCaseRequest(request, TODAY))).toEqual({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("parses a valid multipart request into the case input and a JPEG byte array", async () => {
    const result = await parseCaseRequest(buildMultipart(validFields(), jpegFile()), TODAY);

    if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result.failure)}`);
    expect(result.value.input).toEqual({
      caseType: "zwrot",
      category: "Smartfon",
      model: "Synthetic Model X",
      purchaseDate: "2026-11-21",
      reason: "",
    });
    expect(result.value.photo).toBeInstanceOf(Uint8Array);
    expect(Array.from(result.value.photo.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);
    expect(result.value.photo.byteLength).toBe(PHONE_JPEG.byteLength);
    expect(result.value.photoName).toBe("phone-1.jpg");
  });

  it("falls back to zdjecie.jpg when photoName is missing", async () => {
    const fields = validFields();
    Reflect.deleteProperty(fields, "photoName");

    const result = await parseCaseRequest(buildMultipart(fields, jpegFile()), TODAY);

    if (!result.ok) throw new Error("expected ok");
    expect(result.value.photoName).toBe("zdjecie.jpg");
  });

  it("trims photoName and cuts it to 200 characters", async () => {
    const result = await parseCaseRequest(
      buildMultipart(validFields({ photoName: `  ${"a".repeat(250)}  ` }), jpegFile()),
      TODAY,
    );

    if (!result.ok) throw new Error("expected ok");
    expect(result.value.photoName).toBe("a".repeat(200));
  });

  it("returns 400 with fields [photo] when the photo is missing", async () => {
    const failure = await expectFailure(parseCaseRequest(buildMultipart(validFields(), null), TODAY));
    expect(failure).toEqual({ status: 400, code: "VALIDATION_FAILED", fields: ["photo"] });
  });

  it("returns 413 when the photo is larger than 2 MB", async () => {
    const repeats = Math.ceil((CASE_PHOTO_LIMIT_BYTES + 1) / PHONE_JPEG.byteLength);
    const big = new Uint8Array(PHONE_JPEG.byteLength * repeats);
    for (let i = 0; i < repeats; i++) big.set(PHONE_JPEG, i * PHONE_JPEG.byteLength);
    expect(big.byteLength).toBeGreaterThan(CASE_PHOTO_LIMIT_BYTES);

    const oversized = new File([big], "big.jpg", { type: "image/jpeg" });
    const failure = await expectFailure(parseCaseRequest(buildMultipart(validFields(), oversized), TODAY));
    expect(failure).toEqual({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });

  it("returns 415 for a WebP photo declared as image/webp", async () => {
    const webp = new File([LAPTOP_WEBP], "laptop-2.webp", { type: "image/webp" });
    expect(await expectFailure(parseCaseRequest(buildMultipart(validFields(), webp), TODAY))).toEqual({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("returns 415 for WebP bytes labelled image/jpeg (magic-byte check)", async () => {
    const mislabelled = new File([LAPTOP_WEBP], "laptop-2.jpg", { type: "image/jpeg" });
    expect(await expectFailure(parseCaseRequest(buildMultipart(validFields(), mislabelled), TODAY))).toEqual({
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    });
  });

  it("returns 400 VALIDATION_FAILED with the model field name for an empty model", async () => {
    const failure = await expectFailure(
      parseCaseRequest(buildMultipart(validFields({ model: "" }), jpegFile()), TODAY),
    );
    expect(failure).toEqual({ status: 400, code: "VALIDATION_FAILED", fields: ["model"] });
  });

  it("returns 400 with the purchaseDate field name for a future date", async () => {
    const failure = await expectFailure(
      parseCaseRequest(buildMultipart(validFields({ purchaseDate: "2026-11-27" }), jpegFile()), TODAY),
    );
    expect(failure).toEqual({ status: 400, code: "VALIDATION_FAILED", fields: ["purchaseDate"] });
  });

  it("returns 400 with the reason field name for a reklamacja with a short reason", async () => {
    const failure = await expectFailure(
      parseCaseRequest(buildMultipart(validFields({ caseType: "reklamacja", reason: "krótko" }), jpegFile()), TODAY),
    );
    expect(failure).toEqual({ status: 400, code: "VALIDATION_FAILED", fields: ["reason"] });
  });

  it("lists several invalid field names unique and in schema order", async () => {
    const failure = await expectFailure(
      parseCaseRequest(
        buildMultipart(validFields({ model: "", purchaseDate: "2026-11-27", caseType: "nieznany" }), jpegFile()),
        TODAY,
      ),
    );
    expect(failure.code).toBe("VALIDATION_FAILED");
    expect(failure.fields).toEqual(["caseType", "model", "purchaseDate"]);
  });

  it("returns 400 VALIDATION_FAILED when the multipart body cannot be parsed", async () => {
    const request = new Request(URL_CASE, {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=abc" },
      body: "not a multipart body",
    });
    expect(await expectFailure(parseCaseRequest(request, TODAY))).toEqual({
      status: 400,
      code: "VALIDATION_FAILED",
    });
  });
});

describe("failureResponse", () => {
  it("returns the status with a JSON body of error code and fields", async () => {
    const response = failureResponse({ status: 400, code: "VALIDATION_FAILED", fields: ["model"] });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "VALIDATION_FAILED", fields: ["model"] });
  });

  it("omits fields when the failure has none", async () => {
    const response = failureResponse({ status: 413, code: "PAYLOAD_TOO_LARGE" });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "PAYLOAD_TOO_LARGE" });
  });
});
