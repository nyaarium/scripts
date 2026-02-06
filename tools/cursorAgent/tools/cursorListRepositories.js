import { makeRequest } from "../lib/makeRequest.js";
import { EmptySchema } from "../lib/schemas.js";

export const cursorListRepositories = {
	name: "cursorListRepositories",
	title: "List Cursor Repositories",
	description: "List GitHub repositories (rate limited: 1/min, 30/hour).",
	operation: "listing repositories",
	schema: EmptySchema,
	async handler(cwd) {
		return makeRequest("/v0/repositories", "GET");
	},
};
