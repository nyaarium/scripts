import { gitCleanupBranches } from "./tools/gitCleanupBranches.ts";
import { gitCommit } from "./tools/gitCommit.ts";
import { gitFetch } from "./tools/gitFetch.ts";
import { gitLog } from "./tools/gitLog.ts";
import { gitPull } from "./tools/gitPull.ts";
import { gitStage } from "./tools/gitStage.ts";
import { gitStatus } from "./tools/gitStatus.ts";
import { gitSummarizeActivity } from "./tools/gitSummarizeActivity.ts";

export const toolsGit = [
	gitLog,
	gitStatus,
	gitStage,
	gitCommit,
	gitFetch,
	gitPull,
	gitCleanupBranches,
	gitSummarizeActivity,
];
