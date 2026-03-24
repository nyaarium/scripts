import { describe, expect, it } from "bun:test";
import { resolveRepoCwd } from "./resolveRepoCwd.ts";

describe("resolveRepoCwd", () => {
	const mcpCwd = "/workspace/nyaascripts";

	it("returns mcpCwd when repoPath is undefined", () => {
		expect(resolveRepoCwd(mcpCwd)).toBe(mcpCwd);
	});

	it("returns mcpCwd when repoPath is empty string", () => {
		expect(resolveRepoCwd(mcpCwd, "")).toBe(mcpCwd);
	});

	it("uses absolute path directly when it has .git", () => {
		expect(resolveRepoCwd(mcpCwd, "/workspace/nyaascripts")).toBe("/workspace/nyaascripts");
	});

	it("throws for absolute path without .git", () => {
		expect(() => resolveRepoCwd(mcpCwd, "/tmp")).toThrow("Not a git repository: /tmp");
	});

	it("throws for non-absolute path", () => {
		expect(() => resolveRepoCwd(mcpCwd, "owner/repo")).toThrow("repoPath must be an absolute path");
	});

	it("throws for bare name", () => {
		expect(() => resolveRepoCwd(mcpCwd, "some-repo")).toThrow("repoPath must be an absolute path");
	});
});
