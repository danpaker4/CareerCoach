import { ObjectId, type Collection } from "mongodb";
import type { BenchmarkRunDocument } from "./benchmark.types";

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
}
