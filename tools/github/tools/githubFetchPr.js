import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { checkGHCLI } from "../lib/checkGHCLI.js";
import {
	InputAuthorSchema,
	InputCommitSchema,
	OutputFileSchema,
	OutputInfoSchema,
	fetchCommitViaGh,
	normalizeCommitMessage,
} from "../lib/schemas.js";

const InputMergeCommitSchema = z.object({ oid: z.string() });
const InputPRCommentSchema = z.object({
	id: z.string(),
	author: InputAuthorSchema,
	body: z.string(),
	createdAt: z.string(),
	updatedAt: z.string().nullable().optional(),
});
const InputPRStatusCheckSchema = z.object({
	__typename: z.string(),
	completedAt: z.string().nullable().optional(),
	conclusion: z.string().nullable().optional(),
	detailsUrl: z.string().nullable().optional(),
	name: z.string(),
	startedAt: z.string().nullable().optional(),
	status: z.string(),
	workflowName: z.string().nullable().optional(),
});
const InputPRCommitSchema = z.object({
	oid: z.string(),
	committedDate: z.string(),
	messageHeadline: z.string(),
	messageBody: z.string().nullable(),
	authors: z.array(InputAuthorSchema).optional(),
});
const InputPRListSchema = z.object({
	number: z.number(),
	state: z.string(),
	author: InputAuthorSchema,
	title: z.string(),
	body: z.string().nullable().optional(),
	comments: z.array(InputPRCommentSchema).optional(),
	mergeStateStatus: z.string().optional(),
	mergedAt: z.string().nullable().optional(),
	mergeCommit: InputMergeCommitSchema.nullable().optional(),
	commits: z.array(InputPRCommitSchema).optional(),
	statusCheckRollup: z.array(InputPRStatusCheckSchema).nullable().optional(),
});
const InputPRSchema = z.object({
	state: z.string(),
	author: InputAuthorSchema,
	title: z.string(),
	body: z.string().nullable(),
	comments: z.array(InputPRCommentSchema),
	mergeStateStatus: z.string(),
	mergedAt: z.string().nullable(),
	mergeCommit: InputMergeCommitSchema.nullable(),
	commits: z.array(InputPRCommitSchema),
	statusCheckRollup: z.array(InputPRStatusCheckSchema).nullable().optional(),
});

const OutputPRAuthorSchema = z.object({
	login: z.string(),
	name: z.string().nullable().optional(),
});
const OutputPRCommentSchema = z.object({
	id: z.string(),
	author: OutputPRAuthorSchema,
	body: z.string(),
	createdAt: z.string(),
	updatedAt: z.string().nullable().optional(),
});
const OutputPRStatusCheckSchema = z.object({
	__typename: z.string(),
	completedAt: z.string().nullable().optional(),
	conclusion: z.string().nullable().optional(),
	detailsUrl: z.string().nullable().optional(),
	name: z.string(),
	startedAt: z.string().nullable().optional(),
	status: z.string(),
	workflowName: z.string().nullable().optional(),
});
const OutputPRCommitSchema = z.object({
	id: z.string(),
	date: z.string(),
	author: z.string(),
	message: z.string(),
	files: z.array(OutputFileSchema).optional(),
});
const OutputPRSchema = z.object({
	state: z.string(),
	author: z.string(),
	title: z.string(),
	body: z.string().nullable().optional(),
	comments: z.array(OutputPRCommentSchema).optional(),
	mergeStateStatus: z.string().nullable().optional(),
	mergedAt: z.string().nullable().optional(),
	mergeCommit: z.string().nullable().optional(),
	commits: z.array(OutputPRCommitSchema).optional(),
	statusCheckRollup: z.array(OutputPRStatusCheckSchema).nullable().optional(),
});
const OutputPRListSchema = z.object({
	number: z.number(),
	state: z.string(),
	author: z.string(),
	title: z.string(),
	body: z.string().nullable().optional(),
	comments: z.array(OutputPRCommentSchema).optional(),
	mergeStateStatus: z.string().optional(),
	mergedAt: z.string().nullable().optional(),
	mergeCommit: z.string().nullable().optional(),
	commits: z.array(OutputPRCommitSchema).optional(),
	statusCheckRollup: z.array(OutputPRStatusCheckSchema).nullable().optional(),
});

async function fetchSinglePr(cwd, repo, prId, fetchFiles) {
	return new Promise((resolve, reject) => {
		const cmdArgs = [
			"pr",
			"view",
			prId,
			"--json",
			"state,author,title,body,comments,mergeStateStatus,mergedAt,mergeCommit,commits,statusCheckRollup",
		];
		if (repo) cmdArgs.splice(2, 0, "--repo", repo);

		const child = spawn("gh", cmdArgs, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd,
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		child.stderr.on("data", (d) => {
			stderr += d.toString();
		});

		child.on("close", async (code) => {
			if (code !== 0) {
				reject(new Error(`GitHub CLI failed ${code}: ${stderr.trim()}`));
				return;
			}
			try {
				const raw = JSON.parse(stdout);
				const validated = InputPRSchema.parse(raw);

				const commits = await Promise.all(
					validated.commits.map(async (c) => {
						const author =
							c.authors
								?.map((a) => a.name ?? a.login)
								.sort()
								.join(", ") ?? "Unknown";
						const message = normalizeCommitMessage(c.messageHeadline, c.messageBody);
						const base = { id: c.oid, date: c.committedDate, author, message };

						if (!fetchFiles) return base;
						try {
							const commitDetails = await fetchCommitViaGh(cwd, repo, c.oid);
							const files = (commitDetails.files ?? []).map((f) => ({
								filename: f.filename,
								status: f.status,
								urlWeb: f.blob_url,
								urlRaw: f.raw_url,
								patch: f.patch ?? null,
							}));
							return { ...base, files };
						} catch {
							return {
								...base,
								message: message + "\n\n[Error: File details could not be fetched]",
								files: [],
							};
						}
					}),
				);

				resolve({
					state: validated.state,
					author: validated.author.name ?? validated.author.login,
					title: validated.title,
					body: validated.body ?? null,
					comments: validated.comments.map((co) => ({
						id: co.id,
						author: { login: co.author.login, name: co.author.name ?? undefined },
						body: co.body,
						createdAt: co.createdAt,
						updatedAt: co.updatedAt ?? undefined,
					})),
					mergeStateStatus: validated.mergeStateStatus ?? null,
					mergedAt: validated.mergedAt ?? null,
					mergeCommit: validated.mergeCommit?.oid ?? null,
					commits,
					statusCheckRollup: validated.statusCheckRollup ?? null,
				});
			} catch (e) {
				reject(new Error(`Parse PR: ${e.message}`));
			}
		});
		child.on("error", (e) => reject(e));
	});
}

async function fetchPrList(cwd, repo, state, limit) {
	return new Promise((resolve, reject) => {
		const cmdArgs = [
			"pr",
			"list",
			"--state",
			state,
			"--limit",
			String(limit),
			"--json",
			"number,title,body,state,author,comments,mergeStateStatus,mergedAt,mergeCommit,commits,statusCheckRollup",
		];
		if (repo) cmdArgs.splice(2, 0, "--repo", repo);

		const child = spawn("gh", cmdArgs, {
			stdio: ["ignore", "pipe", "pipe"],
			cwd,
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
			if (code !== 0) {
				reject(new Error(`GitHub CLI failed ${code}: ${stderr.trim()}`));
				return;
			}
			try {
				const raw = JSON.parse(stdout);
				const validated = z.array(InputPRListSchema).parse(raw);
				const data = validated.map((pr) => ({
					number: pr.number,
					state: pr.state,
					author: pr.author.name ?? pr.author.login,
					title: pr.title,
					body: pr.body ?? null,
					comments: (pr.comments ?? []).map((co) => ({
						id: co.id,
						author: { login: co.author.login, name: co.author.name ?? undefined },
						body: co.body,
						createdAt: co.createdAt,
						updatedAt: co.updatedAt ?? undefined,
					})),
					mergeStateStatus: pr.mergeStateStatus ?? null,
					mergedAt: pr.mergedAt ?? null,
					mergeCommit: pr.mergeCommit?.oid ?? null,
					commits: (pr.commits ?? []).map((c) => ({
						id: c.oid,
						date: c.committedDate,
						author:
							c.authors
								?.map((a) => a.name ?? a.login)
								.sort()
								.join(", ") ?? "Unknown",
						message: normalizeCommitMessage(c.messageHeadline, c.messageBody),
					})),
					statusCheckRollup: pr.statusCheckRollup ?? null,
				}));
				resolve(data);
			} catch (e) {
				reject(new Error(`Parse PR list: ${e.message}`));
			}
		});
		child.on("error", (e) => reject(e));
	});
}

export const githubFetchPr = {
	name: "githubFetchPr",
	title: "github-fetch-pr",
	description:
		"Fetch GitHub pull requests. If prId is provided, fetches a single PR; otherwise fetches a list. Use fetchFiles=true for single PR to include file details per commit (recommended only when PR has few commits).",
	operation: "fetching PR(s)",
	schema: z.object({
		repo: z
			.string()
			.optional()
			.describe(
				"Repository in owner/repo format (ex: microsoft/vscode). If not provided, uses current repository.",
			),
		prId: z
			.string()
			.optional()
			.describe("The pull request number to fetch. If not provided, fetches a list of PRs."),
		state: z
			.enum(["open", "closed", "merged", "all"])
			.optional()
			.default("open")
			.describe("Filter by PR state (only when fetching list)."),
		limit: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.default(20)
			.describe("Max number of PRs to fetch (only when fetching list)."),
		fetchFiles: z
			.boolean()
			.optional()
			.default(false)
			.describe("For single PR only: include file details per commit. Use only when PR has few commits."),
		outputPath: z
			.string()
			.optional()
			.describe("Optional path to write JSON output. If provided, returns path info instead of full data."),
	}),
	async handler(cwd, { repo, prId, state = "open", limit = 20, fetchFiles = false, outputPath }) {
		const ghStatus = await checkGHCLI(cwd);
		if (!ghStatus.available) throw new Error(`GitHub CLI not found: ${ghStatus.error}`);
		if (!ghStatus.authenticated) throw new Error(`GitHub CLI not authenticated: ${ghStatus.error}`);

		let data;
		if (prId) {
			data = await fetchSinglePr(cwd, repo, prId, fetchFiles);
			data = OutputPRSchema.parse(data);
		} else {
			data = await fetchPrList(cwd, repo, state, limit);
			data = z.array(OutputPRListSchema).parse(data);
		}

		if (outputPath) {
			const outputPathAbs = resolve(outputPath);
			writeFileSync(outputPathAbs, JSON.stringify(data, null, 2));
			data = OutputInfoSchema.parse({ outputPath, outputPathAbs });
		}
		return { data };
	},
};
