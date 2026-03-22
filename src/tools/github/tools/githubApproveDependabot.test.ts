import { describe, expect, it } from "bun:test";
import { filterDependabotPRs } from "./githubApproveDependabot.ts";

const makePR = (overrides: { number?: number; isDraft?: boolean; login?: string; title?: string }) => ({
	number: overrides.number ?? 1,
	isDraft: overrides.isDraft ?? false,
	author: { login: overrides.login ?? "app/dependabot" },
	title: overrides.title ?? "Bump some-package from 1.0.0 to 2.0.0",
});

describe("filterDependabotPRs", () => {
	it("filters out draft PRs", () => {
		const prs = [makePR({ isDraft: true })];
		const result = filterDependabotPRs(prs, { approveOwnLibs: true, approveDistUpdates: true });
		expect(result).toHaveLength(0);
	});

	it("only includes PRs by app/dependabot", () => {
		const prs = [makePR({ login: "some-user" }), makePR({ login: "app/dependabot", number: 2 })];
		const result = filterDependabotPRs(prs, { approveOwnLibs: true, approveDistUpdates: false });
		expect(result).toHaveLength(1);
		expect(result[0].number).toBe(2);
	});

	it("skips own-lib PRs when approveOwnLibs is false", () => {
		const prs = [
			makePR({ number: 1, title: "Bump js-common from 1.0.0 to 2.0.0" }),
			makePR({ number: 2, title: "Bump next-common from 1.0.0 to 2.0.0" }),
			makePR({ number: 3, title: "Bump react-controlled-input from 1.0.0 to 2.0.0" }),
			makePR({ number: 4, title: "Bump react-layout-engine from 1.0.0 to 2.0.0" }),
			makePR({ number: 5, title: "Bump lodash from 1.0.0 to 2.0.0" }),
		];
		const result = filterDependabotPRs(prs, { approveOwnLibs: false, approveDistUpdates: false });
		expect(result).toHaveLength(1);
		expect(result[0].number).toBe(5);
	});

	it("includes own-lib PRs when approveOwnLibs is true", () => {
		const prs = [
			makePR({ number: 1, title: "Bump js-common from 1.0.0 to 2.0.0" }),
			makePR({ number: 2, title: "Bump lodash from 1.0.0 to 2.0.0" }),
		];
		const result = filterDependabotPRs(prs, { approveOwnLibs: true, approveDistUpdates: false });
		expect(result).toHaveLength(2);
	});

	it("includes Update dist/ files PRs when approveDistUpdates is true", () => {
		const prs = [makePR({ login: "github-actions[bot]", title: "Update dist/ files" })];
		const result = filterDependabotPRs(prs, { approveOwnLibs: true, approveDistUpdates: true });
		expect(result).toHaveLength(1);
	});

	it("skips Update dist/ files PRs when approveDistUpdates is false", () => {
		const prs = [makePR({ login: "github-actions[bot]", title: "Update dist/ files" })];
		const result = filterDependabotPRs(prs, { approveOwnLibs: true, approveDistUpdates: false });
		expect(result).toHaveLength(0);
	});

	it("handles empty PR list", () => {
		const result = filterDependabotPRs([], { approveOwnLibs: true, approveDistUpdates: true });
		expect(result).toHaveLength(0);
	});

	it("handles mixed authors and only selects dependabot", () => {
		const prs = [
			makePR({ number: 1, login: "app/dependabot" }),
			makePR({ number: 2, login: "renovate[bot]" }),
			makePR({ number: 3, login: "human-dev" }),
			makePR({ number: 4, login: "app/dependabot" }),
		];
		const result = filterDependabotPRs(prs, { approveOwnLibs: true, approveDistUpdates: false });
		expect(result).toHaveLength(2);
		expect(result.map((p) => p.number)).toEqual([1, 4]);
	});
});
