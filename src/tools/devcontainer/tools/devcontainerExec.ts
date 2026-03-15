import { z } from "zod";
import { assertWSLHost, ensureContainerUp, execInContainer, resolveProject } from "../lib/helpers.ts";

const schema = z.object({
	projectPath: z.string().describe("Path to the project directory. Absolute or relative to ~/."),
	command: z.string().describe("Shell command to execute inside the devcontainer"),
	background: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			`
If true, runs the command in a persistent tmux session inside the container.
The process will keep running after this tool returns.
`.trim(),
		),
	tmuxSession: z
		.string()
		.optional()
		.default("host-to-container")
		.describe("Tmux session name for background mode. Defaults to 'host-to-container'."),
});

export const devcontainerExec = {
	name: "devcontainerExec",
	title: "Devcontainer Exec",
	description: `
Execute a shell command inside a project's devcontainer.
Automatically starts the container if needed.
Set background: true to run in a persistent tmux session that survives after this tool returns.
`.trim(),
	schema,
	async handler(_cwd: string, rawArgs: Record<string, unknown>): Promise<unknown> {
		const args = schema.parse(rawArgs);
		assertWSLHost();
		const projectPath = resolveProject(args.projectPath);

		ensureContainerUp(projectPath);

		if (!args.background) {
			const output = await execInContainer(projectPath, ["bash", "-c", args.command]);
			return { output };
		}

		// Background mode: ensure tmux session exists, send command via base64 to avoid escaping issues
		const session = args.tmuxSession || "host-to-container";
		const b64 = Buffer.from(args.command).toString("base64");
		const script = [
			`tmux has-session -t '${session}' 2>/dev/null || tmux new-session -d -s '${session}'`,
			`tmux send-keys -t '${session}' -l "$(echo '${b64}' | base64 -d)"`,
			`tmux send-keys -t '${session}' Enter`,
		].join(" && ");

		await execInContainer(projectPath, ["bash", "-c", script]);
		return {
			status: "started_in_background",
			tmuxSession: session,
			command: args.command,
			hint: `
To check output, use this tool with command: tmux capture-pane -t '${session}' -p -S -50
To send input, use: tmux send-keys -t '${session}' 'your input' Enter
To stop the process, use: tmux send-keys -t '${session}' C-c
`.trim(),
		};
	},
};
