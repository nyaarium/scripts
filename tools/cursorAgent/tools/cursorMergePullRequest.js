import { checkGHCLI } from "../../github/lib/checkGHCLI.js";
import { extractRepoFromURL } from "../../github/lib/extractRepoFromURL.js";
import { cursorGetAgentStatus } from "./cursorGetAgentStatus.js";
import { MergePRInputSchema } from "../lib/schemas.js";
import {
	attemptRebase,
	checkRepositorySettings,
	collectPRStats,
	mergePR,
} from "../lib/mergeHelpers.js";

export const cursorMergePullRequest = {
	name: "cursorMergePullRequest",
	title: "Merge Cursor Agent Pull Request",
	description: `Merge a pull request created by a Cursor background agent.

CRITICAL:
You MUST verbally ask the user for explicit confirmation before calling this tool.
Your confirmation message MUST include the repository name (owner/repo) and PR number.`.trim(),
	operation: "merging pull request",
	schema: MergePRInputSchema,
	async handler(params) {
		const { agentId } = MergePRInputSchema.parse(params);
		const agentStatus = await cursorGetAgentStatus.handler({ agentId });

		if (!agentStatus.target?.prUrl) {
			return { success: false, message: "No changes made, nothing to PR.", agentStatus };
		}

		const ghStatus = await checkGHCLI();
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		const repoInfo = extractRepoFromURL(agentStatus.target.prUrl);
		const repo = `${repoInfo.owner}/${repoInfo.repo}`;
		const prStats = await collectPRStats(repo, repoInfo.prNumber);

		if (prStats.merged) {
			return { success: false, message: "This PR has already been merged.", agentStatus, prStats };
		}
		if (prStats.state !== "open") {
			return { success: false, message: "This PR has been canceled.", agentStatus, prStats };
		}

		const repoSettings = await checkRepositorySettings(repo);
		const rebaseResult = await attemptRebase(repo, repoInfo.prNumber);

		if (!rebaseResult.success) {
			if (rebaseResult.needsManualRebase) {
				return {
					success: false,
					message: `Cannot rebase to \`${prStats.baseRef}\` due to conflicts. Recommended course of action is to use \`cursorAddFollowUp\` asking it to "Resolve the conflicts of rebasing \`${prStats.headRef}\` onto \`${prStats.baseRef}\`. Confirm it's in working order, then force push \`${prStats.headRef}\`."`,
					agentStatus,
					prStats,
					repoSettings,
					rebaseError: rebaseResult.error,
				};
			}
			throw new Error(`Rebase failed: ${rebaseResult.error}`);
		}

		const useAutoMerge = repoSettings.allowAutoMerge;
		const mergeResult = await mergePR(repo, repoInfo.prNumber, useAutoMerge);

		return {
			success: true,
			message: `Successfully ${useAutoMerge ? "auto-merged" : "merged"} PR #${repoInfo.prNumber}`,
			agentStatus,
			prStats,
			repoSettings,
			rebaseResult,
			mergeResult,
		};
	},
};
