import { githubCleanupBranches } from "../tools/github/tools/githubCleanupBranches.ts";

const dryRun = process.argv.includes("--dry-run");
const cwd = process.cwd();

const result = await githubCleanupBranches.handler(cwd, { dryRun });
console.log(JSON.stringify(result, null, 2));
