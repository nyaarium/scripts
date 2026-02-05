/**
 * Parse owner, repo, prNumber from a GitHub PR URL.
 * @param {string} prUrl
 * @returns {{owner: string, repo: string, prNumber: string}}
 */
export function extractRepoFromURL(prUrl) {
	const match = prUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
	if (!match) throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
	return { owner: match[1], repo: match[2], prNumber: match[3] };
}
