import {
    MAX_STAGE_COUNT,
    MIN_STAGE_COUNT,
    TARGET_MONTHS_PER_STAGE,
} from "./roadmap-generation.consts";

export const resolveStageCountFromTargetYears = (targetYears: number): number => {
    const targetMonths = targetYears * 12;
    const rawCount = Math.ceil(targetMonths / TARGET_MONTHS_PER_STAGE);
    return Math.min(MAX_STAGE_COUNT, Math.max(MIN_STAGE_COUNT, rawCount));
};

export const formatTargetTimelineLabel = (targetYears: number): string =>
    targetYears === 1 ? "1 year" : `${targetYears} years`;
