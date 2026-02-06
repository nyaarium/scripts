import { makeRequest } from "../lib/makeRequest.js";
import { AgentDataSchema } from "../lib/schemas.js";

export const cursorLaunchAgent = {
	name: "cursorLaunchAgent",
	title: "Launch Cursor Background Agent",
	description: "Launch a NEW Cursor background agent to work on your repository. Use this for starting fresh work.",
	operation: "launching agent",
	schema: AgentDataSchema,
	async handler(cwd, params) {
		const validatedData = AgentDataSchema.parse(params);
		return makeRequest("/v0/agents", "POST", validatedData);
	},
};
