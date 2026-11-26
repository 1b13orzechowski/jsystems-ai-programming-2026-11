// PRD 9.1, AC-07 (type and size messages), AC-08 (thumbnail, file name, remove revokes the object URL), ADR-004 §3.5.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoPicker } from "@/components/case-form/photo-picker";
import type { SelectedPhoto } from "@/components/case-form/types";
import { COPY } from "@/lib/domain/copy-pl";

vi.mock("@/lib/image/downscale", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image/downscale")>()),
  downscaleImage: vi.fn(),
}));

import { downscaleImage } from "@/lib/image/downscale";

const MB = 1024 * 1024;

function fileOf(name: string, type: string, size = 3): File {
  const file = new File([new Uint8Array(size)], name, { type });
  return file;
}

function oversized(name: string, type: string, size: number): File {
  const file = fileOf(name, type);
  Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeEach(() => {
  vi.mocked(downscaleImage).mockReset();
  URL.createObjectURL = vi.fn(() => "blob:preview-1");
  URL.revokeObjectURL = vi.fn();
});

function renderPicker(value: SelectedPhoto | null = null, onChange = vi.fn<(photo: SelectedPhoto | null) => void>()) {
  render(
    <PhotoPicker
      value={value}
      onChange={onChange}
      disabled={false}
      caseType="zwrot"
      error={undefined}
      describedById="photo-error"
    />,
  );
  return onChange;
}

function selectFile(file: File) {
  fireEvent.change(screen.getByTestId("photo-input"), { target: { files: [file] } });
}

describe("PhotoPicker validation (AC-07)", () => {
  it("rejects a GIF with the format message and shows no thumbnail", async () => {
    const onChange = renderPicker();
    selectFile(fileOf("anim.gif", "image/gif"));

    expect(await screen.findByText(COPY.form.errors.photoFormat, { exact: true })).toBeVisible();
    expect(screen.queryByRole("img", { name: COPY.form.photoThumbnailAlt })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(downscaleImage).not.toHaveBeenCalled();
  });

  it("rejects an 11 MB JPEG with the size message and shows no thumbnail", async () => {
    const onChange = renderPicker();
    selectFile(oversized("big.jpg", "image/jpeg", 11 * MB));

    expect(await screen.findByText(COPY.form.errors.photoSize, { exact: true })).toBeVisible();
    expect(screen.queryByRole("img", { name: COPY.form.photoThumbnailAlt })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows the unreadable message and keeps no file when downscaling fails", async () => {
    vi.mocked(downscaleImage).mockResolvedValue({
      ok: false,
      error: "decode",
      message: COPY.form.errors.photoUnreadable,
    });
    const onChange = renderPicker();
    selectFile(fileOf("broken.png", "image/png"));

    expect(await screen.findByText(COPY.form.errors.photoUnreadable, { exact: true })).toBeVisible();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("PhotoPicker valid photo (AC-08)", () => {
  it("shows the thumbnail, the file name and remove, and passes the downscaled JPEG up", async () => {
    vi.mocked(downscaleImage).mockResolvedValue({
      ok: true,
      blob: new Blob([new Uint8Array([9])], { type: "image/jpeg" }),
      width: 10,
      height: 10,
    });
    const onChange = renderPicker();
    selectFile(fileOf("phone-1.jpg", "image/jpeg", 5));

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    const photo = onChange.mock.calls[0]?.[0];
    expect(photo?.name).toBe("phone-1.jpg");
    expect(photo?.previewUrl).toBe("blob:preview-1");
    expect(photo?.jpegBlob.type).toBe("image/jpeg");
  });

  it("renders thumbnail, name and remove, and remove revokes the object URL", async () => {
    const user = userEvent.setup();
    const photo: SelectedPhoto = {
      originalFile: fileOf("phone-1.jpg", "image/jpeg"),
      previewUrl: "blob:preview-1",
      jpegBlob: new Blob([new Uint8Array([9])], { type: "image/jpeg" }),
      name: "phone-1.jpg",
    };
    const onChange = renderPicker(photo);

    expect(screen.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toHaveAttribute("src", "blob:preview-1");
    expect(screen.getByText("phone-1.jpg")).toBeVisible();

    await user.click(screen.getByRole("button", { name: COPY.form.photoRemove }));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});

describe("PhotoPicker input contract", () => {
  it("has a visually hidden file input limited to the three accepted types", () => {
    renderPicker();
    const input = screen.getByTestId("photo-input");
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(input).toHaveClass("sr-only");
  });
});
