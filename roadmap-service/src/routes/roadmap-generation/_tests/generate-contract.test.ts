import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

const repoRoot = join(process.cwd(), "..");

describe("roadmap generate contract", () => {
    it("frontend CreateRoadmapModal posts targetYears", () => {
        const source = readFileSync(
            join(repoRoot, "frontend/src/components/career-roadmap/CreateRoadmapModal.tsx"),
            "utf8"
        );
        assert.match(source, /targetYears/);
        assert.match(source, /JSON\.stringify\(\{\s*userId,\s*dreamJob: dreamJob\.trim\(\),\s*targetYears\s*\}\)/);
        assert.doesNotMatch(source, /stageCount/);
    });

    it("chat dream-job roadmap HTTP posts targetYears", () => {
        const source = readFileSync(
            join(
                repoRoot,
                "chat-service/src/chat-flow/stage-2-shortcuts/dream-job/chat.dream-job-roadmap-http.service.ts"
            ),
            "utf8"
        );
        assert.match(source, /targetYears/);
        assert.match(source, /JSON\.stringify\(\{\s*userId,\s*dreamJob,\s*targetYears\s*\}\)/);
        assert.doesNotMatch(source, /stageCount/);
    });
});
