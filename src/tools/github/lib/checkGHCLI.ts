import { spawn } from "node:child_process";

export interface GHCLIStatus {
	available: boolean;
	authenticated: boolean;
	error?: string;
}

export async function checkGHCLI(cwd: string): Promise<GHCLIStatus> {
	return new Promise((resolve) => {
		const child = spawn("gh", ["auth", "status"], {
			stdio: ["ignore", "pipe", "pipe"],
			cwd,
		});
		let stderr = "";
		child.stdout.on("data", () => {});
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString();
		});
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
