import { spawn } from "node:child_process";
import { z } from "zod";
import { checkGHCLI } from "../lib/checkGHCLI.js";

export const githubPrComment = {
	name: "githubPrComment",
	title: "github-pr-comment",
	description:
		"Post a comment on a GitHub pull request. Use e.g. for Dependabot PRs with mergeStateStatus DIRTY: post \"@dependabot recreate\" to trigger a rebase. Mutating action.",
	operation: "commenting on PR",
	schema: z.object({
		repo: z
			.string()
			.optional()
			.describe(
				"Repository in owner/repo format (ex: microsoft/vscode). If not provided, uses current repository.",
			),
		prId: z.string().describe("The pull request number to comment on."),
		body: z.string().min(1).describe("The comment body text (e.g. \"@dependabot recreate\")."),
	}),
	async handler(cwd, { repo, prId, body }) {
		const ghStatus = await checkGHCLI(cwd);
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		return new Promise((resolve, reject) => {
			const cmdArgs = ["pr", "comment", prId, "--body", body];
			if (repo) cmdArgs.splice(2, 0, "--repo", repo);

			const child = spawn("gh", cmdArgs, {
				stdio: ["ignore", "pipe", "pipe"],
				cwd,
			});
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (d) => {
				stdout += d.toString();
			});
			child.stderr.on("data", (d) => {
				stderr += d.toString();
			});

			child.on("close", (code) => {
				if (code !== 0) {
					reject(new Error(`GitHub CLI failed ${code}: ${stderr.trim() || stdout.trim()}`));
					return;
				}
				resolve({ data: { success: true, prId, message: "Comment posted." } });
			});
			child.on("error", (e) => reject(e));
		});
	},
};
