import { spawn } from "node:child_process";
import { z } from "zod";
import { getWorkspaceRoot } from "./getWorkspaceRoot.js";

export const InputAuthorSchema = z.object({
	login: z.string(),
	name: z.string().nullable().optional(),
});

export const InputFileSchema = z.object({
	filename: z.string(),
	status: z.string(),
	blob_url: z.string(),
	raw_url: z.string(),
	patch: z.string().nullable().optional(),
});

export const InputCommitSchema = z.object({
	sha: z.string(),
	commit: z.object({
		author: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
		committer: z.object({
			name: z.string(),
			email: z.string(),
			date: z.string(),
		}),
		message: z.string(),
	}),
	author: InputAuthorSchema.nullable().optional(),
	committer: InputAuthorSchema.nullable().optional(),
	files: z.array(InputFileSchema),
	stats: z
		.object({
			total: z.number(),
			additions: z.number(),
			deletions: z.number(),
		})
		.optional(),
});

export const OutputFileSchema = z.object({
	filename: z.string(),
	status: z.string(),
	urlWeb: z.string(),
	urlRaw: z.string(),
	patch: z.string().nullable().optional(),
});

export const OutputCommitSchema = z.object({
	id: z.string(),
	date: z.string(),
	author: z.string(),
	message: z.string(),
	files: z.array(OutputFileSchema),
});

export const OutputInfoSchema = z.object({
	outputPath: z.string(),
	outputPathAbs: z.string(),
});

export function normalizeCommitMessage(headline, body) {
	const dependabotPatterns = [/^Bump .+ from .+ to .+$/i, /^Bump .+ group with .+$/i, /from .+\/dependabot\//i];
	const isDependabot = dependabotPatterns.some((p) => p.test(headline) || (body && p.test(body)));
	const message = body ? `${headline}\n${body}`.trim() : headline.trim();
	return isDependabot ? headline.trim() : message;
}

export function fetchCommitViaGh(repo, commitHash) {
	return new Promise((resolve, reject) => {
		const apiArgs = repo
			? ["api", `repos/${repo}/commits/${commitHash}`]
			: ["api", "repos/:owner/:repo/commits/" + commitHash];
		const child = spawn("gh", apiArgs, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd: getWorkspaceRoot(),
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});
		child.on("close", (code) => {
			if (code === 0) {
				try {
					const raw = JSON.parse(stdout);
					resolve(InputCommitSchema.parse(raw));
				} catch (e) {
					reject(new Error(`Parse commit: ${e.message}`));
				}
			} else {
				reject(new Error(`gh api failed ${code}: ${stderr.trim()}`));
			}
		});
		child.on("error", (e) => reject(e));
	});
}
