import { githubFetchCommit } from "./tools/githubFetchCommit.js";
import { githubFetchPr } from "./tools/githubFetchPr.js";
import { githubFetchIssue } from "./tools/githubFetchIssue.js";
import { githubGitLog } from "./tools/githubGitLog.js";
import { githubApprovePr } from "./tools/githubApprovePr.js";

export const toolsGitHub = [
	githubFetchCommit,
	githubFetchPr,
	githubFetchIssue,
	githubGitLog,
	githubApprovePr,
];
