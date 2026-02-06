import { cursorGetAgentStatus } from "./cursorGetAgentStatus.js";
import { AgentIdSchema } from "../lib/schemas.js";

const pollInterval = 30000;
const maxAttempts = 60;

export const cursorWaitUntilDone = {
	name: "cursorWaitUntilDone",
	title: "Wait Until Agent Done",
	description: "Polls agent status every 30 seconds until it's no longer CREATING or RUNNING.",
	operation: "waiting for agent completion",
	schema: AgentIdSchema,
	async handler(cwd, params) {
		const { agentId } = AgentIdSchema.parse(params);
		let status = "CREATING";
		let attempts = 0;

		while ((status === "CREATING" || status === "RUNNING") && attempts < maxAttempts) {
			attempts++;
			const result = await cursorGetAgentStatus.handler(cwd, { agentId });
			status = result.status;
			if (status === "CREATING" || status === "RUNNING") {
				await new Promise((r) => setTimeout(r, pollInterval));
			}
		}

		const finalResult = await cursorGetAgentStatus.handler(cwd, { agentId });
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
