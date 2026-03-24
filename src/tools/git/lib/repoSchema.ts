import { z } from "zod";

export const repoParam = z
	.string()
	.optional()
	.describe(
		"Target repository. Accepts: absolute path to a local repo, OWNER/REPO (searches sibling dirs, /workspace, ~/projects, ~), or omit to use the MCP client root.",
	);
