import type { z } from "zod";
import { makeRequest } from "../lib/makeRequest.ts";
import { AgentIdSchema } from "../lib/schemas.ts";

type AgentIdInput = z.infer<typeof AgentIdSchema>;

export const cursorGetAgentStatus = {
	name: "cursorGetAgentStatus",
	title: "Get Cursor Agent Status",
	description: "Get the current status and results of a Cursor background agent.",
	operation: "getting agent status",
	schema: AgentIdSchema,
	async handler(_cwd: string, params: Record<string, unknown>): Promise<unknown> {
		const { agentId } = AgentIdSchema.parse(params) as AgentIdInput;
		return makeRequest(`/v0/agents/${agentId}`, "GET");
	},
};
