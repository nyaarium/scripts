import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { getWorkspaceRoot } from "../lib/getWorkspaceRoot.js";
const OutputLogCommitSchema = z.object({
	hash: z.string(),
	shortHash: z.string(),
	author: z.string(),
	email: z.string(),
	date: z.string(),
	message: z.string(),
	refs: z.array(z.string()).optional(),
});
const OutputLogDataSchema = z.array(OutputLogCommitSchema);

const OutputLogInfoSchema = z.object({
	outputPath: z.string(),
	outputPathAbs: z.string(),
	count: z.number().optional(),
	range: z.string().optional(),
	commits: z.number(),
});

function runGitLog(count, range) {
	return new Promise((resolve, reject) => {
		const env = { ...process.env, PAGER: "cat" };
		const formatString = "%H|%h|%an|%ae|%ad|%D|%B{{{EOL}}}";
		const cmdArgs = ["log", `--pretty=format:${formatString}`, "--decorate"];
		if (count !== undefined) cmdArgs.splice(1, 0, `-n ${count}`);
		else if (range !== undefined) cmdArgs.push(range);

		const child = spawn("git", cmdArgs, {
			stdio: ["ignore", "pipe", "pipe"],
			env,
			cwd: getWorkspaceRoot(),
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => { stdout += d.toString(); });
		child.stderr.on("data", (d) => { stderr += d.toString(); });
		child.on("close", (code) => {
			if (code === 0) resolve(stdout.trim());
			else reject(new Error(`Git log failed ${code}: ${stderr.trim()}`));
		});
		child.on("error", (e) => reject(e));
	});
}

function parseCommitData(rawLogData) {
	const commitBlocks = rawLogData.split("{{{EOL}}}").filter((block) => block.trim());
	const commits = [];

	for (const block of commitBlocks) {
		const lines = block.trim().split("\n");
		if (lines.length === 0) continue;
		const firstLine = lines[0];
		const parts = firstLine.split("|");
		if (parts.length < 6) continue;

		const [hash, shortHash, author, email, date, refsString, ...messageParts] = parts;
		const refs = refsString?.trim()
			? refsString.split(", ").map((r) => r.trim()).filter(Boolean)
			: [];
		const messageLines = lines.slice(1);
		const fullMessage = messageLines.join("\n").trim();
		const finalMessage = fullMessage || (messageParts.length > 0 ? messageParts.join("|").trim() : "");

		commits.push({
			hash: hash.trim(),
			shortHash: shortHash.trim(),
			author: author.trim(),
			email: email.trim(),
			date: date.trim(),
			message: finalMessage,
			refs: refs.length > 0 ? refs : undefined,
		});
	}
	return commits;
}

export const githubGitLog = {
	name: "githubGitLog",
	title: "github-git-log",
	description:
		"Fetch structured git log data. Supports count mode (-n) or range mode (-r). Uses local git, not GitHub API.",
	operation: "fetching git log",
	schema: z.object({
		count: z
			.number().int().min(1).max(10000)
			.optional()
			.describe("Number of log entries to fetch (mutually exclusive with range)."),
		range: z.string().optional().describe("Git range (single hash or hash..hash, mutually exclusive with count)."),
		outputPath: z
			.string()
			.optional()
			.describe(
				"Optional path to write JSON output. If provided, returns path info instead of full data.",
			),
	}),
	async handler({ count, range, outputPath }) {
		if (count !== undefined && range !== undefined) throw new Error("Cannot specify both count and range");
		if (count === undefined && range === undefined) throw new Error("Either count or range is required");

		const rawLogData = await runGitLog(count, range);
		const commits = parseCommitData(rawLogData);
		let data = OutputLogDataSchema.parse(commits);

		if (outputPath) {
			const outputPathAbs = resolve(outputPath);
			writeFileSync(outputPathAbs, JSON.stringify(data, null, 2));
			data = OutputLogInfoSchema.parse({
				outputPath,
				outputPathAbs,
				count,
				range,
				commits: data.length,
			});
		}
		return { data };
	},
};
