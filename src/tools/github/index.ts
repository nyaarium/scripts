import { githubFetchCommit } from "./tools/githubFetchCommit.ts";
import { githubFetchPr } from "./tools/githubFetchPr.ts";
import { githubListPr } from "./tools/githubListPr.ts";
import { githubPrComment } from "./tools/githubPrComment.ts";
import { githubFetchIssue } from "./tools/githubFetchIssue.ts";
import { githubGitLog } from "./tools/githubGitLog.ts";
import { githubApprovePr } from "./tools/githubApprovePr.ts";

export const toolsGitHub = [
	githubFetchCommit,
	githubFetchPr,
	githubListPr,
	githubPrComment,
	githubFetchIssue,
	githubGitLog,
	githubApprovePr,
];
