import { describe, expect, it } from "bun:test";
import { resolveRepoCwd } from "./resolveRepoCwd.ts";

describe("resolveRepoCwd", () => {
	const mcpCwd = "/workspace/nyaascripts";

	it("returns mcpCwd when repo is undefined", () => {
		expect(resolveRepoCwd(mcpCwd)).toBe(mcpCwd);
	});

	it("returns mcpCwd when repo is empty string", () => {
		// Empty string is falsy, so treated same as undefined
		expect(resolveRepoCwd(mcpCwd, "")).toBe(mcpCwd);
	});

	it("uses absolute path directly when it has .git", () => {
		// This repo itself is a valid git repo
		expect(resolveRepoCwd(mcpCwd, "/workspace/nyaascripts")).toBe("/workspace/nyaascripts");
	});

	it("throws for absolute path without .git", () => {
		expect(() => resolveRepoCwd(mcpCwd, "/tmp")).toThrow("Not a git repository: /tmp");
	});

	it("finds sibling repo by OWNER/REPO format", () => {
		// "nyaarium/nyaascripts" should resolve via sibling search to /workspace/nyaascripts
		const result = resolveRepoCwd("/workspace/some-other-project", "nyaarium/nyaascripts");
		expect(result).toBe("/workspace/nyaascripts");
	});

	it("finds repo in /workspace by OWNER/REPO format", () => {
		const result = resolveRepoCwd("/some/other/path", "nyaarium/nyaascripts");
		expect(result).toBe("/workspace/nyaascripts");
	});

	it("throws when repo cannot be found", () => {
		expect(() => resolveRepoCwd(mcpCwd, "nonexistent/repo-that-does-not-exist-anywhere")).toThrow(
			"Could not find local git repository",
		);
	});

	it("handles bare repo name without owner", () => {
		const result = resolveRepoCwd("/workspace/other", "nyaascripts");
		expect(result).toBe("/workspace/nyaascripts");
	});
});
