import {
    MARKET_IMPORTANCE_WEIGHTS,
    PRIORITY_WEIGHTS,
    TIMELINE_MULTIPLIERS,
} from "./roadmap-scoring.consts";
import type {
    GapScoreInput,
    MarketImportanceInput,
    PriorityScoreInput,
    TimelineWeeksInput,
} from "./roadmap-scoring.types";

export const computeMarketImportance = (input: MarketImportanceInput): number => {
    const frequency = Math.max(0, input.frequency);
    const requirementStrength = Math.max(0, input.requirementStrength);
    const recency = Math.max(0, input.recency);
    const sourceConfidence = Math.max(0, input.sourceConfidence);
    return (
        frequency * MARKET_IMPORTANCE_WEIGHTS.frequency *
        requirementStrength * MARKET_IMPORTANCE_WEIGHTS.requirementStrength *
        recency * MARKET_IMPORTANCE_WEIGHTS.recency *
        sourceConfidence * MARKET_IMPORTANCE_WEIGHTS.sourceConfidence
    );
};

export const computeGapScore = (input: GapScoreInput): number =>
    Math.max(input.requiredLevel - input.currentLevel, 0);

export const computePriorityScore = (input: PriorityScoreInput): number =>
    input.gapScore * PRIORITY_WEIGHTS.gapScore *
    input.marketImportance * PRIORITY_WEIGHTS.marketImportance *
    input.transitionRelevance * PRIORITY_WEIGHTS.transitionRelevance *
    input.dependencyWeight * PRIORITY_WEIGHTS.dependencyWeight *
    input.confidence * PRIORITY_WEIGHTS.confidence;

export const computeBaseWeeks = (input: TimelineWeeksInput): number => {
    const hoursPerWeek = Math.max(1, input.hoursPerWeek);
    const effortHours = Math.max(0, input.effortHours);
    const base = effortHours / hoursPerWeek;
    const dependencyOverhead = input.dependencyOverhead ?? TIMELINE_MULTIPLIERS.dependencyOverhead;
    const parallelizationDiscount = input.parallelizationDiscount ?? TIMELINE_MULTIPLIERS.parallelizationDiscount;
    const buffer = input.buffer ?? TIMELINE_MULTIPLIERS.buffer;
    return base * dependencyOverhead * parallelizationDiscount * buffer;
};

export const formatWeeksAsTimeframe = (weeks: number): string => {
    if (weeks < 4) {
        const roundedWeeks = Math.max(1, Math.round(weeks));
        return roundedWeeks === 1 ? "1 week" : `${roundedWeeks} weeks`;
    }
    if (weeks >= 52) {
        const years = weeks / 52;
        const roundedYears = Math.round(years * 2) / 2;
        if (roundedYears === 1) return "about 1 year";
        if (Number.isInteger(roundedYears)) return `about ${roundedYears} years`;
        return `about ${roundedYears} years`;
    }
    const months = Math.max(1, Math.round(weeks / 4.345));
    return months === 1 ? "1 month" : `${months} months`;
};

export const formatMonthRangeAsTimeframe = (minMonths: number, maxMonths: number): string => {
    const min = Math.max(1, Math.round(minMonths));
    const max = Math.max(min, Math.round(maxMonths));
    if (min >= 12 || max >= 12) {
        const minYears = Math.round((min / 12) * 2) / 2;
        const maxYears = Math.round((max / 12) * 2) / 2;
        if (minYears === maxYears) {
            return minYears === 1 ? "about 1 year" : `about ${minYears} years`;
        }
        return `${minYears}–${maxYears} years`;
    }
    if (min === max) return min === 1 ? "1 month" : `${min} months`;
    return `${min}–${max} months`;
};
