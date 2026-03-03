import { makeRequest } from "../lib/makeRequest.ts";
import { AgentIdSchema } from "../lib/schemas.ts";
import type { z } from "zod";

type AgentIdInput = z.infer<typeof AgentIdSchema>;

export const cursorGetAgentConversation = {
	name: "cursorGetAgentConversation",
	title: "Get Cursor Agent Conversation",
	description: "Get the conversation history of a Cursor background agent.",
	operation: "getting conversation",
	schema: AgentIdSchema,
	async handler(_cwd: string, params: Record<string, unknown>): Promise<unknown> {
		const { agentId } = AgentIdSchema.parse(params) as AgentIdInput;
		return makeRequest(`/v0/agents/${agentId}/conversation`, "GET");
	},
};
