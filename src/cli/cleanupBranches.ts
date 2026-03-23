import { gitCleanupBranches } from "../tools/git/tools/gitCleanupBranches.ts";

const dryRun = process.argv.includes("--dry-run");
const cwd = process.cwd();

const result = await gitCleanupBranches.handler(cwd, { dryRun });
console.log(JSON.stringify(result, null, 2));
