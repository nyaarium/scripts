import { gitCleanupBranches } from "./tools/gitCleanupBranches.ts";
import { gitCommit } from "./tools/gitCommit.ts";
import { gitFetch } from "./tools/gitFetch.ts";
import { gitLog } from "./tools/gitLog.ts";
import { gitPull } from "./tools/gitPull.ts";
import { gitPush } from "./tools/gitPush.ts";
import { gitPushNewBranch } from "./tools/gitPushNewBranch.ts";
import { gitStage } from "./tools/gitStage.ts";
import { gitStashList } from "./tools/gitStashList.ts";
import { gitStashPop } from "./tools/gitStashPop.ts";
import { gitStashPush } from "./tools/gitStashPush.ts";
import { gitStatus } from "./tools/gitStatus.ts";
import { gitSummarizeActivity } from "./tools/gitSummarizeActivity.ts";
import { gitSwitchBranch } from "./tools/gitSwitchBranch.ts";

export const toolsGit = [
	gitLog,
	gitStatus,
	gitStage,
	gitCommit,
	gitFetch,
	gitPull,
	gitPush,
	gitPushNewBranch,
	gitSwitchBranch,
	gitCleanupBranches,
	gitSummarizeActivity,
	gitStashList,
	gitStashPush,
	gitStashPop,
];
