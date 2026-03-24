import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/**
 * Resolve the working directory for git operations.
 *
 * When `repo` is omitted, returns the MCP client root (`mcpCwd`).
 * When `repo` is an absolute path, uses it directly.
 * When `repo` is OWNER/REPO, searches common locations for the REPO directory.
 */
export function resolveRepoCwd(mcpCwd: string, repo?: string): string {
	if (!repo) return mcpCwd;

	// Absolute path: use directly
	if (repo.startsWith("/")) {
		if (!existsSync(join(repo, ".git"))) {
			throw new Error(`Not a git repository: ${repo}`);
		}
		return repo;
	}

	// OWNER/REPO format: extract repo name and search common locations
	const repoName = repo.includes("/") ? repo.split("/").pop()! : repo;

	const candidates = [
		join(dirname(mcpCwd), repoName), // sibling of current project
		join("/workspace", repoName), // devcontainer default
		join(homedir(), "projects", repoName),
		join(homedir(), repoName),
	];

	for (const candidate of candidates) {
		const resolved = resolve(candidate);
		if (existsSync(join(resolved, ".git"))) {
			return resolved;
		}
	}

	throw new Error(
		`Could not find local git repository for "${repo}". Searched:\n${candidates.map((c) => `  - ${resolve(c)}`).join("\n")}`,
	);
}
