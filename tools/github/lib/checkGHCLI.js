import { spawn } from "node:child_process";
import { getWorkspaceRoot } from "./getWorkspaceRoot.js";

/**
 * Check if GitHub CLI is available and authenticated.
 * @returns {Promise<{available: boolean, authenticated: boolean, error?: string}>}
 */
export async function checkGHCLI() {
	return new Promise((resolve) => {
		const child = spawn("gh", ["auth", "status"], {
			stdio: ["ignore", "pipe", "pipe"],
			cwd: getWorkspaceRoot(),
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => { stdout += d.toString(); });
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (code) => {
			if (code === 0) {
				resolve({ available: true, authenticated: true });
			} else if (stderr.includes("not authenticated") || stderr.includes("gh auth login")) {
				resolve({ available: true, authenticated: false, error: "GitHub CLI not authenticated" });
			} else {
				resolve({ available: false, authenticated: false, error: "GitHub CLI not found" });
			}
		});
		child.on("error", () => {
			resolve({ available: false, authenticated: false, error: "GitHub CLI not found" });
		});
	});
}
