import { spawn } from "node:child_process";
import { z } from "zod";
import { enableAutoMerge, getRepoSettings } from "../lib/approvePr.ts";
import { checkGHCLI } from "../lib/checkGHCLI.ts";
import { runGh } from "../lib/runGh.ts";

function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve) => {
		const child = spawn("git", args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, PAGER: "cat" },
			cwd,
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString();
		});
		child.on("close", (code) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 }));
		child.on("error", (e) => resolve({ stdout: "", stderr: e.message, code: 1 }));
	});
}

export function slugifyBranchName(input: string): string {
	return input
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
}

export async function detectMainBranch(cwd: string): Promise<string> {
	const result = await runGit(cwd, ["branch", "-r", "--format=%(refname:short)"]);
	if (result.code !== 0) throw new Error(`git branch -r failed: ${result.stderr}`);
	const remotes = result.stdout.split("\n").map((l) => l.trim());
	if (remotes.includes("origin/main")) return "main";
	if (remotes.includes("origin/master")) return "master";
	throw new Error("Could not find 'main' or 'master' branch.");
}

const schema = z.object({
	branchName: z.string().describe("Target branch name to push to."),
	prTitle: z.string().optional().describe("Pull request title. Required if createPr is true."),
	createPr: z.boolean().optional().default(false).describe("Whether to create a pull request after pushing."),
	autoMerge: z.boolean().optional().default(false).describe("Whether to enable auto-merge on the created PR."),
	dryRun: z.boolean().optional().default(false).describe("If true, report what would happen without executing."),
});

export const githubPushNewBranch = {
	name: "githubPushNewBranch",
	title: "github-push-new-branch",
	description:
		"Push the current work to a new branch, optionally create a pull request and enable auto-merge. If on the main branch, pushes commits to the new branch and resets main. If on a feature branch, pushes to the new branch name.",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { branchName, prTitle, createPr = false, autoMerge = false, dryRun = false } = args;

		const ghStatus = await checkGHCLI(cwd);
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		if (branchName === "main" || branchName === "master") {
			throw new Error("Branch name cannot be 'main' or 'master'.");
		}

		if (createPr && !prTitle) {
			throw new Error("prTitle is required when createPr is true.");
		}

		const mainBranch = await detectMainBranch(cwd);

		// Check for uncommitted changes
		const statusResult = await runGit(cwd, ["status", "-s"]);
		if (statusResult.stdout) {
			throw new Error("You have uncommitted changes. Please commit or stash them first.");
		}

		const currentBranchResult = await runGit(cwd, ["branch", "--show-current"]);
		const currentBranch = currentBranchResult.stdout;

		const actions: string[] = [];

		if (dryRun) {
			if (currentBranch === mainBranch) {
				actions.push(`Would push ${mainBranch} to origin/${branchName}`);
				actions.push(`Would reset ${mainBranch} to origin/${mainBranch}`);
				if (!createPr) actions.push(`Would checkout ${branchName}`);
			} else {
				actions.push(`Would push ${currentBranch} to origin/${branchName}`);
				if (createPr) {
					actions.push(`Would checkout ${mainBranch}`);
					actions.push(`Would delete local branch ${currentBranch}`);
				}
			}
			if (createPr) {
				actions.push(`Would create PR: "${prTitle}" (${branchName} → ${mainBranch})`);
				if (autoMerge) actions.push("Would enable auto-merge");
			}
			return { data: { dryRun: true, actions, branchName, mainBranch, currentBranch } };
		}

		// Push the branch
		if (currentBranch === mainBranch) {
			const pushResult = await runGit(cwd, ["push", "-u", "origin", `${mainBranch}:${branchName}`]);
			if (pushResult.code !== 0) throw new Error(`git push failed: ${pushResult.stderr}`);

			await runGit(cwd, ["branch", "-u", `origin/${mainBranch}`]);
			await runGit(cwd, ["reset", "--hard", `origin/${mainBranch}`]);

			if (!createPr) {
				await runGit(cwd, ["checkout", branchName]);
			}
		} else {
			const pushResult = await runGit(cwd, ["push", "-u", "origin", `${currentBranch}:${branchName}`]);
			if (pushResult.code !== 0) throw new Error(`git push failed: ${pushResult.stderr}`);

			if (createPr) {
				await runGit(cwd, ["checkout", mainBranch]);
				await runGit(cwd, ["branch", "-d", currentBranch]);
			}
		}

		let prUrl: string | undefined;
		let prNumber: string | undefined;

		if (createPr && prTitle) {
			const prCreateOutput = await runGh(cwd, [
				"pr",
				"create",
				"--base",
				mainBranch,
				"--head",
				branchName,
				"--title",
				prTitle,
				"--body",
				"",
			]);
			prUrl = prCreateOutput.trim();

			// Extract PR number
			const prViewRaw = await runGh(cwd, ["pr", "view", branchName, "--json", "number"]);
			const prViewData = JSON.parse(prViewRaw) as { number: number };
			prNumber = String(prViewData.number);

			if (autoMerge && prNumber) {
				const repoSettings = await getRepoSettings(cwd, undefined);
				const mergeMode = repoSettings.allowMergeCommit ? "m" : repoSettings.allowRebaseMerge ? "r" : "s";
				await enableAutoMerge(cwd, mergeMode, undefined, prNumber);
			}
		}

		return {
			data: {
				branchName,
				mainBranch,
				currentBranch,
				pushed: true,
				prUrl,
				prNumber,
				autoMerge: autoMerge && !!prNumber,
			},
		};
	},
};
