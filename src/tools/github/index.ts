import { githubApprovePr } from "./tools/githubApprovePr.ts";
import { githubFetchCommit } from "./tools/githubFetchCommit.ts";
import { githubFetchIssue } from "./tools/githubFetchIssue.ts";
import { githubFetchPr } from "./tools/githubFetchPr.ts";
import { githubGitLog } from "./tools/githubGitLog.ts";
import { githubListPr } from "./tools/githubListPr.ts";
import { githubPrComment } from "./tools/githubPrComment.ts";

export const toolsGitHub = [
	githubFetchCommit,
	githubFetchPr,
	githubListPr,
	githubPrComment,
	githubFetchIssue,
	githubGitLog,
	githubApprovePr,
];
