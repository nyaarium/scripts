#!/usr/bin/env node

import { spawn } from "node:child_process";
import { z } from "zod";

const PRNumberSchema = z
	.string()
	.regex(/^\d+$/, "PR number must contain only digits")
	.transform((val) => {
		const num = parseInt(val, 10);
		if (num <= 0) {
			throw new Error("PR number must be a positive integer");
		}
		return val;
	});

const PRNumberArraySchema = z.array(PRNumberSchema);

// Output validation schemas
const OutputCIStatusSchema = z.object({
	overall: z.enum(["success", "pending", "failure", "no_checks"]),
	required: z.array(
		z.object({
			name: z.string(),
			status: z.string(),
			conclusion: z.string(),
			url: z.string(),
		}),
	),
	optional: z.array(
		z.object({
			name: z.string(),
			status: z.string(),
			conclusion: z.string(),
			url: z.string(),
		}),
	),
	stillRunning: z.array(
		z.object({
			name: z.string(),
			status: z.string(),
			conclusion: z.string(),
			url: z.string(),
		}),
	),
	errors: z.array(
		z.object({
			name: z.string(),
			status: z.string(),
			conclusion: z.string(),
			url: z.string(),
		}),
	),
	canMerge: z.boolean(),
	message: z.string(),
});

const OutputPRStatusSchema = z.object({
	mergeable: z.boolean().nullable(),
	mergeableState: z.string(),
	headSha: z.string(),
	baseRef: z.string(),
	headRef: z.string(),
});

const OutputMergeResultSchema = z.object({
	strategy: z.enum(["auto-merge", "manual-merge", "blocked"]),
	message: z.string(),
	ciStatus: OutputCIStatusSchema,
	prStatus: OutputPRStatusSchema,
});

const OutputResultSchema = z.object({
	success: z.boolean(),
	prNumber: z.string(),
	output: z.string(),
	skipped: z.boolean().optional(),
	authWarning: z.string().optional(),
	mergeResult: OutputMergeResultSchema.optional(),
});

const OutputRepositorySettingsSchema = z.object({
	allowAutoMerge: z.boolean(),
	linearHistory: z.boolean(),
	isDraft: z.boolean(),
});

const OutputErrorSchema = z.object({
	prNumber: z.string(),
	error: z.string(),
	ciStatus: OutputCIStatusSchema.optional(),
	prStatus: OutputPRStatusSchema.optional(),
});

const OutputSchema = z.object({
	total: z.number(),
	successful: z.number(),
	failed: z.number(),
	repositorySettings: OutputRepositorySettingsSchema.nullable(),
	results: z.array(OutputResultSchema),
	errors: z.array(OutputErrorSchema),
});

function printUsage() {
	console.log("");
	console.log("Usage: github-approve-pr [<repo>] <pr-numbers> [--merge]");
	console.log("");
	console.log("  repo: Repository in owner/repo format (ex: microsoft/vscode)");
	console.log("  pr-numbers: PR number(s) - can be:");
	console.log("    - Single number: 123");
	console.log("    - JSON array: '[123, 456, 789]'");
	console.log("  --merge: After approval, merge the PR (auto-merge if enabled, manual merge otherwise)");
	console.log("");
	console.log("Examples:");
	console.log("  github-approve-pr 123");
	console.log("  github-approve-pr '[123, 456]'");
	console.log("  github-approve-pr microsoft/vscode 123");
	console.log("  github-approve-pr microsoft/vscode '[123, 456, 789]'");
	console.log("  github-approve-pr 123 --merge");
	console.log("  github-approve-pr microsoft/vscode 123 --merge");
	console.log("");
}

function parseArgs() {
	const args = process.argv.slice(2);

	if (args.length < 1) {
		printUsage();
		process.exit(1);
	}

	let repo = undefined;
	let prNumbers = undefined;
	let shouldMerge = false;

	// Parse arguments
	let i = 0;
	while (i < args.length) {
		const arg = args[i];

		if (arg === "--merge") {
			// Handle --merge flag
			shouldMerge = true;
			i++;
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
		} else {
			// This should be the PR number(s)
			if (prNumbers !== undefined) {
				console.error("Error: Multiple PR number arguments specified");
				printUsage();
				process.exit(1);
			}

			try {
				// Try to parse as JSON array first
				if (arg.startsWith("[") && arg.endsWith("]")) {
					const parsed = JSON.parse(arg);
					prNumbers = PRNumberArraySchema.parse(parsed);
				} else if (/^\d+$/.test(arg)) {
					// Single number
					prNumbers = [PRNumberSchema.parse(arg)];
				} else {
					console.error(`Error: Invalid PR number format: ${arg}`);
					printUsage();
					process.exit(1);
				}
			} catch (error) {
				console.error(`Error: Failed to parse PR numbers: ${error.message}`);
				printUsage();
				process.exit(1);
			}
			i++;
		}
	}

	// Validate required arguments
	if (prNumbers === undefined) {
		console.error("Error: PR number(s) are required");
		printUsage();
		process.exit(1);
	}

	return { repo, prNumbers, shouldMerge };
}

async function checkAutoMergeEnabled(repo) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", "repos/:owner/:repo"];
		if (repo) {
			cmdArgs[1] = `repos/${repo}`;
		}

		const child = spawn("gh", cmdArgs, {
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
					const repoData = JSON.parse(stdout);
					resolve({
						allowAutoMerge: repoData.allow_auto_merge === true,
						linearHistory:
							repoData.merge_commit_message === "PR_TITLE" && repoData.merge_commit_title === "PR_TITLE",
						isDraft:
							repoData.archived === false && repoData.disabled === false && repoData.private === false,
					});
				} catch (error) {
					reject(new Error(`Failed to parse repository data: ${error.message}`));
				}
			} else {
				reject(new Error(`Failed to check auto-merge status: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

async function checkPRStatus(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", "repos/:owner/:repo/pulls/:pull_number"];
		if (repo) {
			cmdArgs[1] = `repos/${repo}/pulls/${prNumber}`;
		} else {
			cmdArgs[1] = `repos/:owner/:repo/pulls/${prNumber}`;
		}

		const child = spawn("gh", cmdArgs, {
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
					const prData = JSON.parse(stdout);
					resolve({
						mergeable: prData.mergeable,
						mergeableState: prData.mergeable_state,
						headSha: prData.head.sha,
						baseRef: prData.base.ref,
						headRef: prData.head.ref,
					});
				} catch (error) {
					reject(new Error(`Failed to parse PR data: ${error.message}`));
				}
			} else {
				reject(new Error(`Failed to check PR status: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

async function checkCIStatus(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", "repos/:owner/:repo/commits/:sha/check-runs"];
		if (repo) {
			cmdArgs[1] = `repos/${repo}/commits/:sha/check-runs`;
		}

		// First get the PR to get the head SHA
		checkPRStatus(repo, prNumber)
			.then((prStatus) => {
				const sha = prStatus.headSha;
				cmdArgs[1] = repo
					? `repos/${repo}/commits/${sha}/check-runs`
					: `repos/:owner/:repo/commits/${sha}/check-runs`;

				const child = spawn("gh", cmdArgs, {
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
							const checkData = JSON.parse(stdout);
							const checkRuns = checkData.check_runs || [];

							// Analyze CI status
							const status = {
								overall: "success",
								required: [],
								optional: [],
								stillRunning: [],
								errors: [],
								canMerge: true,
								message: "",
							};

							for (const check of checkRuns) {
								const checkInfo = {
									name: check.name,
									status: check.status,
									conclusion: check.conclusion,
									url: check.html_url,
								};

								if (check.conclusion === "failure" || check.conclusion === "cancelled") {
									status.errors.push(checkInfo);
									status.canMerge = false;
								} else if (check.status === "in_progress" || check.status === "queued") {
									status.stillRunning.push(checkInfo);
									status.canMerge = false;
								} else if (check.conclusion === "success") {
									status.required.push(checkInfo);
								} else {
									status.optional.push(checkInfo);
								}
							}

							// Generate status message
							if (status.errors.length > 0) {
								status.overall = "failure";
								status.message = `CI checks failed: ${status.errors.map((e) => e.name).join(", ")}`;
							} else if (status.stillRunning.length > 0) {
								status.overall = "pending";
								status.message = `CI checks still running: ${status.stillRunning
									.map((e) => e.name)
									.join(", ")}`;
							} else if (status.required.length > 0) {
								status.overall = "success";
								status.message = "All CI checks passed";
							} else {
								status.overall = "no_checks";
								status.message = "No CI checks found";
							}

							resolve(status);
						} catch (error) {
							reject(new Error(`Failed to parse CI data: ${error.message}`));
						}
					} else {
						reject(new Error(`Failed to check CI status: ${stderr.trim()}`));
					}
				});

				child.on("error", (error) => {
					reject(new Error(`Failed to execute GitHub API: ${error.message}`));
				});
			})
			.catch(reject);
	});
}

async function enableAutoMerge(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["pr", "merge", prNumber, "--auto", "--merge"];

		if (repo) {
			cmdArgs.splice(2, 0, "--repo", repo);
		}

		const child = spawn("gh", cmdArgs, {
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
				resolve({ success: true, prNumber, output: stdout.trim() });
			} else {
				reject(new Error(`Failed to enable auto-merge for PR ${prNumber}: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub CLI for PR ${prNumber}: ${error.message}`));
		});
	});
}

async function manualMerge(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["pr", "merge", prNumber, "--merge"];

		if (repo) {
			cmdArgs.splice(2, 0, "--repo", repo);
		}

		const child = spawn("gh", cmdArgs, {
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
				resolve({ success: true, prNumber, output: stdout.trim() });
			} else {
				reject(new Error(`Failed to merge PR ${prNumber}: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub CLI for PR ${prNumber}: ${error.message}`));
		});
	});
}

async function checkExistingApproval(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", "repos/:owner/:repo/pulls/:pull_number/reviews"];
		if (repo) {
			cmdArgs[1] = `repos/${repo}/pulls/${prNumber}/reviews`;
		} else {
			cmdArgs[1] = `repos/:owner/:repo/pulls/${prNumber}/reviews`;
		}

		const child = spawn("gh", cmdArgs, {
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
					const reviews = JSON.parse(stdout);
					// Get current user info
					return getCurrentUser()
						.then((currentUser) => {
							const hasApproved = reviews.some(
								(review) => review.user.login === currentUser.login && review.state === "APPROVED",
							);
							resolve(hasApproved);
						})
						.catch((error) => {
							// If we can't get current user, propagate the error
							reject(error);
						});
				} catch (error) {
					reject(new Error(`Failed to parse reviews data: ${error.message}`));
				}
			} else {
				reject(new Error(`Failed to check existing approvals: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

async function getCurrentUser() {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", "user"];

		const child = spawn("gh", cmdArgs, {
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
					const userData = JSON.parse(stdout);
					resolve(userData);
				} catch (error) {
					reject(new Error(`Failed to parse user data: ${error.message}`));
				}
			} else {
				// Check if it's an authentication error
				if (
					stderr.includes("authentication") ||
					stderr.includes("not authenticated") ||
					stderr.includes("gh auth login")
				) {
					reject(new Error("NOT_AUTHENTICATED"));
				} else {
					reject(new Error(`Failed to get current user: ${stderr.trim()}`));
				}
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

async function approvePR(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["pr", "review", prNumber, "--approve"];

		if (repo) {
			cmdArgs.splice(2, 0, "--repo", repo);
		}

		const child = spawn("gh", cmdArgs, {
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
				resolve({ success: true, prNumber, output: stdout.trim() });
			} else {
				reject(new Error(`Failed to approve PR ${prNumber}: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub CLI for PR ${prNumber}: ${error.message}`));
		});
	});
}

async function main() {
	try {
		const { repo, prNumbers, shouldMerge } = parseArgs();

		const results = [];
		const errors = [];

		// Check repository settings once if merge is requested
		let repoSettings = null;
		if (shouldMerge) {
			try {
				repoSettings = await checkAutoMergeEnabled(repo);
			} catch (error) {
				// Repository settings check failed, proceed without them
			}
		}

		// Process PRs sequentially to avoid overwhelming the API
		for (const prNumber of prNumbers) {
			try {
				// Check if already approved by current user
				let alreadyApproved = false;
				let authWarning = null;

				try {
					alreadyApproved = await checkExistingApproval(repo, prNumber);
				} catch (error) {
					if (error.message === "NOT_AUTHENTICATED") {
						authWarning = "GitHub CLI not authenticated - please run 'gh auth login'";
						alreadyApproved = false; // Assume not approved and proceed
					} else {
						alreadyApproved = false; // Assume not approved and proceed
					}
				}

				let result;
				if (alreadyApproved) {
					result = { success: true, prNumber, output: "Already approved", skipped: true };
				} else {
					result = await approvePR(repo, prNumber);
				}

				// Add auth warning to result if present
				if (authWarning) {
					result.authWarning = authWarning;
				}

				results.push(result);

				// Handle merge validation and execution if requested
				if (shouldMerge) {
					try {
						// Check CI status and PR mergeability
						const ciStatus = await checkCIStatus(repo, prNumber);
						const prStatus = await checkPRStatus(repo, prNumber);

						// Determine merge strategy based on validation
						let mergeStrategy = null;
						let mergeMessage = "";
						let canProceed = true;

						if (repoSettings && repoSettings.linearHistory) {
							// Linear history required - only allow auto-merge
							if (repoSettings.allowAutoMerge) {
								mergeStrategy = "auto-merge";
								mergeMessage = "Linear history required - using auto-merge";
							} else {
								canProceed = false;
								mergeMessage = "Linear history required but auto-merge disabled. Rebase required.";
							}
						} else {
							// No linear history requirement - can use manual merge
							if (ciStatus.overall === "success") {
								mergeStrategy = repoSettings?.allowAutoMerge ? "auto-merge" : "manual-merge";
								mergeMessage = "All checks passed - proceeding with merge";
							} else if (ciStatus.overall === "pending") {
								if (repoSettings?.allowAutoMerge) {
									mergeStrategy = "auto-merge";
									mergeMessage = `CI still running - auto-merge will complete after: ${ciStatus.stillRunning
										.map((c) => c.name)
										.join(", ")}`;
								} else {
									canProceed = false;
									mergeMessage = `CI still running - manual merge blocked. Waiting for: ${ciStatus.stillRunning
										.map((c) => c.name)
										.join(", ")}`;
								}
							} else if (ciStatus.overall === "failure") {
								// Check if we have at least 1 required CI check - allow auto-merge if so
								if (ciStatus.required.length > 0 && repoSettings?.allowAutoMerge) {
									mergeStrategy = "auto-merge";
									mergeMessage = `CI has failures but required checks exist - auto-merge will proceed. Errors: ${ciStatus.errors
										.map((c) => c.name)
										.join(", ")}`;
								} else {
									canProceed = false;
									mergeMessage = `CI failed - merge blocked. Errors: ${ciStatus.errors
										.map((c) => c.name)
										.join(", ")}`;
								}
							} else {
								// No checks found - proceed with caution
								mergeStrategy = repoSettings?.allowAutoMerge ? "auto-merge" : "manual-merge";
								mergeMessage = "No CI checks found - proceeding with merge";
							}
						}

						if (canProceed && mergeStrategy) {
							if (mergeStrategy === "auto-merge") {
								const mergeResult = await enableAutoMerge(repo, prNumber);
								result.mergeResult = {
									strategy: "auto-merge",
									message: mergeMessage,
									ciStatus: ciStatus,
									prStatus: prStatus,
								};
							} else {
								const mergeResult = await manualMerge(repo, prNumber);
								result.mergeResult = {
									strategy: "manual-merge",
									message: mergeMessage,
									ciStatus: ciStatus,
									prStatus: prStatus,
								};
							}
						} else {
							result.mergeResult = {
								strategy: "blocked",
								message: mergeMessage,
								ciStatus: ciStatus,
								prStatus: prStatus,
							};

							// Add to errors if merge was blocked
							const errorResult = {
								prNumber,
								error: `Merge blocked: ${mergeMessage}`,
								ciStatus: ciStatus,
								prStatus: prStatus,
							};
							errors.push(errorResult);
						}
					} catch (error) {
						const errorResult = { prNumber, error: `Merge validation failed: ${error.message}` };
						errors.push(errorResult);
					}
				}
			} catch (error) {
				const errorResult = { prNumber, error: error.message };
				errors.push(errorResult);
			}
		}

		// Output summary with enhanced structure
		const summary = {
			total: prNumbers.length,
			successful: results.length,
			failed: errors.length,
			repositorySettings: shouldMerge ? repoSettings : null,
			results: results,
			errors: errors,
		};

		// Validate output structure before returning
		try {
			const validatedSummary = OutputSchema.parse(summary);
			console.log(JSON.stringify(validatedSummary, null, 2));
		} catch (validationError) {
			console.error("Output validation failed:", validationError.message);
			console.error("Raw output:", JSON.stringify(summary, null, 2));
			process.exit(1);
		}

		// Exit with error code if any PRs failed
		if (errors.length > 0) {
			process.exit(1);
		}
	} catch (error) {
		console.error("Error:", error.message);
		process.exit(1);
	}
}

main();
