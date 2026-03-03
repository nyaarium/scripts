import { spawn } from "node:child_process";

function spawnOpts(cwd: string) {
	return { stdio: ["ignore", "pipe", "pipe"] as const, cwd } as { stdio: ["ignore", "pipe", "pipe"]; cwd: string };
}

export interface PRStats {
	exists: boolean;
	state: string;
	merged: boolean;
	mergeable: boolean | null;
	mergeableState: string;
	headSha: string;
	baseRef: string;
	headRef: string;
	title: string;
	url: string;
}

export interface RepositorySettings {
	allowAutoMerge: boolean;
	linearHistory: boolean;
}

export interface RebaseResult {
	success: boolean;
	needsManualRebase?: boolean;
	error?: string;
}

export interface MergeResult {
	success: boolean;
	output: string;
}

export function collectPRStats(cwd: string, repo: string, prNumber: string): Promise<PRStats> {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", ["api", `repos/${repo}/pulls/${prNumber}`], spawnOpts(cwd));
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
		child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
		child.on("close", (code: number | null) => {
			if (code === 0) {
				try {
					const prData = JSON.parse(stdout);
					resolve({
						exists: true,
						state: prData.state,
						merged: prData.merged,
						mergeable: prData.mergeable,
						mergeableState: prData.mergeable_state,
						headSha: prData.head.sha,
						baseRef: prData.base.ref,
						headRef: prData.head.ref,
						title: prData.title,
						url: prData.html_url,
					});
				} catch (e) {
					reject(new Error(`Failed to parse PR data: ${(e as Error).message}`));
				}
			} else {
				reject(new Error(`Failed to get PR details: ${stderr.trim()}`));
			}
		});
		child.on("error", (e: Error) => reject(new Error(`Failed to execute GitHub API: ${e.message}`)));
	});
}

export function checkRepositorySettings(cwd: string, repo: string): Promise<RepositorySettings> {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", ["api", `repos/${repo}`], spawnOpts(cwd));
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
		child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
		child.on("close", (code: number | null) => {
			if (code === 0) {
				try {
					const repoData = JSON.parse(stdout);
					resolve({
						allowAutoMerge: repoData.allow_auto_merge === true,
						linearHistory:
							repoData.merge_commit_message === "PR_TITLE" && repoData.merge_commit_title === "PR_TITLE",
					});
				} catch (e) {
					reject(new Error(`Failed to parse repository data: ${(e as Error).message}`));
				}
			} else {
				reject(new Error(`Failed to check repository settings: ${stderr.trim()}`));
			}
		});
		child.on("error", (e: Error) => reject(new Error(`Failed to execute GitHub API: ${e.message}`)));
	});
}

export function attemptRebase(cwd: string, repo: string, prNumber: string): Promise<RebaseResult> {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", ["api", `repos/${repo}/pulls/${prNumber}/update-branch`, "--method", "PUT"], spawnOpts(cwd));
		let stderr = "";
		child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
		child.on("close", (code: number | null) => {
			if (code === 0) {
				resolve({ success: true });
			} else {
				const errorMsg = stderr.trim();
				resolve({
					success: false,
					needsManualRebase: errorMsg.includes("conflict") || errorMsg.includes("merge conflict"),
					error: errorMsg,
				});
			}
		});
		child.on("error", (e: Error) => reject(new Error(`Failed to execute rebase: ${e.message}`)));
	});
}

export function mergePR(cwd: string, repo: string, prNumber: string, useAutoMerge = false): Promise<MergeResult> {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["pr", "merge", prNumber, "--merge"];
		if (useAutoMerge) cmdArgs.splice(2, 0, "--auto");
		cmdArgs.splice(2, 0, "--repo", repo);
		const child = spawn("gh", cmdArgs, spawnOpts(cwd));
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
		child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
		child.on("close", (code: number | null) => {
			if (code === 0) resolve({ success: true, output: stdout.trim() });
			else reject(new Error(`Failed to merge PR: ${stderr.trim()}`));
		});
		child.on("error", (e: Error) => reject(new Error(`Failed to execute merge: ${e.message}`)));
	});
}
