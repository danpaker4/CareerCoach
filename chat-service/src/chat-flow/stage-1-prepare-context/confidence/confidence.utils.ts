export const toPercent = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

export const blendPercentScores = (parts: readonly { readonly score: number; readonly weightPercent: number }[]): number =>
    toPercent(parts.reduce((sum, part) => sum + (part.score * part.weightPercent) / 100, 0));
