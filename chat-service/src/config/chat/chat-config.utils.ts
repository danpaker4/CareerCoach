import type { ResolvedLlmConfig } from "../../litellm/config/litellm-config.types";
import type { ChatConfigEnv } from "./chat-config.schema";
import type { ChatConfig } from "./chat-config.types";

export const createChatConfig = (env: ChatConfigEnv, llm: ResolvedLlmConfig): ChatConfig => ({
    usersServiceBaseUrl: env.USERS_SERVICE_BASE_URL,
    jobServiceBaseUrl: env.JOB_SERVICE_BASE_URL,
    roadmapServiceBaseUrl: env.ROADMAP_SERVICE_BASE_URL,
    llm,
    customEmbeddingUrl: env.CUSTOM_EMBEDDING_URL,
    careerDirectionVectorIndexName: env.CAREER_DIRECTION_VECTOR_INDEX_NAME,
    internalServiceApiKey: env.INTERNAL_SERVICE_API_KEY,
});
