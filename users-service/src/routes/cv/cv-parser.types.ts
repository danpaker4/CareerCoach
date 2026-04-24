export type PdfTextParser = {
  getText: () => Promise<{ text?: string }>;
  destroy?: () => Promise<void> | void;
};

export type PdfParseConstructor = new (options: { data: Buffer }) => PdfTextParser;
