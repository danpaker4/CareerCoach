export type PathCandidate = {
    readonly fromRole: string;
    readonly toRole: string;
    readonly requiredSkills: readonly string[];
    readonly overlapScore: number;
    readonly source: "known_transition" | "direction_hint" | "direct";
};

export type RankedPath = {
    readonly path: PathCandidate;
    readonly rankScore: number;
    readonly reasonCodes: readonly string[];
};

export type SelectedPathResult = {
    readonly selected: RankedPath;
    readonly candidates: readonly RankedPath[];
};
