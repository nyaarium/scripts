import { describe, expect, it } from "bun:test";
import { gitPull, parsePullOutput } from "./gitPull.ts";

describe("parsePullOutput", () => {
	it("parses already up to date", () => {
		const result = parsePullOutput("Already up to date.", "", 0);
		expect(result.success).toBe(true);
		expect(result.alreadyUpToDate).toBe(true);
		expect(result.filesChanged).toBe(0);
		expect(result.files).toEqual([]);
		expect(result.conflicts).toEqual([]);
	});

	it("parses fast-forward merge", () => {
		const stdout = [
			"Updating abc1234..def5678",
			"Fast-forward",
			" src/file.ts | 10 ++++------",
			" src/other.ts | 3 +++",
			" 2 files changed, 7 insertions(+), 6 deletions(-)",
		].join("\n");
		const result = parsePullOutput(stdout, "", 0);
		expect(result.success).toBe(true);
		expect(result.alreadyUpToDate).toBe(false);
		expect(result.mergeStrategy).toBe("fast-forward");
		expect(result.fromRef).toBe("abc1234");
		expect(result.toRef).toBe("def5678");
		expect(result.filesChanged).toBe(2);
		expect(result.insertions).toBe(7);
		expect(result.deletions).toBe(6);
	});

	it("parses per-file changes", () => {
		const stdout = [
			"Updating abc1234..def5678",
			"Fast-forward",
			" src/file.ts   | 10 ++++------",
			" src/other.ts  | 3 +++",
			" 2 files changed, 7 insertions(+), 6 deletions(-)",
		].join("\n");
		const result = parsePullOutput(stdout, "", 0);
		expect(result.files).toHaveLength(2);
		expect(result.files[0]).toEqual({ path: "src/file.ts", insertions: 4, deletions: 6 });
		expect(result.files[1]).toEqual({ path: "src/other.ts", insertions: 3, deletions: 0 });
	});

	it("parses ort merge strategy", () => {
		const stdout = "Merge made by the 'ort' strategy.\n 1 file changed, 1 insertion(+)";
		const result = parsePullOutput(stdout, "", 0);
		expect(result.mergeStrategy).toBe("ort");
		expect(result.filesChanged).toBe(1);
		expect(result.insertions).toBe(1);
	});

	it("parses merge conflicts", () => {
		const stderr = [
			"CONFLICT (content): Merge conflict in src/file.ts",
			"CONFLICT (content): Merge conflict in src/other.ts",
			"Automatic merge failed; fix conflicts and then commit the result.",
		].join("\n");
		const result = parsePullOutput("", stderr, 1);
		expect(result.success).toBe(false);
		expect(result.conflicts).toEqual(["src/file.ts", "src/other.ts"]);
	});

	it("parses insertions-only stat line", () => {
		const stdout = " 1 file changed, 5 insertions(+)";
		const result = parsePullOutput(stdout, "", 0);
		expect(result.filesChanged).toBe(1);
		expect(result.insertions).toBe(5);
		expect(result.deletions).toBe(0);
	});

	it("parses deletions-only stat line", () => {
		const stdout = " 1 file changed, 3 deletions(-)";
		const result = parsePullOutput(stdout, "", 0);
		expect(result.filesChanged).toBe(1);
		expect(result.insertions).toBe(0);
		expect(result.deletions).toBe(3);
	});

	it("handles non-zero exit with no conflicts", () => {
		const result = parsePullOutput("", "fatal: not a git repository", 128);
		expect(result.success).toBe(false);
		expect(result.conflicts).toEqual([]);
	});

	it("handles empty output", () => {
		const result = parsePullOutput("", "", 0);
		expect(result.success).toBe(true);
		expect(result.alreadyUpToDate).toBe(false);
		expect(result.filesChanged).toBe(0);
	});
});

describe("gitPull schema", () => {
	const schema = gitPull.schema;

	it("accepts empty input", () => {
		expect(schema.safeParse({}).success).toBe(true);
	});

	it("accepts repo parameter", () => {
		expect(schema.safeParse({ repo: "owner/repo" }).success).toBe(true);
	});
});
