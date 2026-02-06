import { makeRequest } from "../lib/makeRequest.js";
import { AgentIdSchema } from "../lib/schemas.js";

export const cursorDeleteAgent = {
	name: "cursorDeleteAgent",
	title: "Delete Cursor Agent",
	description: "Delete a Cursor background agent. This action is permanent.",
	operation: "deleting agent",
	schema: AgentIdSchema,
	async handler(cwd, params) {
		const { agentId } = AgentIdSchema.parse(params);
		return makeRequest(`/v0/agents/${agentId}`, "DELETE");
	},
};
