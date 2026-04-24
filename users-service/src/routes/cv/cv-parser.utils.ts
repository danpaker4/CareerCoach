export const PDF_SIGNATURE = "%PDF-";
export const GENERIC_PARSE_ERROR_PREFIX = "Failed to parse CV PDF content:";

export const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
};

export const throwIfEmptyBuffer = (fileBuffer: Buffer): void => {
  if (fileBuffer.length === 0) {
    throw new Error("CV file is empty");
  }
};

export const throwIfNotPdf = (fileBuffer: Buffer): void => {
  if (fileBuffer.subarray(0, PDF_SIGNATURE.length).toString() !== PDF_SIGNATURE) {
    throw new Error("Uploaded file is not a valid PDF");
  }
};
