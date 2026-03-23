import { describe, expect, it } from "bun:test";
import { parseCommitData } from "./githubGitLog.ts";

describe("parseCommitData", () => {
	it("parses a single commit", () => {
		const raw = "abc123|abc1|Alice|alice@example.com|2024-01-01|HEAD -> main|Fix bug{{{EOL}}}";
		const result = parseCommitData(raw);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			hash: "abc123",
			shortHash: "abc1",
			author: "Alice",
			email: "alice@example.com",
			date: "2024-01-01",
			message: "Fix bug",
			refs: ["HEAD -> main"],
		});
	});

	it("parses multiple commits", () => {
		const raw = [
			"aaa|aa|Alice|alice@e.com|2024-01-01||First commit{{{EOL}}}",
			"bbb|bb|Bob|bob@e.com|2024-01-02||Second commit{{{EOL}}}",
		].join("\n");
		const result = parseCommitData(raw);
		expect(result).toHaveLength(2);
		expect(result[0].hash).toBe("aaa");
		expect(result[1].hash).toBe("bbb");
	});

	it("handles commit with no refs", () => {
		const raw = "abc123|abc1|Alice|alice@e.com|2024-01-01||Some message{{{EOL}}}";
		const result = parseCommitData(raw);
		expect(result).toHaveLength(1);
		expect(result[0].refs).toBeUndefined();
	});

	it("handles commit with multiple refs", () => {
		const raw = "abc123|abc1|Alice|alice@e.com|2024-01-01|HEAD -> main, origin/main, tag: v1.0|Msg{{{EOL}}}";
		const result = parseCommitData(raw);
		expect(result[0].refs).toEqual(["HEAD -> main", "origin/main", "tag: v1.0"]);
	});

	it("handles multiline commit message", () => {
		const raw = "abc123|abc1|Alice|alice@e.com|2024-01-01||Title\nBody line 1\nBody line 2{{{EOL}}}";
		const result = parseCommitData(raw);
		expect(result[0].message).toBe("Body line 1\nBody line 2");
	});

	it("handles empty input", () => {
		expect(parseCommitData("")).toEqual([]);
	});

	it("handles message containing pipe characters", () => {
		const raw = "abc123|abc1|Alice|alice@e.com|2024-01-01||Fix|something{{{EOL}}}";
		const result = parseCommitData(raw);
		expect(result).toHaveLength(1);
		expect(result[0].message).toBe("Fix|something");
	});
});

describe("githubGitLog schema", () => {
	const { githubGitLog } = require("./githubGitLog.ts");
	const schema = githubGitLog.schema;

	it("accepts count mode", () => {
		const result = schema.safeParse({ count: 10 });
		expect(result.success).toBe(true);
	});

	it("accepts range mode", () => {
		const result = schema.safeParse({ range: "abc123..def456" });
		expect(result.success).toBe(true);
	});

	it("rejects count below 1", () => {
		expect(schema.safeParse({ count: 0 }).success).toBe(false);
	});

	it("rejects count above 10000", () => {
		expect(schema.safeParse({ count: 10001 }).success).toBe(false);
	});

	it("accepts outputPath", () => {
		const result = schema.safeParse({ count: 5, outputPath: "/tmp/log.json" });
		expect(result.success).toBe(true);
	});

	it("accepts repo parameter", () => {
		const result = schema.safeParse({ count: 5, repo: "owner/repo" });
		expect(result.success).toBe(true);
	});
});
