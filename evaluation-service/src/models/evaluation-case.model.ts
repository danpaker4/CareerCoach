import mongoose, { Schema, model } from "mongoose";
import { CONVERSATION_MODES } from "../evaluation-case.mode.consts";
import type { EvaluationExpected, EvaluationMessage } from "../schemas/evaluation-case.schema";

export type EvaluationCaseDocument = {
    id: string;
    messages: EvaluationMessage[];
    expected: EvaluationExpected;
    createdAt: Date;
    updatedAt: Date;
};

const evaluationMessageSchema = new Schema<EvaluationMessage>(
    {
        role: { type: String, enum: ["user", "assistant", "system"], required: true },
        content: { type: String, required: true },
    },
    { _id: false },
);

const evaluationExpectedSchema = new Schema<EvaluationExpected>(
    {
        mode: { type: String, enum: CONVERSATION_MODES, required: false },
        maxLines: { type: Number, required: false },
        mustAskQuestion: { type: Boolean, required: false },
        forbiddenWords: { type: [String], required: false },
    },
    { _id: false },
);

const evaluationCaseSchema = new Schema<EvaluationCaseDocument>(
    {
        id: { type: String, required: true, unique: true },
        messages: { type: [evaluationMessageSchema], required: true },
        expected: { type: evaluationExpectedSchema, required: true },
    },
    {
        timestamps: true,
        collection: "evaluation_cases",
    },
);

const EVALUATION_CASE_MODEL_NAME = "EvaluationCase";

if (mongoose.models[EVALUATION_CASE_MODEL_NAME]) {
    mongoose.deleteModel(EVALUATION_CASE_MODEL_NAME);
}

export const EvaluationCaseModel = model<EvaluationCaseDocument>(EVALUATION_CASE_MODEL_NAME, evaluationCaseSchema);

export const connectMongo = async (connectionString: string): Promise<void> => {
    await mongoose.connect(connectionString);
};

export const disconnectMongo = async (): Promise<void> => {
    await mongoose.disconnect();
};
