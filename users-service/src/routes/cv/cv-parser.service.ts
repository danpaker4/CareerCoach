import type { PdfParseConstructor, PdfTextParser } from "./cv-parser.types";
import {
  GENERIC_PARSE_ERROR_PREFIX,
  throwIfEmptyBuffer,
  throwIfNotPdf,
  toError,
} from "./cv-parser.utils";

const isPdfParseModule = (value: unknown): value is { PDFParse: PdfParseConstructor } => {
  if (typeof value !== "object" || value === null || !("PDFParse" in value)) {
    return false;
  }

  return typeof value.PDFParse === "function";
};

const loadPdfParseClass = async (): Promise<PdfParseConstructor> => {
  const moduleOrError = await import("pdf-parse").catch((error) => error);
  if (moduleOrError instanceof Error) {
    throw new Error(`${GENERIC_PARSE_ERROR_PREFIX} ${toError(moduleOrError).message}`);
  }

  if (!isPdfParseModule(moduleOrError)) {
    throw new Error("pdf-parse runtime does not expose PDFParse class");
  }

  return moduleOrError.PDFParse;
};

const buildParser = (PDFParse: PdfParseConstructor, fileBuffer: Buffer): PdfTextParser => {
  const parser = new PDFParse({ data: fileBuffer });
  if (!parser) {
    throw new Error("Failed to initialize PDF parser");
  }
  return parser;
};

const readPdfText = async (parser: PdfTextParser): Promise<string> => {
  const parsedOrError = await parser.getText().catch((error) => error);
  if (parsedOrError instanceof Error) {
    throw new Error(`${GENERIC_PARSE_ERROR_PREFIX} ${toError(parsedOrError).message}`);
  }

  const text = parsedOrError.text?.trim() ?? "";
  if (!text) {
    throw new Error("CV text extraction produced empty text");
  }

  return text;
};

const destroyParser = async (parser: PdfTextParser): Promise<void> => {
  if (!parser.destroy) {
    return;
  }
  const destroyResult = parser.destroy();
  if (destroyResult instanceof Promise) {
    await destroyResult.catch(() => undefined);
  }
};

export const extractTextFromCv = async (fileBuffer: Buffer): Promise<string> => {
  throwIfEmptyBuffer(fileBuffer);
  throwIfNotPdf(fileBuffer);

  const PDFParse = await loadPdfParseClass();
  const parser = buildParser(PDFParse, fileBuffer);
  const text = await readPdfText(parser);
  await destroyParser(parser);
  return text;
};
