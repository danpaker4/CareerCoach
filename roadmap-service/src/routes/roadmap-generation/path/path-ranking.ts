import type { CareerPathSummary } from "../../external/roadmap.external.service";
import type { PathCandidate, RankedPath, SelectedPathResult } from "./path-ranking.types";

const scorePath = (candidate: PathCandidate, currentJob: string, dreamJob: string): RankedPath => {
    const fromMatch =
        candidate.fromRole.toLowerCase().includes(currentJob.toLowerCase()) ||
        currentJob.toLowerCase().includes(candidate.fromRole.toLowerCase())
            ? 1
            : 0.4;
    const toMatch =
        candidate.toRole.toLowerCase().includes(dreamJob.toLowerCase()) ||
        dreamJob.toLowerCase().includes(candidate.toRole.toLowerCase())
            ? 1
            : 0.5;
    const sourceBoost =
        candidate.source === "known_transition" ? 1 : candidate.source === "direction_hint" ? 0.7 : 0.55;
    const skillCoverage = Math.min(1, candidate.requiredSkills.length / 8);
    const rankScore =
        candidate.overlapScore * 0.45 + fromMatch * 0.2 + toMatch * 0.2 + sourceBoost * 0.1 + skillCoverage * 0.05;

    const reasonCodes = [
        "path_ranked",
        candidate.source,
        ...(fromMatch === 1 ? ["from_role_match"] : ["from_role_partial"]),
        ...(toMatch === 1 ? ["to_role_match"] : ["to_role_partial"]),
    ];

    return { path: candidate, rankScore, reasonCodes };
};

export const rankCareerPaths = (params: {
    readonly currentJob: string;
    readonly dreamJob: string;
    readonly knownPaths: readonly CareerPathSummary[];
    readonly directionSkills?: readonly string[];
}): SelectedPathResult => {
    const candidates: PathCandidate[] = params.knownPaths.map((path) => ({
        fromRole: path.fromRole,
        toRole: path.toRole,
        requiredSkills: path.requiredSkills,
        overlapScore: path.overlapScore,
        source: "known_transition" as const,
    }));

    if (params.directionSkills && params.directionSkills.length > 0) {
        candidates.push({
            fromRole: params.currentJob,
            toRole: params.dreamJob,
            requiredSkills: params.directionSkills,
            overlapScore: 0.35,
            source: "direction_hint",
        });
    }

    if (candidates.length === 0) {
        const direct: PathCandidate = {
            fromRole: params.currentJob,
            toRole: params.dreamJob,
            requiredSkills: [],
            overlapScore: 0.2,
            source: "direct",
        };
        const ranked = scorePath(direct, params.currentJob, params.dreamJob);
        return {
            selected: {
                ...ranked,
                reasonCodes: [...ranked.reasonCodes, "no_intermediate_path"],
            },
            candidates: [ranked],
        };
    }

    const ranked = candidates
        .map((candidate) => scorePath(candidate, params.currentJob, params.dreamJob))
        .sort((a, b) => b.rankScore - a.rankScore);

    const selected = ranked[0];
    if (!selected) {
        throw new Error("Expected at least one ranked path");
    }

    return { selected, candidates: ranked };
};
