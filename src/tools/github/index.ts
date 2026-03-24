import { githubApproveDependabot } from "./tools/githubApproveDependabot.ts";
import { githubApprovePr } from "./tools/githubApprovePr.ts";
import { githubAwaitWorkflowRun } from "./tools/githubAwaitWorkflowRun.ts";
import { githubCreateIssue } from "./tools/githubCreateIssue.ts";
import { githubFetchCommit } from "./tools/githubFetchCommit.ts";
import { githubFetchIssue } from "./tools/githubFetchIssue.ts";
import { githubFetchPr } from "./tools/githubFetchPr.ts";
import { githubFetchWorkflowRun } from "./tools/githubFetchWorkflowRun.ts";
import { githubFetchWorkflowRuns } from "./tools/githubFetchWorkflowRuns.ts";
import { githubListPr } from "./tools/githubListPr.ts";
import { githubPrComment } from "./tools/githubPrComment.ts";
import { githubRerunWorkflow } from "./tools/githubRerunWorkflow.ts";
import { githubUpdateIssue } from "./tools/githubUpdateIssue.ts";

export const toolsGitHub = [
	githubFetchCommit,
	githubApproveDependabot,
	githubFetchPr,
	githubListPr,
	githubPrComment,
	githubFetchIssue,
	githubApprovePr,
	githubFetchWorkflowRuns,
	githubFetchWorkflowRun,
	githubAwaitWorkflowRun,
	githubRerunWorkflow,
	githubCreateIssue,
	githubUpdateIssue,
];
