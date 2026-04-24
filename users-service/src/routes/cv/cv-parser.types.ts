export type PdfTextParser = {
  getText: () => Promise<{ text?: string }>;
  destroy?: () => Promise<void> | void;
};
