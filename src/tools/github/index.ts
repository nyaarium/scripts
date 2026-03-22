import { githubApproveDependabot } from "./tools/githubApproveDependabot.ts";
import { githubApprovePr } from "./tools/githubApprovePr.ts";
import { githubCleanupBranches } from "./tools/githubCleanupBranches.ts";
import { githubFetchCommit } from "./tools/githubFetchCommit.ts";
import { githubFetchIssue } from "./tools/githubFetchIssue.ts";
import { githubFetchPr } from "./tools/githubFetchPr.ts";
import { githubGitLog } from "./tools/githubGitLog.ts";
import { githubListPr } from "./tools/githubListPr.ts";
import { githubPrComment } from "./tools/githubPrComment.ts";
import { githubSummarizeActivity } from "./tools/githubSummarizeActivity.ts";

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
	githubSummarizeActivity,
];
