import { runGh } from "./runGh.js";

function api(repo, path) {
	const p = repo ? path.replace(":owner/:repo", repo) : path;
	return ["api", p];
}

export async function getRepoSettings(repo) {
	const path = "repos/:owner/:repo";
	const stdout = await runGh(api(repo, path));
	const data = JSON.parse(stdout);
	return {
		allowAutoMerge: data.allow_auto_merge === true,
		linearHistory:
			data.merge_commit_message === "PR_TITLE" && data.merge_commit_title === "PR_TITLE",
		isDraft: data.archived === false && data.disabled === false && data.private === false,
		allowMergeCommit: data.allow_merge_commit === true,
		allowRebaseMerge: data.allow_rebase_merge === true,
		allowSquashMerge: data.allow_squash_merge === true,
	};
}

export async function getPRStatus(repo, prNumber) {
	const path = `repos/:owner/:repo/pulls/${prNumber}`;
	const stdout = await runGh(api(repo, path));
	const data = JSON.parse(stdout);
	return {
		mergeable: data.mergeable,
		mergeableState: data.mergeable_state,
		headSha: data.head?.sha,
		baseRef: data.base?.ref,
		headRef: data.head?.ref,
	};
}

export async function getCIStatus(repo, prNumber) {
	const prStatus = await getPRStatus(repo, prNumber);
	const sha = prStatus.headSha;
	if (!sha) throw new Error("No head SHA for PR");
	const path = `repos/:owner/:repo/commits/${sha}/check-runs`;
	const stdout = await runGh(api(repo, path));
	const checkData = JSON.parse(stdout);
	const checkRuns = checkData.check_runs || [];

	const status = {
		overall: "success",
		required: [],
		optional: [],
		stillRunning: [],
		errors: [],
		canMerge: true,
		message: "",
	};

	for (const check of checkRuns) {
		const info = {
			name: check.name,
			status: check.status,
			conclusion: check.conclusion ?? "",
			url: check.html_url ?? "",
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

export async function getCurrentUser() {
	const stdout = await runGh(["api", "user"]);
	return JSON.parse(stdout);
}

export async function getExistingApproval(repo, prNumber) {
	const path = `repos/:owner/:repo/pulls/${prNumber}/reviews`;
	const stdout = await runGh(api(repo, path));
	const reviews = JSON.parse(stdout);
	const currentUser = await getCurrentUser();
	return reviews.some(
		(r) => r.user?.login === currentUser?.login && r.state === "APPROVED",
	);
}

export async function approvePR(repo, prNumber) {
	const args = ["pr", "review", prNumber, "--approve"];
	if (repo) args.splice(2, 0, "--repo", repo);
	await runGh(args);
	return { success: true, prNumber, output: "Approved" };
}

export async function enableAutoMerge(mode, repo, prNumber) {
	const args = ["pr", "merge", prNumber, "--auto", "--merge", `-${mode}`];
	if (repo) args.splice(2, 0, "--repo", repo);
	const output = await runGh(args);
	return { success: true, prNumber, output };
}

export async function manualMerge(repo, prNumber) {
	const args = ["pr", "merge", prNumber, "--merge"];
	if (repo) args.splice(2, 0, "--repo", repo);
	const output = await runGh(args);
	return { success: true, prNumber, output };
}
