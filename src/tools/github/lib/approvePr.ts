import { runGh } from "./runGh.ts";

function api(repo: string | undefined, path: string): string[] {
	const p = repo ? path.replace(":owner/:repo", repo) : path;
	return ["api", p];
}

export interface RepoSettings {
	allowAutoMerge: boolean;
	linearHistory: boolean;
	isDraft: boolean;
	allowMergeCommit: boolean;
	allowRebaseMerge: boolean;
	allowSquashMerge: boolean;
}

export interface PRStatus {
	mergeable: boolean | null;
	mergeableState: string;
	headSha: string | undefined;
	baseRef: string | undefined;
	headRef: string | undefined;
}

export interface CheckInfo {
	name: string;
	status: string;
	conclusion: string;
	url: string;
}

export interface CIStatus {
	overall: string;
	required: CheckInfo[];
	optional: CheckInfo[];
	stillRunning: CheckInfo[];
	errors: CheckInfo[];
	canMerge: boolean;
	message: string;
}

export async function getRepoSettings(cwd: string, repo: string | undefined): Promise<RepoSettings> {
	const path = "repos/:owner/:repo";
	const stdout = await runGh(cwd, api(repo, path));
	const data = JSON.parse(stdout);
	return {
		allowAutoMerge: data.allow_auto_merge === true,
		linearHistory: data.merge_commit_message === "PR_TITLE" && data.merge_commit_title === "PR_TITLE",
		isDraft: data.archived === false && data.disabled === false && data.private === false,
		allowMergeCommit: data.allow_merge_commit === true,
		allowRebaseMerge: data.allow_rebase_merge === true,
		allowSquashMerge: data.allow_squash_merge === true,
	};
}

export async function getPRStatus(cwd: string, repo: string | undefined, prNumber: string): Promise<PRStatus> {
	const path = `repos/:owner/:repo/pulls/${prNumber}`;
	const stdout = await runGh(cwd, api(repo, path));
	const data = JSON.parse(stdout);
	return {
		mergeable: data.mergeable,
		mergeableState: data.mergeable_state,
		headSha: data.head?.sha,
		baseRef: data.base?.ref,
		headRef: data.head?.ref,
	};
}

/** Fetches check-runs for the PR's head SHA and aggregates them into a CIStatus with overall result, canMerge flag, and categorized check lists. */
export async function getCIStatus(cwd: string, repo: string | undefined, prNumber: string): Promise<CIStatus> {
	const prStatus = await getPRStatus(cwd, repo, prNumber);
	const sha = prStatus.headSha;
	if (!sha) throw new Error("No head SHA for PR");
	const path = `repos/:owner/:repo/commits/${sha}/check-runs`;
	const stdout = await runGh(cwd, api(repo, path));
	const checkData = JSON.parse(stdout);
	const checkRuns: unknown[] = checkData.check_runs || [];

	const status: CIStatus = {
		overall: "success",
		required: [],
		optional: [],
		stillRunning: [],
		errors: [],
		canMerge: true,
		message: "",
	};

	for (const check of checkRuns as Record<string, unknown>[]) {
		const info: CheckInfo = {
			name: check.name as string,
			status: check.status as string,
			conclusion: (check.conclusion as string) ?? "",
			url: (check.html_url as string) ?? "",
		};
		if (check.conclusion === "failure" || check.conclusion === "cancelled") {
			status.errors.push(info);
			status.canMerge = false;
		} else if (check.status === "in_progress" || check.status === "queued") {
			status.stillRunning.push(info);
			status.canMerge = false;
		} else if (check.conclusion === "success") {
			status.required.push(info);
		} else {
			status.optional.push(info);
		}
	}

	if (status.errors.length > 0) {
		status.overall = "failure";
		status.message = `CI checks failed: ${status.errors.map((e) => e.name).join(", ")}`;
	} else if (status.stillRunning.length > 0) {
		status.overall = "pending";
		status.message = `CI checks still running: ${status.stillRunning.map((e) => e.name).join(", ")}`;
	} else if (status.required.length > 0) {
		status.overall = "success";
		status.message = "All CI checks passed";
	} else {
		status.overall = "no_checks";
		status.message = "No CI checks found";
	}
	return status;
}

export async function getCurrentUser(cwd: string): Promise<Record<string, unknown>> {
	const stdout = await runGh(cwd, ["api", "user"]);
	return JSON.parse(stdout);
}

export async function getExistingApproval(cwd: string, repo: string | undefined, prNumber: string): Promise<boolean> {
	const path = `repos/:owner/:repo/pulls/${prNumber}/reviews`;
	const stdout = await runGh(cwd, api(repo, path));
	const reviews = JSON.parse(stdout) as Array<{ user?: { login?: string }; state?: string }>;
	const currentUser = await getCurrentUser(cwd);
	return reviews.some((r) => r.user?.login === (currentUser as { login?: string })?.login && r.state === "APPROVED");
}

export async function approvePR(
	cwd: string,
	repo: string | undefined,
	prNumber: string,
): Promise<{ success: boolean; prNumber: string; output: string }> {
	const args = ["pr", "review", prNumber, "--approve"];
	if (repo) args.splice(2, 0, "--repo", repo);
	await runGh(cwd, args);
	return { success: true, prNumber, output: "Approved" };
}

/** Enables auto-merge via `gh pr merge --auto`. `mode` is the merge flag letter: `"m"` (merge), `"r"` (rebase), `"s"` (squash). */
export async function enableAutoMerge(
	cwd: string,
	mode: string,
	repo: string | undefined,
	prNumber: string,
): Promise<{ success: boolean; prNumber: string; output: string }> {
	const args = ["pr", "merge", prNumber, "--auto", "--merge", `-${mode}`];
	if (repo) args.splice(2, 0, "--repo", repo);
	const output = await runGh(cwd, args);
	return { success: true, prNumber, output };
}

export async function manualMerge(
	cwd: string,
	repo: string | undefined,
	prNumber: string,
): Promise<{ success: boolean; prNumber: string; output: string }> {
	const args = ["pr", "merge", prNumber, "--merge"];
	if (repo) args.splice(2, 0, "--repo", repo);
	const output = await runGh(cwd, args);
	return { success: true, prNumber, output };
}
