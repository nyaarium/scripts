import { describe, expect, it } from "bun:test";
import { parseOwnerRepoFromRemote, slugifyBranchName } from "./gitPushNewBranch.ts";

describe("slugifyBranchName", () => {
	it("converts spaces to hyphens", () => {
		expect(slugifyBranchName("my new feature")).toBe("my-new-feature");
	});

	it("converts to lowercase", () => {
		expect(slugifyBranchName("My New Feature")).toBe("my-new-feature");
	});

	it("replaces non-alphanumeric characters with hyphens", () => {
		expect(slugifyBranchName("fix: bug #123!")).toBe("fix-bug-123");
	});

	it("collapses multiple consecutive non-alphanumeric chars", () => {
		expect(slugifyBranchName("hello---world")).toBe("hello-world");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugifyBranchName("--hello--")).toBe("hello");
	});

	it("handles already-valid branch names", () => {
		expect(slugifyBranchName("fix-typo")).toBe("fix-typo");
	});

	it("handles single word", () => {
		expect(slugifyBranchName("hotfix")).toBe("hotfix");
	});

	it("handles empty string", () => {
		expect(slugifyBranchName("")).toBe("");
	});

	it("handles special characters", () => {
		expect(slugifyBranchName("feat(auth): add OAuth2.0 support")).toBe("feat-auth-add-oauth2-0-support");
	});

	it("handles mixed case with numbers", () => {
		expect(slugifyBranchName("JIRA-1234 Fix Login")).toBe("jira-1234-fix-login");
	});
});

describe("parseOwnerRepoFromRemote", () => {
	it("parses SSH remote URL", () => {
		expect(parseOwnerRepoFromRemote("git@github.com:octocat/hello-world.git")).toBe("octocat/hello-world");
	});

	it("parses SSH remote URL without .git suffix", () => {
		expect(parseOwnerRepoFromRemote("git@github.com:octocat/hello-world")).toBe("octocat/hello-world");
	});

	it("parses HTTPS remote URL", () => {
		expect(parseOwnerRepoFromRemote("https://github.com/octocat/hello-world.git")).toBe("octocat/hello-world");
	});

	it("parses HTTPS remote URL without .git suffix", () => {
		expect(parseOwnerRepoFromRemote("https://github.com/octocat/hello-world")).toBe("octocat/hello-world");
	});

	it("throws for invalid remote URL", () => {
		expect(() => parseOwnerRepoFromRemote("not-a-url")).toThrow("Could not parse OWNER/REPO");
	});
});

describe("gitPushNewBranch schema", () => {
	const { gitPushNewBranch } = require("./gitPushNewBranch.ts");
	const schema = gitPushNewBranch.schema;

	it("accepts minimal valid input", () => {
		const result = schema.safeParse({ branchName: "my-feature" });
		expect(result.success).toBe(true);
	});

	it("accepts full valid input", () => {
		const result = schema.safeParse({
			branchName: "my-feature",
			prTitle: "Add feature",
			createPr: true,
			autoMerge: true,
			dryRun: false,
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing branchName", () => {
		const result = schema.safeParse({});
		expect(result.success).toBe(false);
	});

	it("defaults createPr to false", () => {
		const result = schema.safeParse({ branchName: "my-feature" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.createPr).toBe(false);
	});

	it("defaults autoMerge to false", () => {
		const result = schema.safeParse({ branchName: "my-feature" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.autoMerge).toBe(false);
	});

	it("defaults dryRun to false", () => {
		const result = schema.safeParse({ branchName: "my-feature" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.dryRun).toBe(false);
	});

	it("accepts repoPath parameter", () => {
		const result = schema.safeParse({ branchName: "my-feature", repoPath: "/workspace/nyaascripts" });
		expect(result.success).toBe(true);
	});
});
