import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve the working directory for git operations.
 *
 * When `repoPath` is omitted, returns the MCP client root (`mcpCwd`).
 * When `repoPath` is an absolute path, validates it has a `.git` directory and uses it.
 */
export function resolveRepoCwd(mcpCwd: string, repoPath?: string): string {
	if (!repoPath) return mcpCwd;

	if (!repoPath.startsWith("/")) {
		throw new Error(`repoPath must be an absolute path, got: "${repoPath}"`);
	}

	if (!existsSync(join(repoPath, ".git"))) {
		throw new Error(`Not a git repository: ${repoPath}`);
	}

	return repoPath;
}
