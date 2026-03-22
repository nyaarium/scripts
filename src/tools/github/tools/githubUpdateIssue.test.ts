import { describe, expect, it } from "bun:test";
import { buildEditArgs, describeChanges, githubUpdateIssue } from "./githubUpdateIssue.ts";

describe("buildEditArgs", () => {
	it("builds minimal args", () => {
		const args = buildEditArgs({ issueId: "42" });
		expect(args).toEqual(["issue", "edit", "42"]);
	});

	it("includes title", () => {
		const args = buildEditArgs({ issueId: "42", title: "New title" });
		expect(args).toContain("--title");
		expect(args[args.indexOf("--title") + 1]).toBe("New title");
	});

	it("includes body", () => {
		const args = buildEditArgs({ issueId: "42", body: "New body" });
		expect(args).toContain("--body");
		expect(args[args.indexOf("--body") + 1]).toBe("New body");
	});

	it("includes repo", () => {
		const args = buildEditArgs({ issueId: "42", repo: "owner/repo" });
		expect(args).toContain("--repo");
	});

	it("includes add-label as comma-separated", () => {
		const args = buildEditArgs({ issueId: "42", addLabels: ["bug", "urgent"] });
		expect(args).toContain("--add-label");
		expect(args[args.indexOf("--add-label") + 1]).toBe("bug,urgent");
	});

	it("includes remove-label as comma-separated", () => {
		const args = buildEditArgs({ issueId: "42", removeLabels: ["wontfix"] });
		expect(args).toContain("--remove-label");
		expect(args[args.indexOf("--remove-label") + 1]).toBe("wontfix");
	});

	it("includes add-assignee as comma-separated", () => {
		const args = buildEditArgs({ issueId: "42", assignees: ["alice", "bob"] });
		expect(args).toContain("--add-assignee");
		expect(args[args.indexOf("--add-assignee") + 1]).toBe("alice,bob");
	});

	it("skips empty arrays", () => {
		const args = buildEditArgs({ issueId: "42", addLabels: [], removeLabels: [], assignees: [] });
		expect(args).toEqual(["issue", "edit", "42"]);
	});
});

describe("describeChanges", () => {
	it("describes close", () => {
		const changes = describeChanges({ issueId: "42", state: "closed" });
		expect(changes).toContain("Would close issue #42");
	});

	it("describes reopen", () => {
		const changes = describeChanges({ issueId: "42", state: "open" });
		expect(changes).toContain("Would reopen issue #42");
	});

	it("describes title update", () => {
		const changes = describeChanges({ issueId: "42", title: "New title" });
		expect(changes).toEqual(['Would update title to: "New title"']);
	});

	it("describes label add and remove", () => {
		const changes = describeChanges({ issueId: "42", addLabels: ["bug"], removeLabels: ["wontfix"] });
		expect(changes).toContain("Would add labels: bug");
		expect(changes).toContain("Would remove labels: wontfix");
	});

	it("describes assignees", () => {
		const changes = describeChanges({ issueId: "42", assignees: ["alice"] });
		expect(changes).toContain("Would assign: alice");
	});

	it("returns no changes when nothing specified", () => {
		const changes = describeChanges({ issueId: "42" });
		expect(changes).toEqual(["No changes specified"]);
	});

	it("combines multiple changes", () => {
		const changes = describeChanges({
			issueId: "42",
			state: "closed",
			title: "Done",
			addLabels: ["resolved"],
		});
		expect(changes).toHaveLength(3);
	});
});

describe("githubUpdateIssue schema", () => {
	const schema = githubUpdateIssue.schema;

	it("requires issueId", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("accepts issueId only", () => {
		expect(schema.safeParse({ issueId: "42" }).success).toBe(true);
	});

	it("accepts valid state values", () => {
		expect(schema.safeParse({ issueId: "42", state: "open" }).success).toBe(true);
		expect(schema.safeParse({ issueId: "42", state: "closed" }).success).toBe(true);
	});

	it("rejects invalid state", () => {
		expect(schema.safeParse({ issueId: "42", state: "pending" }).success).toBe(false);
	});

	it("defaults dryRun to false", () => {
		const result = schema.safeParse({ issueId: "42" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.dryRun).toBe(false);
	});

	it("accepts all params", () => {
		const result = schema.safeParse({
			issueId: "42",
			state: "closed",
			title: "New",
			body: "Updated",
			addLabels: ["bug"],
			removeLabels: ["wontfix"],
			assignees: ["alice"],
			repo: "owner/repo",
			dryRun: true,
		});
		expect(result.success).toBe(true);
	});
});
