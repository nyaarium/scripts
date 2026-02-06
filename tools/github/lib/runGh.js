import { spawn } from "node:child_process";

/**
 * Run `gh` with given args. Returns stdout as string. Throws on non-zero exit or spawn error.
 * @param {string} cwd - Working directory for gh (repo inference when repo not in args).
 * @param {string[]} args - e.g. ["api", "repos/owner/repo"] or ["pr", "merge", "123", "--merge"]
 */
export async function runGh(cwd, args) {
	return new Promise((resolve, reject) => {
		const child = spawn("gh", args, {
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
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(stderr.trim() || `gh exited ${code}`));
		});
		child.on("error", (e) => reject(e));
	});
}
