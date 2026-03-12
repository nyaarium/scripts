import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { z } from "zod";
import { toolsCursorAgent } from "./tools/cursorAgent/index.ts";
import { toolsGitHub } from "./tools/github/index.ts";
import { toolsGoogle } from "./tools/google/index.ts";
import { toolsTreeMd } from "./tools/toolsTreeMd.ts";

export interface McpTool {
	name: string;
	title: string;
	description: string;
	operation?: string;
	schema: z.ZodObject<z.ZodRawShape>;
	handler: (cwd: string, args: Record<string, unknown>) => Promise<unknown>;
}

const scriptDir = path.dirname(process.execPath);

process.chdir(scriptDir);

dotenv.config({
	path: path.join(scriptDir, ".env"),
	quiet: true,
});

const mcpServer = new McpServer({
	name: "nyaascripts",
	version: "1.0.0",
});

function registerTool(tool: McpTool) {
	mcpServer.registerTool(
		tool.name,
		{
			title: tool.title,
			description: tool.description,
			inputSchema: tool.schema.shape,
		},
		async (args) => {
			try {
				const roots = (await mcpServer.server.listRoots()) as { roots: Array<{ uri: string }> };
				if (!roots.roots || roots.roots.length === 0) throw new Error("listRoots: no roots");
				const cwd = fileURLToPath(roots.roots[0].uri);
				const result = await tool.handler(cwd, args);
				return {
					content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
				};
			} catch (error) {
				return {
					content: [
						{
							type: "text" as const,
							text: JSON.stringify({ errors: [{ message: (error as Error).message }] }, null, 2),
						},
					],
					isError: true,
				};
			}
		},
	);
}

// Register Cursor Agent tools
toolsCursorAgent.forEach((tool) => {
	registerTool(tool as McpTool);
});

// Register TreeMd tools
toolsTreeMd.forEach((tool) => {
	registerTool(tool as McpTool);
});

// Register GitHub tools
toolsGitHub.forEach((tool) => {
	registerTool(tool as McpTool);
});

// Register Google/Gmail tools
toolsGoogle.forEach((tool) => {
	registerTool(tool as McpTool);
});

// Register project-specific tools (dynamic schema loading)
async function loadProjectTools() {
	const projectName = process.env.PROJECT_NAME;
	const port = process.env.PORT;

	if (!projectName || !port) return;

	const schemaPath = `/workspace/${projectName}/.claude/mcp-schema.js`;

	if (!fs.existsSync(schemaPath)) {
		console.error(`[nyaascripts] PROJECT_NAME and PORT are set, but schema not found: ${schemaPath}`);
		return;
	}

	let schema: { default?: unknown };
	try {
		schema = await import(schemaPath);
	} catch (error) {
		console.error(`[nyaascripts] Failed to load MCP schema from ${schemaPath}: ${(error as Error).message}`);
		return;
	}

	const schemaFn = schema.default;
	if (typeof schemaFn !== "function") {
		console.error(`[nyaascripts] MCP schema must default export a function. Got: ${typeof schemaFn}`);
		return;
	}

	const tools = schemaFn(z) as unknown[];
	if (!Array.isArray(tools)) {
		console.error(`[nyaascripts] MCP schema function must return an array. Got: ${typeof tools}`);
		return;
	}

	const host = process.env.HOST || "localhost";
	const baseUrl = `http://${host}:${port}`;

	for (const tool of tools as McpTool[]) {
		mcpServer.registerTool(
			tool.name,
			{
				title: tool.title,
				description: tool.description,
				inputSchema: tool.schema.shape,
			},
			async (args) => {
				try {
					const endpoint = tool.operation ?? `/api/debug/${tool.name}`;
					const url = `${baseUrl}${endpoint}`;

					const response = await fetch(url, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(args),
					});

					if (!response.ok) {
						const text = await response.text();
						throw new Error(`HTTP ${response.status}: ${text}`);
					}

					const result = await response.json();
					return {
						content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
					};
				} catch (error) {
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify({ errors: [{ message: (error as Error).message }] }, null, 2),
							},
						],
						isError: true,
					};
				}
			},
		);
	}

	console.error(`[nyaascripts] Loaded ${tools.length} project tool(s) from ${projectName}`);
}

async function main() {
	await loadProjectTools();
	const transport = new StdioServerTransport();
	await mcpServer.connect(transport);
}

main().catch((error) => {
	console.error("Server error:", error);
	process.exit(1);
});
