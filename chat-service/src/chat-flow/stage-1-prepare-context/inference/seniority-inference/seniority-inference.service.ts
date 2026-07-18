import type { SeniorityInferenceResult } from "./seniority-inference.types";
import { inferRoleExperienceFromMessage } from "./seniority-inference.utils";

export const inferSeniorityFromMessage = (message: string): SeniorityInferenceResult => ({
    entries: inferRoleExperienceFromMessage(message),
});
