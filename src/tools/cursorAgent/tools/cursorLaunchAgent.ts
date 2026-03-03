import { makeRequest } from "../lib/makeRequest.ts";
import { AgentDataSchema } from "../lib/schemas.ts";

export const cursorLaunchAgent = {
	name: "cursorLaunchAgent",
	title: "Launch Cursor Background Agent",
	description: "Launch a NEW Cursor background agent to work on your repository. Use this for starting fresh work.",
	operation: "launching agent",
	schema: AgentDataSchema,
	async handler(_cwd: string, params: Record<string, unknown>): Promise<unknown> {
		const validatedData = AgentDataSchema.parse(params);
		return makeRequest("/v0/agents", "POST", validatedData);
	},
};
