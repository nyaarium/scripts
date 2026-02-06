import { makeRequest } from "../lib/makeRequest.js";
import { EmptySchema } from "../lib/schemas.js";

export const cursorListAgents = {
	name: "cursorListAgents",
	title: "List Cursor Agents",
	description: "List all background agents for the authenticated user.",
	operation: "listing agents",
	schema: EmptySchema,
	async handler(cwd) {
		return makeRequest("/v0/agents", "GET");
	},
};
