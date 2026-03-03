import { makeRequest } from "../lib/makeRequest.ts";
import { AddFollowUpInputSchema, FollowUpDataSchema } from "../lib/schemas.ts";
import type { z } from "zod";

type AddFollowUpInput = z.infer<typeof AddFollowUpInputSchema>;

export const cursorAddFollowUp = {
	name: "cursorAddFollowUp",
	title: "Add Follow-up to Cursor Agent",
	description:
		"Add a follow-up instruction to an EXISTING Cursor background agent. Use this to continue work with an agent that's already running or finished.",
	operation: "adding follow-up",
	schema: AddFollowUpInputSchema,
	async handler(_cwd: string, params: Record<string, unknown>): Promise<unknown> {
		const { agentId, prompt } = AddFollowUpInputSchema.parse(params) as AddFollowUpInput;
		const validatedData = FollowUpDataSchema.parse({ prompt });
		return makeRequest(`/v0/agents/${agentId}/followup`, "POST", validatedData);
	},
};
