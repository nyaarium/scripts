#!/usr/bin/env node

// https://cursor.com/docs/background-agent/api/overview

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
};

export const toolsCursorAgent = Object.values(toolDefinitions);

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
