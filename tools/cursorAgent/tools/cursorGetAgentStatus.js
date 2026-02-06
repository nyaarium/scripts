import { makeRequest } from "../lib/makeRequest.js";
import { AgentIdSchema } from "../lib/schemas.js";

export const cursorGetAgentStatus = {
	name: "cursorGetAgentStatus",
	title: "Get Cursor Agent Status",
	description: "Get the current status and results of a Cursor background agent.",
	operation: "getting agent status",
	schema: AgentIdSchema,
	async handler(cwd, params) {
		const { agentId } = AgentIdSchema.parse(params);
		return makeRequest(`/v0/agents/${agentId}`, "GET");
	},
};
