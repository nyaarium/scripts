import type { z } from "zod";
import { AgentIdSchema } from "../lib/schemas.ts";
import { cursorGetAgentStatus } from "./cursorGetAgentStatus.ts";

type AgentIdInput = z.infer<typeof AgentIdSchema>;

const pollInterval = 30000;
const maxAttempts = 60;

export const cursorWaitUntilDone = {
	name: "cursorWaitUntilDone",
	title: "Wait Until Agent Done",
	description: "Polls agent status every 30 seconds until it's no longer CREATING or RUNNING.",
	operation: "waiting for agent completion",
	schema: AgentIdSchema,
	async handler(cwd: string, params: Record<string, unknown>): Promise<unknown> {
		const { agentId } = AgentIdSchema.parse(params) as AgentIdInput;
		let status = "CREATING";
		let attempts = 0;

		while ((status === "CREATING" || status === "RUNNING") && attempts < maxAttempts) {
			attempts++;
			const result = (await cursorGetAgentStatus.handler(cwd, { agentId })) as { status: string };
			status = result.status;
			if (status === "CREATING" || status === "RUNNING") {
				await new Promise((r) => setTimeout(r, pollInterval));
			}
		}

		// Fetch once more after the loop to capture the final state (the loop exits before fetching when status is terminal).
		const finalResult = (await cursorGetAgentStatus.handler(cwd, { agentId })) as { status: string };
		return {
			...finalResult,
			_pollingInfo: {
				attempts,
				totalWaitTimeSeconds: Math.round((attempts * pollInterval) / 1000),
				status: finalResult.status,
			},
		};
	},
};
