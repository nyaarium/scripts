import { githubApproveDependabot } from "./tools/githubApproveDependabot.ts";
import { githubApprovePr } from "./tools/githubApprovePr.ts";
import { githubAwaitWorkflowRun } from "./tools/githubAwaitWorkflowRun.ts";
import { githubCleanupBranches } from "./tools/githubCleanupBranches.ts";
import { githubCreateIssue } from "./tools/githubCreateIssue.ts";
import { githubFetchCommit } from "./tools/githubFetchCommit.ts";
import { githubFetchIssue } from "./tools/githubFetchIssue.ts";
import { githubFetchPr } from "./tools/githubFetchPr.ts";
import { githubFetchWorkflowRun } from "./tools/githubFetchWorkflowRun.ts";
import { githubFetchWorkflowRuns } from "./tools/githubFetchWorkflowRuns.ts";
import { githubGitLog } from "./tools/githubGitLog.ts";
import { githubListPr } from "./tools/githubListPr.ts";
import { githubPrComment } from "./tools/githubPrComment.ts";
import { githubPushNewBranch } from "./tools/githubPushNewBranch.ts";
import { githubRerunWorkflow } from "./tools/githubRerunWorkflow.ts";
import { githubSummarizeActivity } from "./tools/githubSummarizeActivity.ts";
import { githubUpdateIssue } from "./tools/githubUpdateIssue.ts";

export const toolsGitHub = [
	githubFetchCommit,
	githubApproveDependabot,
	githubFetchPr,
	githubListPr,
	githubPrComment,
	githubFetchIssue,
	githubGitLog,
	githubApprovePr,
	githubCleanupBranches,
	githubPushNewBranch,
	githubSummarizeActivity,
	githubFetchWorkflowRuns,
	githubFetchWorkflowRun,
	githubAwaitWorkflowRun,
	githubRerunWorkflow,
	githubCreateIssue,
	githubUpdateIssue,
];
