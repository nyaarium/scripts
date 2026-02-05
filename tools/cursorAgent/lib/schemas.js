import { z } from "zod";

export const ImageSchema = z.object({
	data: z.string().describe("Base64 encoded image data"),
	dimension: z.object({
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	}),
});

export const PromptSchema = z.object({
	text: z.string().describe("Prompt text"),
	images: z.array(ImageSchema).optional().describe("Optional images"),
});

export const SourceSchema = z.object({
	repository: z.string().url().describe("GitHub repository URL"),
	ref: z.string().optional().default("main").describe("Git reference (branch/tag)"),
});

export const AgentDataSchema = z.object({
	prompt: PromptSchema,
	source: SourceSchema,
});

export const FollowUpDataSchema = z.object({
	prompt: PromptSchema,
});

export const AgentIdSchema = z.object({
	agentId: z.string().describe("The agent ID"),
});

export const AddFollowUpInputSchema = z.object({
	agentId: z.string().describe("The agent ID"),
	prompt: PromptSchema,
});

export const EmptySchema = z.object({});

export const MergePRInputSchema = z.object({
	agentId: z.string().describe("The agent ID"),
});
