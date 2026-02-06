import { z } from "zod";
import {
	approvePR,
	enableAutoMerge,
	getCIStatus,
	getExistingApproval,
	getPRStatus,
	getRepoSettings,
	manualMerge,
} from "../lib/approvePr.js";
import { checkGHCLI } from "../lib/checkGHCLI.js";

export const githubApprovePr = {
	name: "githubApprovePr",
	title: "github-approve-pr",
	description:
		'Approve and optionally merge GitHub pull requests. Supports multiple PR numbers. If a PR has author "app/dependabot" and mergeStateStatus is DIRTY, use github-pr-comment to post "@dependabot recreate" first, then approve/merge. Mutating action.',
	operation: "approving PR(s)",
	schema: z.object({
		repo: z
			.string()
			.optional()
			.describe("When provided, must be full OWNER/REPO. Leave out unless targeting another repo."),
		prNumbers: z.array(z.string()).min(1).describe("Array of PR numbers to approve (e.g. ['123', '456'])."),
		merge: z
			.boolean()
			.optional()
			.default(false)
			.describe("Whether to merge the PR after approval (auto-merge if enabled, manual merge otherwise)."),
	}),
	async handler(cwd, { repo, prNumbers, merge: shouldMerge = false }) {
		const ghStatus = await checkGHCLI(cwd);
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		const results = [];
		const errors = [];
		let repoSettings = null;
		if (shouldMerge) {
			try {
				repoSettings = await getRepoSettings(cwd, repo);
			} catch {
				// proceed without
			}
		}

		for (const prNumber of prNumbers) {
			try {
				let alreadyApproved = false;
				let authWarning = null;
				try {
					alreadyApproved = await getExistingApproval(cwd, repo, prNumber);
				} catch (e) {
					if (e.message?.includes("authenticated") || e.message?.includes("NOT_AUTHENTICATED")) {
						authWarning = "GitHub CLI not authenticated - please run 'gh auth login'";
					}
				}

				let result = alreadyApproved
					? { success: true, prNumber, output: "Already approved", skipped: true }
					: await approvePR(cwd, repo, prNumber);
				if (authWarning) result.authWarning = authWarning;
				results.push(result);

				if (shouldMerge) {
					try {
						const ciStatus = await getCIStatus(cwd, repo, prNumber);
						const prStatus = await getPRStatus(cwd, repo, prNumber);

						let mergeStrategy = null;
						let mergeMessage = "";
						let canProceed = true;

						if (repoSettings?.linearHistory) {
							if (repoSettings.allowAutoMerge) {
								mergeStrategy = "auto-merge";
								mergeMessage = "Linear history required - using auto-merge";
							} else {
								canProceed = false;
								mergeMessage = "Linear history required but auto-merge disabled. Rebase required.";
							}
						} else {
							if (ciStatus.overall === "success") {
								mergeStrategy = repoSettings?.allowAutoMerge ? "auto-merge" : "manual-merge";
								mergeMessage = "All checks passed - proceeding with merge";
							} else if (ciStatus.overall === "pending") {
								if (repoSettings?.allowAutoMerge) {
									mergeStrategy = "auto-merge";
									mergeMessage = `CI still running - auto-merge will complete after: ${ciStatus.stillRunning.map((c) => c.name).join(", ")}`;
								} else {
									canProceed = false;
									mergeMessage = `CI still running - manual merge blocked. Waiting for: ${ciStatus.stillRunning.map((c) => c.name).join(", ")}`;
								}
							} else if (ciStatus.overall === "failure") {
								if (ciStatus.required.length > 0 && repoSettings?.allowAutoMerge) {
									mergeStrategy = "auto-merge";
									mergeMessage = `CI has failures but required checks exist - auto-merge will proceed. Errors: ${ciStatus.errors.map((c) => c.name).join(", ")}`;
								} else {
									canProceed = false;
									mergeMessage = `CI failed - merge blocked. Errors: ${ciStatus.errors.map((c) => c.name).join(", ")}`;
								}
							} else {
								mergeStrategy = repoSettings?.allowAutoMerge ? "auto-merge" : "manual-merge";
								mergeMessage = "No CI checks found - proceeding with merge";
							}
						}

						if (canProceed && mergeStrategy) {
							if (mergeStrategy === "auto-merge") {
								if (repoSettings?.allowMergeCommit) {
									await enableAutoMerge(cwd, "m", repo, prNumber);
								} else if (repoSettings?.allowRebaseMerge) {
									await enableAutoMerge(cwd, "r", repo, prNumber);
								} else if (repoSettings?.allowSquashMerge) {
									await enableAutoMerge(cwd, "s", repo, prNumber);
								} else {
									await manualMerge(cwd, repo, prNumber);
								}
							} else {
								await manualMerge(cwd, repo, prNumber);
							}
							result.mergeResult = {
								strategy: mergeStrategy,
								message: mergeMessage,
								ciStatus,
								prStatus,
							};
						} else {
							result.mergeResult = {
								strategy: "blocked",
								message: mergeMessage,
								ciStatus,
								prStatus,
							};
							errors.push({
								prNumber,
								error: `Merge blocked: ${mergeMessage}`,
								ciStatus,
								prStatus,
							});
						}
					} catch (e) {
						errors.push({ prNumber, error: `Merge validation failed: ${e.message}` });
					}
				}
			} catch (e) {
				errors.push({ prNumber, error: e.message });
			}
		}

		const data = {
			total: prNumbers.length,
			successful: results.length,
			failed: errors.length,
			repositorySettings: shouldMerge ? repoSettings : null,
			results,
			errors,
		};
		return { data };
	},
};
