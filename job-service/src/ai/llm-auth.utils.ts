// The college LLM gateway (nginx) requires HTTP Basic Auth on every request.
// Set LLM_BASIC_AUTH="user:password" to enable; leave unset for local Ollama.
export const buildLlmAuthHeaders = (): Record<string, string> => {
    const basic = process.env.LLM_BASIC_AUTH?.trim();
    return basic ? { Authorization: `Basic ${Buffer.from(basic).toString("base64")}` } : {};
};
