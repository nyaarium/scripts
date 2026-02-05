/**
 * Cwd for gh/git when repo is inferred. Set by nyaascripts at startup (NYAASCRIPTS_WORKSPACE).
 */
export function getWorkspaceRoot() {
	return process.env.NYAASCRIPTS_WORKSPACE || process.cwd();
}
