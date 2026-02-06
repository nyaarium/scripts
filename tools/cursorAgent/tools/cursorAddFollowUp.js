import { makeRequest } from "../lib/makeRequest.js";
import { AddFollowUpInputSchema, FollowUpDataSchema } from "../lib/schemas.js";

export const cursorAddFollowUp = {
	name: "cursorAddFollowUp",
	title: "Add Follow-up to Cursor Agent",
	description:
		"Add a follow-up instruction to an EXISTING Cursor background agent. Use this to continue work with an agent that's already running or finished.",
	operation: "adding follow-up",
	schema: AddFollowUpInputSchema,
	async handler(cwd, { agentId, prompt }) {
		const validatedData = FollowUpDataSchema.parse({ prompt });
		return makeRequest(`/v0/agents/${agentId}/followup`, "POST", validatedData);
	},
};
