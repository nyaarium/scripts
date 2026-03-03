import { makeRequest } from "../lib/makeRequest.ts";
import { AgentIdSchema } from "../lib/schemas.ts";
import type { z } from "zod";

type AgentIdInput = z.infer<typeof AgentIdSchema>;

export const cursorDeleteAgent = {
	name: "cursorDeleteAgent",
	title: "Delete Cursor Agent",
	description: "Delete a Cursor background agent. This action is permanent.",
	operation: "deleting agent",
	schema: AgentIdSchema,
	async handler(_cwd: string, params: Record<string, unknown>): Promise<unknown> {
		const { agentId } = AgentIdSchema.parse(params) as AgentIdInput;
		return makeRequest(`/v0/agents/${agentId}`, "DELETE");
	},
};
