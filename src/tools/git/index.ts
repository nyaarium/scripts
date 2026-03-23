import { gitCleanupBranches } from "./tools/gitCleanupBranches.ts";
import { gitLog } from "./tools/gitLog.ts";
import { gitStatus } from "./tools/gitStatus.ts";
import { gitSummarizeActivity } from "./tools/gitSummarizeActivity.ts";

export const toolsGit = [gitLog, gitCleanupBranches, gitSummarizeActivity, gitStatus];
