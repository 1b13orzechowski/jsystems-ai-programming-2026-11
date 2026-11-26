// PRD 9.1, AC-01…AC-06, AC-09, AC-13 (restore): the case form validates with the shared Zod schema.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseForm } from "@/components/case-form/case-form";
import {
  EMPTY_CASE_FORM_VALUES,
  type CaseFormValues,
  type CaseSubmission,
  type SelectedPhoto,
} from "@/components/case-form/types";
import { COPY } from "@/lib/domain/copy-pl";
import { todayInTimeZone } from "@/lib/domain/policy-window";

vi.mock("@/lib/image/downscale", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/image/downscale")>()),
  downscaleImage: vi.fn(),
}));

import { downscaleImage } from "@/lib/image/downscale";

const WARSAW = "Europe/Warsaw";
const DAY_MS = 24 * 60 * 60 * 1000;

function warsawOffset(days: number): string {
  return todayInTimeZone(new Date(Date.now() + days * DAY_MS), WARSAW);
}

function makePhoto(name = "phone-1.jpg"): SelectedPhoto {
  return {
    originalFile: new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" }),
    previewUrl: "blob:preview-1",
    jpegBlob: new Blob([new Uint8Array([9])], { type: "image/jpeg" }),
    name,
  };
}

beforeAll(() => {
  // jsdom lacks the APIs Radix Select and popper use.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  URL.createObjectURL = vi.fn(() => "blob:preview-1");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.mocked(downscaleImage).mockReset();
  vi.mocked(downscaleImage).mockResolvedValue({
    ok: true,
    blob: new Blob([new Uint8Array([9])], { type: "image/jpeg" }),
    width: 10,
    height: 10,
  });
});

function renderForm(
  overrides: { initialValues?: CaseFormValues; initialPhoto?: SelectedPhoto | null; disabled?: boolean } = {},
) {
  const onSubmit = vi.fn<(submission: CaseSubmission) => void>();
  const utils = render(
    <CaseForm
      initialValues={overrides.initialValues ?? EMPTY_CASE_FORM_VALUES}
      initialPhoto={overrides.initialPhoto ?? null}
      disabled={overrides.disabled ?? false}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, ...utils };
}

function pickPhoto(file: File) {
  fireEvent.change(screen.getByTestId("photo-input"), { target: { files: [file] } });
}

async function pickCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("combobox", { name: COPY.form.labels.category }));
  await user.click(screen.getByRole("option", { name }));
}

function setDate(value: string) {
  const input = screen.getByLabelText(COPY.form.labels.purchaseDate);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("CaseForm field order and labels (AC-01, AC-35)", () => {
  it("shows six fields in PRD order with visible labels", () => {
    renderForm();
    const labels = [
      COPY.form.labels.caseType,
      COPY.form.labels.category,
      COPY.form.labels.model,
      COPY.form.labels.purchaseDate,
      COPY.form.labels.reason,
      COPY.form.labels.photo,
    ];
    for (const label of labels) expect(screen.getByText(label, { exact: true })).toBeVisible();
    const text = document.body.textContent ?? "";
    const indexes = labels.map((label) => text.indexOf(label));
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    expect(screen.getByRole("radiogroup", { name: COPY.form.labels.caseType })).toBeInTheDocument();
    expect(screen.getByLabelText(COPY.form.labels.model)).toBeInTheDocument();
    expect(screen.getByLabelText(COPY.form.labels.reason)).toBeInTheDocument();
  });
});

describe("CaseForm required fields (AC-02)", () => {
  it("empty submit shows the required error on five fields, focuses the first and does not submit", async () => {
    const { onSubmit } = renderForm();
    fireEvent.click(screen.getByRole("button", { name: COPY.form.submit }));

    expect(screen.getAllByText(COPY.form.errors.required)).toHaveLength(5);
    expect(onSubmit).not.toHaveBeenCalled();

    const model = screen.getByLabelText(COPY.form.labels.model);
    expect(model).toHaveAttribute("aria-invalid", "true");
    const describedBy = model.getAttribute("aria-describedby") ?? "";
    expect(describedBy).not.toBe("");
    for (const id of describedBy.split(/\s+/)) {
      expect(document.getElementById(id)).toHaveTextContent(COPY.form.errors.required);
    }

    const firstInvalid = document.querySelector('[aria-invalid="true"]');
    expect(firstInvalid).toBe(screen.getByRole("radio", { name: COPY.caseTypes.zwrot }));
    expect(firstInvalid).toHaveFocus();
  });
});

describe("CaseForm reason rules (AC-03, AC-04)", () => {
  it("rejects a complaint reason shorter than 10 non-whitespace characters on submit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole("radio", { name: COPY.caseTypes.reklamacja }));
    await user.type(screen.getByLabelText(COPY.form.labels.reason), "   krótko   ");
    fireEvent.click(screen.getByRole("button", { name: COPY.form.submit }));

    expect(screen.getByText(COPY.form.errors.complaintReason, { exact: true })).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not require a reason for a return", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("radio", { name: COPY.caseTypes.zwrot }));
    await user.type(screen.getByLabelText(COPY.form.labels.model), "Galaxy S30");
    setDate(warsawOffset(-3));
    expect(screen.queryByText(COPY.form.errors.complaintReason)).not.toBeInTheDocument();
    expect(screen.queryByText(COPY.form.errors.required)).not.toBeInTheDocument();
  });
});

describe("CaseForm limits and counter (AC-05)", () => {
  it("stops the model at 100 characters and the reason at 2000 with a 2000/2000 counter", async () => {
    const user = userEvent.setup();
    renderForm();
    const model = screen.getByLabelText(COPY.form.labels.model);
    await user.click(model);
    await user.paste("M".repeat(101));
    expect(model).toHaveValue("M".repeat(100));

    const reason = screen.getByLabelText(COPY.form.labels.reason);
    await user.click(reason);
    await user.paste("a".repeat(2001));
    expect(reason).toHaveValue("a".repeat(2000));
    expect(screen.getByText(COPY.form.reasonCounter(2000, 2000), { exact: true })).toBeVisible();
  });
});

describe("CaseForm purchase date (AC-06)", () => {
  it("shows the future-date error for tomorrow and caps the date input at today", () => {
    renderForm();
    setDate(warsawOffset(1));
    expect(screen.getByText(COPY.form.errors.futureDate, { exact: true })).toBeVisible();
    expect(screen.getByLabelText(COPY.form.labels.purchaseDate)).toHaveAttribute("max", warsawOffset(0));
  });
});

describe("CaseForm submit (valid case)", () => {
  it("calls onSubmit once with the parsed input and the photo", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();
    await user.click(screen.getByRole("radio", { name: COPY.caseTypes.zwrot }));
    await pickCategory(user, "Smartfon");
    await user.type(screen.getByLabelText(COPY.form.labels.model), "  Galaxy S30  ");
    setDate(warsawOffset(-3));
    pickPhoto(new File([new Uint8Array([1])], "phone-1.jpg", { type: "image/jpeg" }));
    await waitFor(() => expect(screen.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: COPY.form.submit }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submission = onSubmit.mock.calls[0]?.[0];
    expect(submission?.input).toEqual({
      caseType: "zwrot",
      category: "Smartfon",
      model: "Galaxy S30",
      purchaseDate: warsawOffset(-3),
      reason: "",
    });
    expect(submission?.photo.name).toBe("phone-1.jpg");
  });
});

describe("CaseForm processing lock (AC-09)", () => {
  it("disables every field and the submit button, and submit does nothing", () => {
    const { onSubmit, container } = renderForm({ disabled: true });
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(screen.getByRole("combobox", { name: COPY.form.labels.category })).toBeDisabled();
    expect(screen.getByLabelText(COPY.form.labels.model)).toBeDisabled();
    expect(screen.getByLabelText(COPY.form.labels.purchaseDate)).toBeDisabled();
    expect(screen.getByLabelText(COPY.form.labels.reason)).toBeDisabled();
    expect(screen.getByRole("button", { name: COPY.form.photoChoose })).toBeDisabled();
    expect(screen.getByRole("button", { name: COPY.form.submit })).toBeDisabled();
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    if (form) fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("CaseForm restore after an error (AC-13)", () => {
  it("shows the values and the photo it is given", () => {
    renderForm({
      initialValues: {
        caseType: "reklamacja",
        category: "Laptop",
        model: "ThinkBook 14",
        purchaseDate: warsawOffset(-30),
        reason: "Ekran migocze od tygodnia",
      },
      initialPhoto: makePhoto("laptop-1.png"),
    });
    expect(screen.getByRole("radio", { name: COPY.caseTypes.reklamacja })).toBeChecked();
    expect(screen.getByRole("combobox", { name: COPY.form.labels.category })).toHaveTextContent("Laptop");
    expect(screen.getByLabelText(COPY.form.labels.model)).toHaveValue("ThinkBook 14");
    expect(screen.getByLabelText(COPY.form.labels.purchaseDate)).toHaveValue(warsawOffset(-30));
    expect(screen.getByLabelText(COPY.form.labels.reason)).toHaveValue("Ekran migocze od tygodnia");
    expect(screen.getByRole("img", { name: COPY.form.photoThumbnailAlt })).toBeVisible();
    expect(screen.getByText("laptop-1.png")).toBeVisible();
  });
});
