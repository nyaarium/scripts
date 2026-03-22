import { describe, expect, it } from "bun:test";
import { normalizeCommitMessage } from "./schemas.ts";

describe("normalizeCommitMessage", () => {
	it("returns headline + body for normal commits", () => {
		const result = normalizeCommitMessage("Fix login bug", "Detailed explanation");
		expect(result).toBe("Fix login bug\nDetailed explanation");
	});

	it("returns headline only when body is null", () => {
		const result = normalizeCommitMessage("Quick fix", null);
		expect(result).toBe("Quick fix");
	});

	it("returns headline only when body is empty", () => {
		const result = normalizeCommitMessage("Quick fix", "");
		expect(result).toBe("Quick fix");
	});

	it("returns headline only for Dependabot bump commits", () => {
		const result = normalizeCommitMessage(
			"Bump eslint from 8.0.0 to 9.0.0",
			"Bumps [eslint](https://github.com/eslint/eslint) from 8.0.0 to 9.0.0.\n- [Release notes](...)",
		);
		expect(result).toBe("Bump eslint from 8.0.0 to 9.0.0");
	});

	it("returns headline only for Dependabot group bumps", () => {
		const result = normalizeCommitMessage(
			"Bump the deps group with 3 updates",
			"Bumps the deps group with 3 updates...",
		);
		expect(result).toBe("Bump the deps group with 3 updates");
	});

	it("returns headline only when body references dependabot branch", () => {
		const result = normalizeCommitMessage(
			"Merge pull request #42",
			"from owner/dependabot/npm_and_yarn/eslint-9.0.0",
		);
		expect(result).toBe("Merge pull request #42");
	});

	it("does not strip body for non-Dependabot commits with 'bump' in message", () => {
		const result = normalizeCommitMessage("Bump version to 2.0", "Updated changelog and package.json");
		expect(result).toBe("Bump version to 2.0\nUpdated changelog and package.json");
	});

	it("trims whitespace", () => {
		const result = normalizeCommitMessage("  Fix bug  ", null);
		expect(result).toBe("Fix bug");
	});
});
