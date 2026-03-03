import { makeRequest } from "../lib/makeRequest.ts";
import { EmptySchema } from "../lib/schemas.ts";

export const cursorListAgents = {
	name: "cursorListAgents",
	title: "List Cursor Agents",
	description: "List all background agents for the authenticated user.",
	operation: "listing agents",
	schema: EmptySchema,
	async handler(_cwd: string): Promise<unknown> {
		return makeRequest("/v0/agents", "GET");
	},
};
