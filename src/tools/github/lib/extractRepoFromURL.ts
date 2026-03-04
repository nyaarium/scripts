export function extractRepoFromURL(prUrl: string): { owner: string; repo: string; prNumber: string } {
	const match = prUrl.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
	if (!match) throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
	return { owner: match[1], repo: match[2], prNumber: match[3] };
}
