import { describe, expect, it } from "bun:test";
import { buildCreateArgs, githubCreateIssue } from "./githubCreateIssue.ts";

describe("buildCreateArgs", () => {
	it("builds minimal args", () => {
		const args = buildCreateArgs({ title: "Bug report" });
		expect(args).toEqual(["issue", "create", "--title", "Bug report", "--body", ""]);
	});

	it("includes body", () => {
		const args = buildCreateArgs({ title: "Bug", body: "Description" });
		expect(args).toContain("--body");
		expect(args[args.indexOf("--body") + 1]).toBe("Description");
	});

	it("includes repo", () => {
		const args = buildCreateArgs({ title: "Bug", repo: "owner/repo" });
		expect(args).toContain("--repo");
		expect(args[args.indexOf("--repo") + 1]).toBe("owner/repo");
	});

	it("includes labels", () => {
		const args = buildCreateArgs({ title: "Bug", labels: ["bug", "urgent"] });
		const firstLabel = args.indexOf("--label");
		const secondLabel = args.indexOf("--label", firstLabel + 1);
		expect(firstLabel).toBeGreaterThan(-1);
		expect(secondLabel).toBeGreaterThan(-1);
		expect(args[firstLabel + 1]).toBe("bug");
		expect(args[secondLabel + 1]).toBe("urgent");
	});

	it("includes assignees", () => {
		const args = buildCreateArgs({ title: "Bug", assignees: ["alice", "bob"] });
		const firstAssignee = args.indexOf("--assignee");
		const secondAssignee = args.indexOf("--assignee", firstAssignee + 1);
		expect(firstAssignee).toBeGreaterThan(-1);
		expect(secondAssignee).toBeGreaterThan(-1);
		expect(args[firstAssignee + 1]).toBe("alice");
		expect(args[secondAssignee + 1]).toBe("bob");
	});

	it("skips empty labels array", () => {
		const args = buildCreateArgs({ title: "Bug", labels: [] });
		expect(args).not.toContain("--label");
	});

	it("skips empty assignees array", () => {
		const args = buildCreateArgs({ title: "Bug", assignees: [] });
		expect(args).not.toContain("--assignee");
	});
});

describe("githubCreateIssue schema", () => {
	const schema = githubCreateIssue.schema;

	it("requires title", () => {
		expect(schema.safeParse({}).success).toBe(false);
	});

	it("rejects empty title", () => {
		expect(schema.safeParse({ title: "" }).success).toBe(false);
	});

	it("accepts title only", () => {
		expect(schema.safeParse({ title: "Bug" }).success).toBe(true);
	});

	it("defaults dryRun to false", () => {
		const result = schema.safeParse({ title: "Bug" });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.dryRun).toBe(false);
	});

	it("accepts all params", () => {
		const result = schema.safeParse({
			title: "Bug",
			body: "Details",
			labels: ["bug"],
			assignees: ["alice"],
			repo: "owner/repo",
			dryRun: true,
		});
		expect(result.success).toBe(true);
	});
});
