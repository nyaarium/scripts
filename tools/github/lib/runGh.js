import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "./getWorkspaceRoot.js";

/**
 * Run `gh` with given args. Returns stdout as string. Throws on non-zero exit or spawn error.
 * Uses getWorkspaceRoot() as cwd so gh can infer repo from git when repo is not in args.
 * @param {string[]} args - e.g. ["api", "repos/owner/repo"] or ["pr", "merge", "123", "--merge"]
 */
export async function runGh(args) {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", args, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd: getWorkspaceRoot(),
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
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(stderr.trim() || `gh exited ${code}`));
		});
		child.on("error", (e) => reject(e));
	});
}
