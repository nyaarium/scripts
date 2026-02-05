import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "../../github/lib/getWorkspaceRoot.js";

const spawnOpts = () => ({ stdio: ["ignore", "pipe", "pipe"], cwd: getWorkspaceRoot() });

export function collectPRStats(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", ["api", `repos/${repo}/pulls/${prNumber}`], spawnOpts());
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => { stdout += d.toString(); });
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (code) => {
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
					reject(new Error(`Failed to parse PR data: ${e.message}`));
				}
			} else {
				reject(new Error(`Failed to get PR details: ${stderr.trim()}`));
			}
		});
		child.on("error", (e) => reject(new Error(`Failed to execute GitHub API: ${e.message}`)));
	});
}

export function checkRepositorySettings(repo) {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", ["api", `repos/${repo}`], spawnOpts());
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => { stdout += d.toString(); });
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (code) => {
			if (code === 0) {
				try {
					const repoData = JSON.parse(stdout);
					resolve({
						allowAutoMerge: repoData.allow_auto_merge === true,
						linearHistory:
							repoData.merge_commit_message === "PR_TITLE" && repoData.merge_commit_title === "PR_TITLE",
					});
				} catch (e) {
					reject(new Error(`Failed to parse repository data: ${e.message}`));
				}
			} else {
				reject(new Error(`Failed to check repository settings: ${stderr.trim()}`));
			}
		});
		child.on("error", (e) => reject(new Error(`Failed to execute GitHub API: ${e.message}`)));
	});
}

export function attemptRebase(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", ["api", `repos/${repo}/pulls/${prNumber}/update-branch`, "--method", "PUT"], spawnOpts());
		let stderr = "";
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (code) => {
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
		child.on("error", (e) => reject(new Error(`Failed to execute rebase: ${e.message}`)));
	});
}

export function mergePR(repo, prNumber, useAutoMerge = false) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["pr", "merge", prNumber, "--merge"];
		if (useAutoMerge) cmdArgs.splice(2, 0, "--auto");
		cmdArgs.splice(2, 0, "--repo", repo);
		const child = spawn("gh", cmdArgs, spawnOpts());
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => { stdout += d.toString(); });
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (code) => {
			if (code === 0) resolve({ success: true, output: stdout.trim() });
			else reject(new Error(`Failed to merge PR: ${stderr.trim()}`));
		});
		child.on("error", (e) => reject(new Error(`Failed to execute merge: ${e.message}`)));
	});
}
