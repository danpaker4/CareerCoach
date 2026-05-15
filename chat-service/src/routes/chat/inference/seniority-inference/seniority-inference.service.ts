import type { SeniorityInferenceResult } from "./seniority-inference.types";
import { inferRoleExperienceFromMessage } from "./seniority-inference.utils";

export class SeniorityInferenceService {
    inferFromMessage = (message: string): SeniorityInferenceResult => ({
        entries: inferRoleExperienceFromMessage(message),
    });
}
