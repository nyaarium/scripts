#!/usr/bin/env node

// https://cursor.com/docs/background-agent/api/overview

import { spawn } from "node:child_process";
import https from "node:https";
import { z } from "zod";

// Validation schemas
const ImageSchema = z.object({
	data: z.string().describe(`Base64 encoded image data`),
	dimension: z.object({
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	}),
});

const PromptSchema = z.object({
	text: z.string().describe(`Prompt text`),
	images: z.array(ImageSchema).optional().describe(`Optional images`),
});

const SourceSchema = z.object({
	repository: z.string().url().describe(`GitHub repository URL`),
	ref: z.string().optional().default("main").describe(`Git reference (branch/tag)`),
});

const AgentDataSchema = z.object({
	prompt: PromptSchema,
	source: SourceSchema,
});

const FollowUpDataSchema = z.object({
	prompt: PromptSchema,
});

const AgentIdSchema = z.object({
	agentId: z.string().describe(`The agent ID`),
});

const AddFollowUpInputSchema = z.object({
	agentId: z.string().describe(`The agent ID`),
	prompt: PromptSchema,
});

const EmptySchema = z.object({});

const MergePRInputSchema = z.object({
	agentId: z.string().describe(`The agent ID`),
});

const toolDefinitions = {
	cursorLaunchAgent: {
		name: "cursorLaunchAgent",
		title: `Launch Cursor Background Agent`,
		description: `Launch a NEW Cursor background agent to work on your repository. Use this for starting fresh work.`,
		operation: `launching agent`,
		schema: AgentDataSchema,
		async handler(agentData) {
			const validatedData = AgentDataSchema.parse(agentData);
			return makeRequest("/v0/agents", "POST", validatedData);
		},
	},
	cursorGetAgentStatus: {
		name: "cursorGetAgentStatus",
		title: `Get Cursor Agent Status`,
		description: `Get the current status and results of a Cursor background agent.`,
		operation: `getting agent status`,
		schema: AgentIdSchema,
		async handler({ agentId }) {
			return makeRequest(`/v0/agents/${agentId}`, "GET");
		},
	},
	cursorListAgents: {
		name: "cursorListAgents",
		title: `List Cursor Agents`,
		description: `List all background agents for the authenticated user.`,
		operation: `listing agents`,
		schema: EmptySchema,
		async handler() {
			return makeRequest("/v0/agents", "GET");
		},
	},
	cursorAddFollowUp: {
		name: "cursorAddFollowUp",
		title: `Add Follow-up to Cursor Agent`,
		description: `Add a follow-up instruction to an EXISTING Cursor background agent. Use this to continue work with an agent that's already running or finished.`,
		operation: `adding follow-up`,
		schema: AddFollowUpInputSchema,
		async handler({ agentId, prompt }) {
			const validatedData = FollowUpDataSchema.parse({ prompt });
			return makeRequest(`/v0/agents/${agentId}/followup`, "POST", validatedData);
		},
	},
	cursorDeleteAgent: {
		name: "cursorDeleteAgent",
		title: `Delete Cursor Agent`,
		description: `Delete a Cursor background agent. This action is permanent.`,
		operation: `deleting agent`,
		schema: AgentIdSchema,
		async handler({ agentId }) {
			return makeRequest(`/v0/agents/${agentId}`, "DELETE");
		},
	},
	cursorGetAgentConversation: {
		name: "cursorGetAgentConversation",
		title: `Get Cursor Agent Conversation`,
		description: `Get the conversation history of a Cursor background agent.`,
		operation: `getting conversation`,
		schema: AgentIdSchema,
		async handler({ agentId }) {
			return makeRequest(`/v0/agents/${agentId}/conversation`, "GET");
		},
	},
	cursorListModels: {
		name: "cursorListModels",
		title: `List Cursor Agent Models`,
		description: `List available models for Cursor background agents.`,
		operation: `listing models`,
		schema: EmptySchema,
		async handler() {
			return makeRequest("/v0/models", "GET");
		},
	},
	cursorListRepositories: {
		name: "cursorListRepositories",
		title: `List Cursor Repositories`,
		description: `List GitHub repositories (rate limited: 1/min, 30/hour).`,
		operation: `listing repositories`,
		schema: EmptySchema,
		async handler() {
			return makeRequest("/v0/repositories", "GET");
		},
	},
	cursorWaitUntilDone: {
		name: "cursorWaitUntilDone",
		title: `Wait Until Agent Done`,
		description: `Polls agent status every 30 seconds until it's no longer CREATING or RUNNING.`,
		operation: `waiting for agent completion`,
		schema: AgentIdSchema,
		async handler({ agentId }) {
			const pollInterval = 30000; // 30 seconds
			let status = "CREATING";
			let attempts = 0;
			const maxAttempts = 60; // 30 minutes max wait time

			while ((status === "CREATING" || status === "RUNNING") && attempts < maxAttempts) {
				attempts++;
				const result = await toolDefinitions.cursorGetAgentStatus.handler({ agentId });
				status = result.status;

				if (status === "CREATING" || status === "RUNNING") {
					await new Promise((resolve) => setTimeout(resolve, pollInterval));
				}
			}

			return {
				...result,
				_pollingInfo: {
					attempts,
					totalWaitTimeSeconds: Math.round((attempts * pollInterval) / 1000),
					status: result.status,
				},
			};
		},
	},
	cursorMergePullRequest: {
		name: "cursorMergePullRequest",
		title: `Merge Cursor Agent Pull Request`,
		description: `
Merge a pull request created by a Cursor background agent.

CRITICAL:
You MUST verbally ask the user for explicit confirmation before calling this tool.
Your confirmation message MUST include the repository name (owner/repo) and PR number.
`.trim(),
		operation: `merging pull request`,
		schema: MergePRInputSchema,
		async handler({ agentId }) {
			try {
				// Get agent status to find PR URL
				const agentStatus = await toolDefinitions.cursorGetAgentStatus.handler({ agentId });

				// Check if PR URL exists
				if (!agentStatus.target?.prUrl) {
					return {
						success: false,
						message: "No changes made, nothing to PR.",
						agentStatus,
					};
				}

				// Check GitHub CLI availability
				const ghStatus = await checkGHCLI();
				if (!ghStatus.available) {
					return {
						success: false,
						message: `GitHub CLI not found: ${ghStatus.error}`,
						agentStatus,
					};
				}
				if (!ghStatus.authenticated) {
					return {
						success: false,
						message: `GitHub CLI not authenticated: ${ghStatus.error}`,
						agentStatus,
					};
				}

				// Extract repo info from PR URL
				const repoInfo = extractRepoFromURL(agentStatus.target.prUrl);
				const repo = `${repoInfo.owner}/${repoInfo.repo}`;

				// Collect comprehensive PR stats
				const prStats = await collectPRStats(repo, repoInfo.prNumber);

				// Check PR state
				if (prStats.merged) {
					return {
						success: false,
						message: "This PR has already been merged.",
						agentStatus,
						prStats,
					};
				}
				if (prStats.state !== "open") {
					return {
						success: false,
						message: "This PR has been canceled.",
						agentStatus,
						prStats,
					};
				}

				// Get repository settings
				const repoSettings = await checkRepositorySettings(repo);

				// Attempt rebase
				const rebaseResult = await attemptRebase(repo, repoInfo.prNumber);
				if (!rebaseResult.success) {
					if (rebaseResult.needsManualRebase) {
						return {
							success: false,
							message: `Cannot rebase to \`${prStats.baseRef}\` due to conflicts. Recommended course of action is to use \`cursorAddFollowUp\` asking it to "Resolve the conflicts of rebasing \`${prStats.headRef}\` onto \`${prStats.baseRef}\`. Confirm it's in working order, then force push \`${prStats.headRef}\`."`,
							agentStatus,
							prStats,
							repoSettings,
							rebaseError: rebaseResult.error,
						};
					} else {
						return {
							success: false,
							message: `Rebase failed: ${rebaseResult.error}`,
							agentStatus,
							prStats,
							repoSettings,
						};
					}
				}

				// Merge the PR
				const useAutoMerge = repoSettings.allowAutoMerge;
				const mergeResult = await mergePR(repo, repoInfo.prNumber, useAutoMerge);

				return {
					success: true,
					message: `Successfully ${useAutoMerge ? "auto-merged" : "merged"} PR #${repoInfo.prNumber}`,
					agentStatus,
					prStats,
					repoSettings,
					rebaseResult,
					mergeResult,
				};
			} catch (error) {
				return {
					success: false,
					message: `Error merging PR: ${error.message}`,
					error: error.message,
				};
			}
		},
	},
};

export const toolsCursorAgent = Object.values(toolDefinitions);

// Helper function to check if GitHub CLI is available and authenticated
async function checkGHCLI() {
	return new Promise((resolve) => {
		const child = spawn("gh", ["auth", "status"], {
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
				resolve({ available: true, authenticated: true });
			} else {
				if (stderr.includes("not authenticated") || stderr.includes("gh auth login")) {
					resolve({ available: true, authenticated: false, error: "GitHub CLI not authenticated" });
				} else {
					resolve({ available: false, authenticated: false, error: "GitHub CLI not found" });
				}
			}
		});

		child.on("error", () => {
			resolve({ available: false, authenticated: false, error: "GitHub CLI not found" });
		});
	});
}

// Helper function to extract repo info from GitHub PR URL
function extractRepoFromURL(prUrl) {
	const match = prUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
	if (!match) {
		throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
	}
	return {
		owner: match[1],
		repo: match[2],
		prNumber: match[3],
	};
}

// Helper function to collect comprehensive PR statistics
async function collectPRStats(repo, prNumber) {
	return new Promise((resolve, reject) => {
		// Get PR details
		const cmdArgs = ["api", `repos/${repo}/pulls/${prNumber}`];
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
						exists: true,
						state: prData.state,
						merged: prData.merged,
						mergeable: prData.mergeable,
						mergeableState: prData.mergeable_state,
						headSha: prData.head.sha,
						baseRef: prData.base.ref,
						headRef: prData.head.ref,
						title: prData.title,
						url: prData.html_url,
					});
				} catch (error) {
					reject(new Error(`Failed to parse PR data: ${error.message}`));
				}
			} else {
				reject(new Error(`Failed to get PR details: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

// Helper function to check repository settings
async function checkRepositorySettings(repo) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", `repos/${repo}`];
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
					});
				} catch (error) {
					reject(new Error(`Failed to parse repository data: ${error.message}`));
				}
			} else {
				reject(new Error(`Failed to check repository settings: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute GitHub API: ${error.message}`));
		});
	});
}

// Helper function to attempt rebase
async function attemptRebase(repo, prNumber) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["api", `repos/${repo}/pulls/${prNumber}/update-branch`, "--method", "PUT"];
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
				resolve({ success: true });
			} else {
				// Parse error details from gh CLI output
				const errorMsg = stderr.trim();
				const needsManualRebase = errorMsg.includes("conflict") || errorMsg.includes("merge conflict");
				resolve({
					success: false,
					needsManualRebase,
					error: errorMsg,
				});
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute rebase: ${error.message}`));
		});
	});
}

// Helper function to merge PR
async function mergePR(repo, prNumber, useAutoMerge = false) {
	return new Promise((resolve, reject) => {
		const cmdArgs = ["pr", "merge", prNumber, "--merge"];
		if (useAutoMerge) {
			cmdArgs.splice(2, 0, "--auto");
		}
		cmdArgs.splice(2, 0, "--repo", repo);

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
				resolve({ success: true, output: stdout.trim() });
			} else {
				reject(new Error(`Failed to merge PR: ${stderr.trim()}`));
			}
		});

		child.on("error", (error) => {
			reject(new Error(`Failed to execute merge: ${error.message}`));
		});
	});
}

function makeRequest(endpoint, method, data = null) {
	const apiKey = process.env.CURSOR_AGENT_KEY;
	if (!apiKey) {
		return Promise.reject(new Error("CURSOR_AGENT_KEY environment variable is not set"));
	}

	return new Promise((resolve, reject) => {
		const options = {
			hostname: "api.cursor.com",
			path: endpoint,
			method: method,
			headers: {
				"Authorization": `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
		};

		const req = https.request(options, (res) => {
			let body = "";
			res.on("data", (chunk) => {
				body += chunk;
			});
			res.on("end", () => {
				try {
					const responseData = body ? JSON.parse(body) : {};
					if (res.statusCode >= 200 && res.statusCode < 300) {
						resolve(responseData);
					} else {
						reject(
							new Error(
								`Request failed with status code ${res.statusCode}: ${responseData.message || body}`,
							),
						);
					}
				} catch (parseError) {
					reject(new Error(`Failed to parse response: ${parseError.message}`));
				}
			});
		});

		req.on("error", (err) => {
			reject(new Error(`Request failed: ${err.message}`));
		});

		if (data) {
			req.write(JSON.stringify(data));
		}

		req.end();
	});
}
