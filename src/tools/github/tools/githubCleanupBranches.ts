import { spawn } from "node:child_process";
import { z } from "zod";
import { checkGHCLI } from "../lib/checkGHCLI.ts";

function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
	return new Promise((resolve) => {
		const child = spawn("git", args, {
			stdio: ["ignore", "pipe", "pipe"],
			env: { ...process.env, PAGER: "cat" },
			cwd,
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d: Buffer) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d: Buffer) => {
			stderr += d.toString();
		});
		child.on("close", (code) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 }));
		child.on("error", (e) => resolve({ stdout: "", stderr: e.message, code: 1 }));
	});
}

const InputBranchSchema = z.object({
	name: z.string(),
	upstream: z.string(),
	track: z.string(),
});

const OutputDeletedBranchSchema = z.object({
	branch: z.string(),
	reason: z.string(),
});

const OutputSkippedBranchSchema = z.object({
	branch: z.string(),
	reason: z.string(),
});

const OutputResultSchema = z.object({
	deleted: z.array(OutputDeletedBranchSchema),
	skipped: z.array(OutputSkippedBranchSchema),
	dryRun: z.boolean().optional(),
});

export function parseBranchOutput(output: string): z.infer<typeof InputBranchSchema>[] {
	const results: z.infer<typeof InputBranchSchema>[] = [];
	for (const line of output.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const parts = trimmed.split("|");
		if (parts.length < 3) continue;
		const [name, upstream, track] = parts;
		if (!name) continue;
		results.push(InputBranchSchema.parse({ name, upstream: upstream ?? "", track: track ?? "" }));
	}
	return results;
}

const schema = z.object({
	dryRun: z.boolean().optional().describe("If true, report what would be deleted without actually deleting."),
});

export const githubCleanupBranches = {
	name: "githubCleanupBranches",
	title: "github-cleanup-branches",
	description:
		"Fetch/prune remote refs and delete local branches that are safely removable (merged, gone remote, no unpushed work). Reports what was deleted and what was skipped.",
	schema,
	async handler(cwd: string, args: z.infer<typeof schema>) {
		const { dryRun = false } = args;

		const ghStatus = await checkGHCLI(cwd);
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		const fetchResult = await runGit(cwd, ["fetch", "--prune"]);
		if (fetchResult.code !== 0) throw new Error(`git fetch --prune failed: ${fetchResult.stderr}`);

		const branchResult = await runGit(cwd, [
			"branch",
			"--format=%(refname:short)|%(upstream:short)|%(upstream:track)",
			"--no-color",
		]);
		if (branchResult.code !== 0) throw new Error(`git branch failed: ${branchResult.stderr}`);

		const branches = parseBranchOutput(branchResult.stdout);

		const deleted: z.infer<typeof OutputDeletedBranchSchema>[] = [];
		const skipped: z.infer<typeof OutputSkippedBranchSchema>[] = [];

		for (const b of branches) {
			const track = b.track.trim();

			if (track === "[gone]") {
				if (dryRun) {
					deleted.push({ branch: b.name, reason: "remote gone" });
					continue;
				}
				const result = await runGit(cwd, ["branch", "-D", b.name]);
				if (result.code === 0) {
					deleted.push({ branch: b.name, reason: "remote gone" });
				} else {
					skipped.push({ branch: b.name, reason: result.stderr || "force delete failed" });
				}
				continue;
			}

			if (/ahead \d+/.test(track)) {
				skipped.push({ branch: b.name, reason: "has unpushed commits" });
				continue;
			}

			// Local-only or tracked with no ahead: try safe delete
			if (dryRun) {
				deleted.push({ branch: b.name, reason: b.upstream ? "merged" : "local-only" });
				continue;
			}
			const result = await runGit(cwd, ["branch", "-d", b.name]);
			if (result.code === 0) {
				deleted.push({ branch: b.name, reason: b.upstream ? "merged" : "local-only" });
			} else {
				skipped.push({ branch: b.name, reason: "has unpushed commits" });
			}
		}

		return { data: OutputResultSchema.parse({ deleted, skipped, ...(dryRun ? { dryRun } : {}) }) };
	},
};
