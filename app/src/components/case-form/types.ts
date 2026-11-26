// Client-side form contracts (ADR-004 §4). The server contract lives in `@/lib/domain/schemas`.
import type { CaseInput } from "@/lib/domain/schemas";

export type SelectedPhoto = {
  originalFile: File;
  previewUrl: string;
  jpegBlob: Blob;
  name: string;
};

export type CaseFormValues = {
  caseType: string;
  category: string;
  model: string;
  purchaseDate: string;
  reason: string;
};

export const EMPTY_CASE_FORM_VALUES: CaseFormValues = {
  caseType: "",
  category: "",
  model: "",
  purchaseDate: "",
  reason: "",
};

export type CaseSubmission = {
  input: CaseInput;
  photo: SelectedPhoto;
};
