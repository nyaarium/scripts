import { makeRequest } from "../lib/makeRequest.ts";
import { EmptySchema } from "../lib/schemas.ts";

export const cursorListRepositories = {
	name: "cursorListRepositories",
	title: "List Cursor Repositories",
	description: "List GitHub repositories (rate limited: 1/min, 30/hour).",
	operation: "listing repositories",
	schema: EmptySchema,
	async handler(_cwd: string): Promise<unknown> {
		return makeRequest("/v0/repositories", "GET");
	},
};
