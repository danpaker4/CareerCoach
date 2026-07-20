import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { LiteLlmTextCompletionAdapter } from "../litellm-text-completion.adapter";
import type { LlmTokenUsageRecordInput, LlmTokenUsageRecorder } from "../../../ai/token-usage/token-usage.types";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const createRecorder = (): { readonly recorder: LlmTokenUsageRecorder; readonly records: LlmTokenUsageRecordInput[] } => {
    const records: LlmTokenUsageRecordInput[] = [];
    return {
        records,
        recorder: {
            record: async (input) => {
                records.push(input);
            },
        },
    };
};

const successPayload = {
    choices: [{ message: { content: "hello from litellm" } }],
    usage: {
        prompt_tokens: 3,
        completion_tokens: 5,
        total_tokens: 8,
    },
};

describe("LiteLlmTextCompletionAdapter", () => {
    it("posts an OpenAI-compatible body with Authorization when an API key is set", async () => {
        const { recorder, records } = createRecorder();
        const captured: { url: string; headers: RequestInit["headers"] | undefined; body: string } = {
            url: "",
            headers: undefined,
            body: "",
        };

        globalThis.fetch = (async (url, init) => {
            captured.url = String(url);
            captured.headers = init?.headers;
            captured.body = String(init?.body);
            return new Response(JSON.stringify(successPayload), { status: 200 });
        }) as typeof fetch;

        const adapter = new LiteLlmTextCompletionAdapter(
            "http://127.0.0.1:4000",
            "openai/gpt-4o-mini",
            "proxy-key",
            recorder
        );
        const text = await adapter.complete("ping");

        assert.equal(text, "hello from litellm");
        assert.equal(captured.url, "http://127.0.0.1:4000/chat/completions");
        assert.match(JSON.stringify(captured.headers), /Bearer proxy-key/);
        assert.deepEqual(JSON.parse(captured.body), {
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: "ping" }],
            temperature: 0.3,
        });
        assert.equal(records.length, 1);
        assert.equal(records[0]?.provider, "litellm");
        assert.equal(records[0]?.requestStatus, "success");
        assert.deepEqual(records[0]?.usage, {
            promptTokens: 3,
            completionTokens: 5,
            totalTokens: 8,
        });
    });

    it("omits Authorization when no API key is configured", async () => {
        const captured: { headers: RequestInit["headers"] | undefined } = { headers: undefined };

        globalThis.fetch = (async (_url, init) => {
            captured.headers = init?.headers;
            return new Response(JSON.stringify(successPayload), { status: 200 });
        }) as typeof fetch;

        const adapter = new LiteLlmTextCompletionAdapter("http://127.0.0.1:4000/", "openai/gpt-4o-mini", undefined);
        await adapter.complete("ping");

        assert.equal(JSON.stringify(captured.headers).includes("Authorization"), false);
    });

    it("throws a descriptive error for non-2xx responses and records failure", async () => {
        const { recorder, records } = createRecorder();

        globalThis.fetch = (async () =>
            new Response(JSON.stringify({ error: { message: "model not found" } }), {
                status: 404,
                statusText: "Not Found",
            })) as typeof fetch;

        const adapter = new LiteLlmTextCompletionAdapter(
            "http://127.0.0.1:4000",
            "openai/gpt-4o-mini",
            "proxy-key",
            recorder
        );

        await assert.rejects(() => adapter.complete("ping"), /LiteLLM completion failed/);
        assert.equal(records[0]?.requestStatus, "error");
        assert.match(records[0]?.errorMessage ?? "", /LiteLLM completion failed/);
    });

    it("throws for invalid response shape", async () => {
        globalThis.fetch = (async () =>
            new Response(JSON.stringify({ not: "valid" }), { status: 200 })) as typeof fetch;

        const adapter = new LiteLlmTextCompletionAdapter("http://127.0.0.1:4000", "openai/gpt-4o-mini", undefined);
        await assert.rejects(() => adapter.complete("ping"), /invalid response shape/);
    });

    it("throws for empty completions", async () => {
        globalThis.fetch = (async () =>
            new Response(
                JSON.stringify({ choices: [{ message: { content: "   " } }] }),
                { status: 200 }
            )) as typeof fetch;

        const adapter = new LiteLlmTextCompletionAdapter("http://127.0.0.1:4000", "openai/gpt-4o-mini", undefined);
        await assert.rejects(() => adapter.complete("ping"), /empty completion/);
    });
});
