import crypto from "node:crypto";
import { z } from "zod";
import {
	AGENT_TYPES,
	assertWSLHost,
	buildAgentCommand,
	EFFORT_LEVELS,
	ensureContainerUp,
	execInContainer,
	resolveModel,
	resolveProject,
} from "../lib/helpers.ts";

const SAFE_ID = /^[a-f0-9-]+$/i;
const CHAT_DIR = "/tmp/devcontainer-chat";
const INITIAL_WAIT_MS = 120_000;
const POLL_WAIT_MS = 60_000;
const POLL_INTERVAL_MS = 5_000;

const schema = z.object({
	projectPath: z.string().describe("Path to the project directory. Absolute or relative to ~/."),
	prompt: z
		.string()
		.optional()
		.describe(
			`
Full markdown prompt to send.
Required for new chats and follow-ups.
Omit only when polling with jobId.
`.trim(),
		),
	jobId: z
		.string()
		.optional()
		.describe(
			`
Job ID returned when a previous call timed out with status "running".
Provide this with projectPath (no prompt) to poll for the result.
`.trim(),
		),
	sessionId: z
		.string()
		.optional()
		.describe(
			`
Session ID returned in a previous response.
Pass it back along with a new prompt to continue the same conversation.
Omit to start a fresh conversation.
`.trim(),
		),
	agent: z.enum(AGENT_TYPES).describe(
		`
Agent CLI to use: claude, cursor, copilot, or codex.
Try claude first. If it is not installed in the container, use devcontainerExec to run "which claude cursor copilot codex" to see which are available.
`.trim(),
	),
	effort: z
		.enum(EFFORT_LEVELS)
		.describe("Effort level: simple, standard, or complex. Controls which model the agent uses."),
});

export const devcontainerChat = {
	name: "devcontainerChat",
	title: "Devcontainer Chat",
	description: `
Send a prompt to an agent CLI inside a project's devcontainer.
Automatically starts the container if needed.
Supports claude, cursor, copilot, and codex agents.

Three call patterns:
1. New chat: provide projectPath + prompt + agent + effort. Returns response, sessionId, and jobId.
2. Follow-up: provide projectPath + prompt + agent + effort + sessionId (from a previous response). Continues the same conversation.
3. Poll a running job: provide projectPath + jobId only (no prompt). Checks if the job finished.

The response includes a sessionId. Pass it back with your next prompt to continue the conversation.
If the job takes longer than 2 minutes, status will be "running" with a jobId. Call again with that jobId to check.
`.trim(),
	schema,
	async handler(_cwd: string, rawArgs: Record<string, unknown>): Promise<unknown> {
		const args = schema.parse(rawArgs);
		assertWSLHost();
		const projectPath = resolveProject(args.projectPath);

		ensureContainerUp(projectPath);

		// Poll mode: check on existing job
		if (args.jobId) {
			if (!SAFE_ID.test(args.jobId)) throw new Error("Invalid jobId.");
			return await pollJob(projectPath, args.jobId, POLL_WAIT_MS);
		}

		// Start mode: launch new job
		if (!args.prompt) {
			throw new Error("Provide either prompt (start new job) or jobId (poll existing job).");
		}

		const model = resolveModel(args.agent, args.effort);

		const jobId = crypto.randomUUID();
		const sessionId = args.sessionId || crypto.randomUUID();
		const isFollowUp = !!args.sessionId;

		if (isFollowUp && !SAFE_ID.test(sessionId)) {
			throw new Error("Invalid sessionId format.");
		}

		// 1. Write prompt into container /tmp via stdin pipe (no temp files in workspace)
		const writeCmd = `mkdir -p ${CHAT_DIR}/${jobId} && cat > ${CHAT_DIR}/${jobId}/prompt.md`;
		await execInContainer(projectPath, ["bash", "-c", writeCmd], 30_000, args.prompt);

		// 2. Build the agent-specific command and write runner script
		const agentCmd = buildAgentCommand(
			args.agent,
			model,
			sessionId,
			isFollowUp,
			`${CHAT_DIR}/${jobId}/prompt.md`,
			`${CHAT_DIR}/${jobId}/response.txt`,
			`${CHAT_DIR}/${jobId}/stderr.txt`,
		);
		const setupCmd = [
			`cat > ${CHAT_DIR}/${jobId}/run.sh << 'ENDSCRIPT'`,
			"#!/bin/bash",
			agentCmd,
			`echo $? > ${CHAT_DIR}/${jobId}/exit.txt`,
			`rm -f ${CHAT_DIR}/${jobId}/prompt.md`,
			"ENDSCRIPT",
			`chmod +x ${CHAT_DIR}/${jobId}/run.sh`,
			`tmux new-session -d -s 'chat-${jobId}' ${CHAT_DIR}/${jobId}/run.sh`,
		].join("\n");
		await execInContainer(projectPath, ["bash", "-c", setupCmd]);

		// 3. Wait for completion, return early if fast
		const result = await pollJob(projectPath, jobId, INITIAL_WAIT_MS);
		return { ...result, sessionId };
	},
};

async function pollJob(projectPath: string, jobId: string, waitMs: number): Promise<Record<string, unknown>> {
	const exitFile = `${CHAT_DIR}/${jobId}/exit.txt`;
	const responseFile = `${CHAT_DIR}/${jobId}/response.txt`;
	const stderrFile = `${CHAT_DIR}/${jobId}/stderr.txt`;
	const deadline = Date.now() + waitMs;

	while (Date.now() < deadline) {
		try {
			const exitCode = await execInContainer(projectPath, ["bash", "-c", `cat ${exitFile}`], 10_000);

			// Job completed — read output
			let response = "";
			try {
				response = await execInContainer(projectPath, ["bash", "-c", `cat ${responseFile}`], 10_000);
			} catch {
				/* empty response */
			}

			let stderr = "";
			try {
				stderr = await execInContainer(projectPath, ["bash", "-c", `cat ${stderrFile}`], 10_000);
			} catch {
				/* no stderr */
			}

			// Cleanup
			await execInContainer(projectPath, ["bash", "-c", `rm -rf ${CHAT_DIR}/${jobId}`], 10_000).catch(() => {});

			const code = Number.parseInt(exitCode.trim(), 10);
			if (code !== 0) {
				return { jobId, status: "error", exitCode: code, response, stderr };
			}
			return {
				jobId,
				status: "completed",
				response,
				hint: "To send a follow-up message, call this tool again with projectPath + prompt + sessionId.",
			};
		} catch {
			// exit file doesn't exist yet — still running
		}

		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}

	// Still running
	return {
		jobId,
		status: "running",
		hint: `
The job is still running inside the container.
To check again, call this tool with projectPath + jobId (no prompt).
You may also let the user know it is still in progress.
`.trim(),
	};
}
