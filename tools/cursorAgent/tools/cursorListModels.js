import { makeRequest } from "../lib/makeRequest.js";
import { EmptySchema } from "../lib/schemas.js";

export const cursorListModels = {
	name: "cursorListModels",
	title: "List Cursor Agent Models",
	description: "List available models for Cursor background agents.",
	operation: "listing models",
	schema: EmptySchema,
	async handler(cwd) {
		return makeRequest("/v0/models", "GET");
	},
};
