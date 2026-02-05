import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { checkGHCLI } from "../lib/checkGHCLI.js";
import { getWorkspaceRoot } from "../lib/getWorkspaceRoot.js";
import {
	InputCommitSchema,
	OutputCommitSchema,
	OutputInfoSchema,
	normalizeCommitMessage,
} from "../lib/schemas.js";

export const githubFetchCommit = {
	name: "githubFetchCommit",
	title: "github-fetch-commit",
	description: "Fetch GitHub commit data.",
	operation: "fetching commit",
	schema: z.object({
		repo: z
			.string()
			.optional()
			.describe(
				"Repository in owner/repo format (ex: microsoft/vscode). If not provided, uses current repository.",
			),
		commitHash: z.string().describe("The commit hash to fetch (full or short)."),
		outputPath: z
			.string()
			.optional()
			.describe(
				"Optional path to write JSON output (relative or absolute). If provided, returns path info instead of full data.",
			),
	}),
	async handler({ repo, commitHash, outputPath }) {
		const ghStatus = await checkGHCLI();
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		const data = await new Promise((resolve, reject) => {
			const apiArgs = repo
				? ["api", `repos/${repo}/commits/${commitHash}`]
				: ["api", "repos/:owner/:repo/commits/" + commitHash];
			const child = spawn("gh", apiArgs, {
				stdio: ["ignore", "pipe", "pipe"],
				cwd: getWorkspaceRoot(),
			});
			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (d) => { stdout += d.toString(); });
			child.stderr.on("data", (d) => { stderr += d.toString(); });

			child.on("close", (code) => {
				if (code !== 0) {
					reject(new Error(`GitHub API failed with code ${code}: ${stderr.trim()}`));
					return;
				}
				try {
					const rawData = JSON.parse(stdout);
					const validatedData = InputCommitSchema.parse(rawData);
					const messageLines = validatedData.commit.message.split("\n");
					const messageHeadline = messageLines[0];
					const messageBody = messageLines.slice(1).join("\n").trim() || null;
					const message = normalizeCommitMessage(messageHeadline, messageBody);

					const transformedData = {
						id: validatedData.sha,
						date: validatedData.commit.author.date,
						author: validatedData.commit.author.name,
						message,
						files: validatedData.files.map((file) => ({
							filename: file.filename,
							status: file.status,
							urlWeb: file.blob_url,
							urlRaw: file.raw_url,
							patch: file.patch || null,
						})),
					};
					const validatedCommitData = OutputCommitSchema.parse(transformedData);

					if (outputPath) {
						const outputPathAbs = resolve(outputPath);
						writeFileSync(outputPathAbs, JSON.stringify(validatedCommitData, null, 2));
						resolve(OutputInfoSchema.parse({ outputPath, outputPathAbs }));
					} else {
						resolve(validatedCommitData);
					}
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				}
			});

			child.on("error", (err) => reject(err));
		});

		return { data };
	},
};
