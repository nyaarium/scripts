#!/usr/bin/env node

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const CountSchema = z.number().int().min(1).max(10000);

// Output validation schemas for git log data
const OutputCommitSchema = z.object({
	hash: z.string(),
	shortHash: z.string(),
	author: z.string(),
	email: z.string(),
	date: z.string(),
	message: z.string(),
	refs: z.array(z.string()).optional(),
});

const OutputLogDataSchema = z.array(OutputCommitSchema);

const OutputInfoSchema = z.object({
	outputPath: z.string(),
	outputPathAbs: z.string(),
	count: z.number().optional(),
	range: z.string().optional(),
	commits: z.number(),
});

function printUsage() {
	console.log("");
	console.log("Usage: github-git-log -n <count> [--output-path <output-path>]");
	console.log("   OR: github-git-log -r <range> [--output-path <output-path>]");
	console.log("");
	console.log("  -n count: Number of log entries to fetch");
	console.log("  -r range: Git range (single hash or hash..hash range)");
	console.log("  --output-path: Optional path to write JSON output to file");
	console.log("");
	console.log("Examples:");
	console.log("  github-git-log -n 25");
	console.log("  github-git-log -r abc123..def456");
	console.log("  github-git-log -r main..feature-branch");
	console.log("  github-git-log -n 100 --output-path commits.json");
	console.log("");
	console.log("Output: Structured JSON with commit hash, author, date, message, and refs");
	console.log("");
}

function parseArgs() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		printUsage();
		process.exit(1);
	}

	let count = undefined;
	let range = undefined;
	let outputPath = undefined;

	// Parse arguments
	let i = 0;
	while (i < args.length) {
		const arg = args[i];

		if (arg === "--output-path") {
			// Handle --output-path flag
			if (i + 1 >= args.length) {
				console.error("Error: --output-path requires a value");
				printUsage();
				process.exit(1);
			}
			outputPath = args[i + 1];
			i += 2;
		} else if (arg === "-n") {
			// Handle -n count flag
			if (i + 1 >= args.length) {
				console.error("Error: -n requires a count value");
				printUsage();
				process.exit(1);
			}
			if (count !== undefined) {
				console.error("Error: Multiple count values specified");
				printUsage();
				process.exit(1);
			}
			try {
				count = CountSchema.parse(parseInt(args[i + 1], 10));
			} catch (error) {
				console.error(`Error: Invalid count value: ${error.message}`);
				printUsage();
				process.exit(1);
			}
			i += 2;
		} else if (arg === "-r") {
			// Handle -r range flag
			if (i + 1 >= args.length) {
				console.error("Error: -r requires a range value");
				printUsage();
				process.exit(1);
			}
			if (range !== undefined) {
				console.error("Error: Multiple range values specified");
				printUsage();
				process.exit(1);
			}
			range = args[i + 1];
			i += 2;
		} else {
			console.error(`Error: Unrecognized argument: ${arg}`);
			printUsage();
			process.exit(1);
		}
	}

	// Validate required arguments - must have either count or range, not both
	if (count === undefined && range === undefined) {
		console.error("Error: Either -n count or -r range is required");
		printUsage();
		process.exit(1);
	}
	if (count !== undefined && range !== undefined) {
		console.error("Error: Cannot specify both -n count and -r range");
		printUsage();
		process.exit(1);
	}

	return { count, range, outputPath };
}

async function fetchLogs(count, range) {
	return new Promise((resolve, reject) => {
		// Set PAGER to cat to prevent interactive paging
		const env = { ...process.env, PAGER: "cat" };

		// Use format string to get structured data with full message body
		const formatString = "%H|%h|%an|%ae|%ad|%D|%B{{{EOL}}}";
		const cmdArgs = ["log", `--pretty=format:${formatString}`, "--decorate"];

		// Add count or range to the command
		if (count !== undefined) {
			cmdArgs.splice(1, 0, `-n ${count}`);
		} else if (range !== undefined) {
			cmdArgs.push(range);
		}

		const child = spawn("git", cmdArgs, {
			stdio: ["ignore", "pipe", "pipe"],
			env: env,
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve(stdout.trim());
			} else {
				reject(new Error(`Git log failed with code ${code}: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute git log: ${error.message}`));
		});
	});
}

function parseCommitData(rawLogData) {
	// First split on the EOL token to separate commits
	const commitBlocks = rawLogData.split("{{{EOL}}}").filter((block) => block.trim());
	const commits = [];

	for (const block of commitBlocks) {
		const lines = block.trim().split("\n");
		if (lines.length === 0) continue;

		// The first line contains the structured data
		const firstLine = lines[0];
		const parts = firstLine.split("|");

		if (parts.length >= 6) {
			const [hash, shortHash, author, email, date, refsString, ...messageParts] = parts;

			// Parse refs (branches, tags) from the refs string
			const refs =
				refsString && refsString.trim()
					? refsString
							.split(", ")
							.map((ref) => ref.trim())
							.filter((ref) => ref)
					: [];

			// The rest of the lines (after the first line) contain the full commit message
			const messageLines = lines.slice(1);
			const fullMessage = messageLines.join("\n").trim();

			// Use the full message if available, otherwise use the subject from the structured data
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
	}

	return commits;
}

async function main() {
	try {
		const { count, range, outputPath } = parseArgs();

		const rawLogData = await fetchLogs(count, range);
		const commits = parseCommitData(rawLogData);

		// Validate the parsed data
		const logData = OutputLogDataSchema.parse(commits);

		if (outputPath) {
			// Write JSON to file and output path info
			const outputPathAbs = resolve(outputPath);
			writeFileSync(outputPathAbs, JSON.stringify(logData, null, 2));

			const outputInfo = {
				outputPath: outputPath,
				outputPathAbs: outputPathAbs,
				count: count,
				range: range,
				commits: commits.length,
			};

			// Validate output info before returning
			try {
				const validatedOutputInfo = OutputInfoSchema.parse(outputInfo);
				console.log(JSON.stringify(validatedOutputInfo, null, 2));
			} catch (validationError) {
				console.error("Output validation failed:", validationError.message);
				console.error("Raw output:", JSON.stringify(outputInfo, null, 2));
				process.exit(1);
			}
		} else {
			// Output the structured JSON data
			console.log(JSON.stringify(logData, null, 2));
		}
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}

main();
