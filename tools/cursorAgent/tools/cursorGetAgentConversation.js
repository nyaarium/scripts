import { makeRequest } from "../lib/makeRequest.js";
import { AgentIdSchema } from "../lib/schemas.js";

export const cursorGetAgentConversation = {
	name: "cursorGetAgentConversation",
	title: "Get Cursor Agent Conversation",
	description: "Get the conversation history of a Cursor background agent.",
	operation: "getting conversation",
	schema: AgentIdSchema,
	async handler(params) {
		const { agentId } = AgentIdSchema.parse(params);
		return makeRequest(`/v0/agents/${agentId}/conversation`, "GET");
	},
};
