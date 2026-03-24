import { gitCleanupBranches } from "./tools/gitCleanupBranches.ts";
import { gitFetch } from "./tools/gitFetch.ts";
import { gitLog } from "./tools/gitLog.ts";
import { gitPull } from "./tools/gitPull.ts";
import { gitPushNewBranch } from "./tools/gitPushNewBranch.ts";
import { gitStatus } from "./tools/gitStatus.ts";
import { gitSummarizeActivity } from "./tools/gitSummarizeActivity.ts";

export const toolsGit = [
	gitLog,
	gitStatus,
	gitFetch,
	gitPull,
	gitPushNewBranch,
	gitCleanupBranches,
	gitSummarizeActivity,
];
