#!/usr/bin/env node

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// Input validation schemas for GitHub API data
const InputAuthorSchema = z.object({
	login: z.string(),
	name: z.string().nullable().optional(),
});

const InputFileSchema = z.object({
	filename: z.string(),
	status: z.string(),
	blob_url: z.string(),
	raw_url: z.string(),
	patch: z.string().nullable().optional(),
});

const InputCommitSchema = z.object({
	sha: z.string(),
	commit: z.object({
		author: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
		committer: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
		message: z.string(),
	}),
	author: InputAuthorSchema.nullable().optional(),
	committer: InputAuthorSchema.nullable().optional(),
	files: z.array(InputFileSchema),
	stats: z
		.object({
			total: z.number(),
			additions: z.number(),
			deletions: z.number(),
		})
		.optional(),
});

// Output validation schemas for the transformed data
const OutputFileSchema = z.object({
	filename: z.string(),
	status: z.string(),
	urlWeb: z.string(),
	urlRaw: z.string(),
	patch: z.string().nullable().optional(),
});

const OutputCommitSchema = z.object({
	id: z.string(),
	date: z.string(),
	author: z.string(),
	message: z.string(),
	files: z.array(OutputFileSchema),
});

const OutputInfoSchema = z.object({
	outputPath: z.string(),
	outputPathAbs: z.string(),
});

function printUsage() {
	console.log("");
	console.log("Usage: github-fetch-commit [<repo>] <commit-hash> [--output-path <output-path>]");
	console.log("");
	console.log("  repo: Repository in owner/repo format (ex: microsoft/vscode)");
	console.log("  commit-hash: The commit hash (full or short)");
	console.log("  --output-path: Optional path to write JSON output");
	console.log("");
}

function parseArgs() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		printUsage();
		process.exit(1);
	}

	let repo = undefined;
	let commitHash = undefined;
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
		} else if (arg.includes("/")) {
			// This looks like a repo
			if (repo !== undefined) {
				console.error("Error: Multiple repositories specified");
				printUsage();
				process.exit(1);
			}
			// Validate repo format (must have exactly one slash)
			const slashCount = (arg.match(/\//g) || []).length;
			if (slashCount !== 1) {
				console.error(
					"Error: Repository must be in owner/repo format with exactly one slash (ex: microsoft/vscode)",
				);
				printUsage();
				process.exit(1);
			}
			repo = arg;
			i++;
		} else if (/^[a-f0-9]+$/i.test(arg)) {
			// This looks like a commit hash (hex string)
			if (commitHash !== undefined) {
				console.error("Error: Multiple commit hashes specified");
				printUsage();
				process.exit(1);
			}
			commitHash = arg;
			i++;
		} else {
			console.error(`Error: Unrecognized argument: ${arg}`);
			printUsage();
			process.exit(1);
		}
	}

	// Validate required arguments
	if (commitHash === undefined) {
		console.error("Error: Commit hash is required");
		printUsage();
		process.exit(1);
	}

	return { repo, commitHash, outputPath };
}

async function fetchCommit(repo, commitHash) {
	return new Promise((resolve, reject) => {
		let apiArgs;
		if (repo) {
			apiArgs = ["api", `repos/${repo}/commits/${commitHash}`];
		} else {
			// Use current repo context
			apiArgs = ["api", "repos/:owner/:repo/commits/" + commitHash];
		}

		const child = spawn("gh", apiArgs, {
			stdio: ["ignore", "pipe", "pipe"],
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
				try {
					const rawData = JSON.parse(stdout);
					const validatedData = InputCommitSchema.parse(rawData);

					// Split commit message into headline and body
					const messageLines = validatedData.commit.message.split("\n");
					const messageHeadline = messageLines[0];
					const messageBody = messageLines.slice(1).join("\n").trim() || null;

					// Check for dependabot patterns in commit message
					const dependabotPatterns = [
						/^Bump .+ from .+ to .+$/i, // "Bump xxx from xxx to xxxx"
						/^Bump .+ group with .+$/i, // "Bump xxx group with xxx"
						/from .+\/dependabot\//i, // "from xxx/dependabot/"
					];

					const isDependabot = dependabotPatterns.some(
						(pattern) => pattern.test(messageHeadline) || (messageBody && pattern.test(messageBody)),
					);

					let message = messageBody ? `${messageHeadline}\n${messageBody}`.trim() : messageHeadline.trim();

					if (isDependabot) {
						message = messageHeadline.trim();
					}

					const transformedData = {
						id: validatedData.sha,
						date: validatedData.commit.author.date,
						author: validatedData.commit.author.name,
						message,
						files: validatedData.files.map((file) => ({
							filename: file.filename,
							status: file.status,
							urlWeb: file.blob_url,
							urlRaw: file.raw_url,
							patch: file.patch || null,
						})),
					};

					resolve(transformedData);
				} catch (error) {
					reject(new Error(`Failed to parse GitHub API response: ${error}`));
				}
			} else {
				reject(new Error(`GitHub API failed with code ${code}: ${stderr}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

async function main() {
	try {
		const { repo, commitHash, outputPath } = parseArgs();

		const commitData = await fetchCommit(repo, commitHash);

		if (outputPath) {
			// Write to file and output path info
			const outputPathAbs = resolve(outputPath);
			writeFileSync(outputPathAbs, JSON.stringify(commitData, null, 2));

			const outputInfo = {
				outputPath: outputPath,
				outputPathAbs: outputPathAbs,
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
			// Validate commit data before outputting
			try {
				const validatedCommitData = OutputCommitSchema.parse(commitData);
				console.log(JSON.stringify(validatedCommitData, null, 2));
			} catch (validationError) {
				console.error("Output validation failed:", validationError.message);
				console.error("Raw output:", JSON.stringify(commitData, null, 2));
				process.exit(1);
			}
		}
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}

main();
