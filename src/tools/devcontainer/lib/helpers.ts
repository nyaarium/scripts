import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOME = os.homedir();

function findDevcontainerBin(): string {
	const candidates = [path.join(HOME, ".devcontainers/bin/devcontainer"), "/usr/local/bin/devcontainer"];
	for (const c of candidates) {
		if (fs.existsSync(c)) return c;
	}
	try {
		return execSync("which devcontainer", { encoding: "utf-8", timeout: 5000 }).trim();
	} catch {
		throw new Error("devcontainer CLI not found.");
	}
}

let cachedBin: string | null = null;
function devcontainerBin(): string {
	if (!cachedBin) cachedBin = findDevcontainerBin();
	return cachedBin;
}

export function assertWSLHost(): void {
	if (fs.existsSync("/.dockerenv") || process.env.REMOTE_CONTAINERS) {
		throw new Error("This tool runs only from the WSL host, not inside a container.");
	}
	try {
		const version = fs.readFileSync("/proc/version", "utf-8");
		if (!version.toLowerCase().includes("microsoft")) {
			throw new Error("This tool requires a WSL environment.");
		}
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error("Cannot detect environment.");
		}
		throw e;
	}
}

export function resolveProject(projectPath: string): string {
	if (projectPath.includes("..")) {
		throw new Error("Path must not contain '..'.");
	}
	const resolved = path.isAbsolute(projectPath) ? projectPath : path.join(HOME, projectPath);
	if (!fs.existsSync(resolved)) {
		throw new Error(`Project not found: ${resolved}`);
	}
	if (!fs.existsSync(path.join(resolved, ".devcontainer", "devcontainer.json"))) {
		throw new Error(`No .devcontainer/devcontainer.json in ${resolved}`);
	}
	return resolved;
}

function isContainerReady(projectPath: string): boolean {
	try {
		execSync(`"${devcontainerBin()}" exec --workspace-folder "${projectPath}" echo ok`, {
			timeout: 15_000,
			stdio: "pipe",
		});
		return true;
	} catch {
		return false;
	}
}

export function ensureContainerUp(projectPath: string): void {
	if (isContainerReady(projectPath)) return;

	const bin = devcontainerBin();

	// devcontainer up handles build + start + all lifecycle commands and blocks until done.
	// No timeout — large image builds can take many minutes.
	let output: string;
	try {
		output = execSync(`"${bin}" up --workspace-folder "${projectPath}"`, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		throw new Error(`devcontainer up failed for '${projectPath}':\n${msg}`);
	}

	// Parse the final JSON line for outcome
	const lines = output.trim().split("\n");
	const lastLine = lines[lines.length - 1];
	try {
		const result = JSON.parse(lastLine);
		if (result.outcome !== "success") {
			throw new Error(`devcontainer up returned outcome '${result.outcome}' for '${projectPath}'.`);
		}
	} catch (e) {
		if (e instanceof SyntaxError) {
			throw new Error(`devcontainer up returned unexpected output for '${projectPath}':\n${lastLine}`);
		}
		throw e;
	}
}

export function execInContainer(
	projectPath: string,
	command: string[],
	timeoutMs = 120000,
	stdin?: string,
): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn(devcontainerBin(), ["exec", "--workspace-folder", projectPath, ...command], {
			timeout: timeoutMs,
		});

		let stdout = "";
		let stderr = "";
		proc.stdout.on("data", (d: Buffer) => (stdout += d));
		proc.stderr.on("data", (d: Buffer) => (stderr += d));
		proc.on("error", reject);
		proc.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				const msg = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n") || "(no output)";
				reject(new Error(`Exit ${code}: ${msg}`));
			}
		});

		if (stdin != null) {
			proc.stdin.write(stdin);
			proc.stdin.end();
		}
	});
}
