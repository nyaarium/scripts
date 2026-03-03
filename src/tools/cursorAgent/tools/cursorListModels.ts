import { makeRequest } from "../lib/makeRequest.ts";
import { EmptySchema } from "../lib/schemas.ts";

export const cursorListModels = {
	name: "cursorListModels",
	title: "List Cursor Agent Models",
	description: "List available models for Cursor background agents.",
	operation: "listing models",
	schema: EmptySchema,
	async handler(_cwd: string): Promise<unknown> {
		return makeRequest("/v0/models", "GET");
	},
};
