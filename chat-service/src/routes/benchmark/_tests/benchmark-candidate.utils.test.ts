import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ServerConfig } from "../../../server.types";
import { resolveCandidateConfig } from "../benchmark-candidate.utils";

const chatConfig: ServerConfig["chatConfig"] = {
    usersServiceBaseUrl: "http://127.0.0.1:3001",
    jobServiceBaseUrl: "http://127.0.0.1:3003",
    roadmapServiceBaseUrl: "http://127.0.0.1:3004",
    llm: {
        provider: "litellm",
        endpointUrl: "https://remote-litellm.example.com/v1",
        apiKey: "proxy-key",
        model: "remote-primary-model",
    },
    benchmarkModels: {
        ollamaLlama: "remote-llama-model",
        gemini: "remote-gemini-model",
    },
    careerDirectionVectorIndexName: "career_direction_vector_index",
};

describe("resolveCandidateConfig", () => {
    it("uses deployment-configured model names instead of local LiteLLM aliases", () => {
        assert.equal(resolveCandidateConfig("ollama-llama", chatConfig).model, "remote-llama-model");
        assert.equal(resolveCandidateConfig("gemini", chatConfig).model, "remote-gemini-model");
    });
});
