import { ObjectId, type Collection } from "mongodb";
import type { BenchmarkCandidateId, BenchmarkManualScore, BenchmarkRunDocument } from "./benchmark.types";

export class BenchmarkRunRepository {
    constructor(private readonly collection: Collection<BenchmarkRunDocument>) { }

    create = async (run: BenchmarkRunDocument): Promise<BenchmarkRunDocument> => {
        const result = await this.collection.insertOne(run);
        return { ...run, _id: result.insertedId };
    };

    list = async (limit: number): Promise<BenchmarkRunDocument[]> =>
        this.collection.find({}).sort({ createdAt: -1 }).limit(limit).toArray();

    findById = async (runId: string): Promise<BenchmarkRunDocument | null> => {
        if (!ObjectId.isValid(runId)) {
            return null;
        }

        return this.collection.findOne({ _id: new ObjectId(runId) });
    };

    updateManualScore = async (
        runId: string,
        candidateId: BenchmarkCandidateId,
        manualScore: BenchmarkManualScore
    ): Promise<BenchmarkRunDocument | null> => {
        if (!ObjectId.isValid(runId)) {
            return null;
        }

        const existing = await this.findById(runId);
        if (!existing) {
            return null;
        }

        const candidateResults = existing.candidateResults.map((candidateResult) => {
            if (candidateResult.candidateId !== candidateId) {
                return candidateResult;
            }

            const manualAverage =
                (manualScore.relevance +
                    manualScore.personalization +
                    manualScore.actionability +
                    manualScore.clarity +
                    manualScore.safety) / 5;
            const manualScorePercent = (manualAverage / 5) * 100;
            return {
                ...candidateResult,
                manualScore,
                overallScore: Math.round(candidateResult.automaticScore * 0.6 + manualScorePercent * 0.4),
                scoreStatus: "manual" as const,
            };
        });

        await this.collection.updateOne(
            { _id: new ObjectId(runId) },
            {
                $set: {
                    candidateResults,
                    updatedAt: new Date(),
                },
            }
        );

        return this.findById(runId);
    };
}
