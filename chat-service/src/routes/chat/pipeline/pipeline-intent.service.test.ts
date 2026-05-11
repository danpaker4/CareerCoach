import { describe, expect, it } from "vitest";
import { PipelineIntentService } from "./pipeline-intent.service";

describe("PipelineIntentService", () => {
    const service = new PipelineIntentService();

    it("detects PIPELINE_ACCEPT phrases", () => {
        expect(service.detect("yes")).toBe("PIPELINE_ACCEPT");
        expect(service.detect("Yes, add it")).toBe("PIPELINE_ACCEPT");
        expect(service.detect("add to pipeline")).toBe("PIPELINE_ACCEPT");
        expect(service.detect("sounds good")).toBe("PIPELINE_ACCEPT");
        expect(service.detect("let's do it")).toBe("PIPELINE_ACCEPT");
        expect(service.detect("move forward")).toBe("PIPELINE_ACCEPT");
        expect(service.detect("i want to apply")).toBe("PIPELINE_ACCEPT");
    });

    it("detects PIPELINE_REJECT phrases", () => {
        expect(service.detect("no")).toBe("PIPELINE_REJECT");
        expect(service.detect("nope")).toBe("PIPELINE_REJECT");
        expect(service.detect("not this one")).toBe("PIPELINE_REJECT");
        expect(service.detect("show me something else")).toBe("PIPELINE_REJECT");
        expect(service.detect("skip")).toBe("PIPELINE_REJECT");
        expect(service.detect("next")).toBe("PIPELINE_REJECT");
        expect(service.detect("different job")).toBe("PIPELINE_REJECT");
        expect(service.detect("no thanks")).toBe("PIPELINE_REJECT");
    });

    it("does not treat no idea as pipeline reject", () => {
        expect(service.detect("no idea")).toBe(null);
        expect(service.detect("I have no idea what I want")).toBe(null);
    });

    it("does not treat no problem as pipeline reject", () => {
        expect(service.detect("no problem")).toBe(null);
    });
});
