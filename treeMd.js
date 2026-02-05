import ansis from "ansis";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

class FileSection {
	constructor(name) {
		this.name = name;
		this.children = [];
	}

	toString(prefix = "", isLast = true) {
		const connector = ansis.dim(isLast ? "└── " : "├── ");

		// Split the header into hash part and title
		const spaceIndex = this.name.indexOf(" ");
		let headerPrefix = "";
		let headerTitle = this.name;
		if (spaceIndex > 0) {
			headerPrefix = this.name.slice(0, spaceIndex + 1); // include space
			headerTitle = this.name.slice(spaceIndex + 1);
		}

		const coloredHeader = ansis.dim(headerPrefix) + ansis.green(headerTitle);

		let result = `${prefix + connector + coloredHeader}\n`;

		const dimPipe = ansis.dim("│");
		const childPrefix = prefix + (isLast ? "    " : `${dimPipe}   `);
		for (let i = 0; i < this.children.length; i++) {
			const isLastChild = i === this.children.length - 1;
			result += this.children[i].toString(childPrefix, isLastChild);
		}

		return result;
	}

	toJSON() {
		return {
			name: this.name,
			children: this.children.map((child) => child.toJSON()),
		};
	}
}

class FileNode {
	constructor(name, isDirectory = false) {
		this.name = name;
		this.isDirectory = isDirectory;
		this.children = [];
		this.sections = []; // Only used for files
	}

	toString(prefix = "", isLast = true) {
		const connector = ansis.dim(isLast ? "└──" : "├──");
		const icon = this.isDirectory ? "📁 " : "📄 ";
		const suffix = this.isDirectory ? "/" : "";
		const coloredName = this.isDirectory
			? ansis.yellow(icon + this.name + suffix)
			: ansis.blueBright(icon + this.name + suffix);
		let result = `${prefix + connector + coloredName}\n`;

		const dimPipe = ansis.dim("│");
		const childPrefix = prefix + (isLast ? "    " : `${dimPipe}   `);

		// For files, show sections first, then children (sections colored)
		if (!this.isDirectory) {
			for (let i = 0; i < this.sections.length; i++) {
				const isLastSection = i === this.sections.length - 1 && this.children.length === 0;
				result += this.sections[i].toString(childPrefix, isLastSection);
			}
		}

		// Show children (for directories, this is subdirectories and files)
		for (let i = 0; i < this.children.length; i++) {
			const isLastChild = i === this.children.length - 1;
			result += this.children[i].toString(childPrefix, isLastChild);
		}

		return result;
	}

	toJSON() {
		const result = {
			name: this.name,
			isDirectory: this.isDirectory,
			children: this.children.map((child) => child.toJSON()),
		};

		if (!this.isDirectory) {
			result.sections = this.sections.map((section) => section.toJSON());
		}

		return result;
	}
}

function scanMarkdown(filePath) {
	const colorizeCount = (count, hasChildren) => {
		if (!count && hasChildren) return null;

		return count ? ansis.whiteBright(count) : ansis.redBright(count);
	};

	const wrapCount = (count) => {
		if (count === null) return "";

		const open = ansis.white(ansis.dim(`(`));
		const close = ansis.white(ansis.dim(`)`));
		return ` ${open}${count}${close}`;
	};

	try {
		const content = fs.readFileSync(filePath, "utf8");
		const lines = content.split("\n");
		const sections = [];
		const stack = []; // Stack to track nested sections
		const sectionCounts = []; // Track counts for each section

		let currentContentCount = 0;
		let currentSection = null;

		for (const line of lines) {
			const trimmed = line.trim();

			// Check if line is a header (keep the # characters)
			const headerMatch = trimmed.match(/^(#{2,})\s+(.+)$/);
			if (headerMatch) {
				if (currentSection) {
					sectionCounts.push({ section: currentSection, count: currentContentCount });
				}

				const level = headerMatch[1].length; // Number of # characters
				const name = `${headerMatch[1]} ${headerMatch[2].trim()}`; // Keep the # characters

				const section = new FileSection(name);
				currentSection = section;
				currentContentCount = 0;

				// Pop stack until we find the right parent level
				while (stack.length > 0 && stack[stack.length - 1].level >= level) {
					stack.pop();
				}

				// Add to parent or root
				if (stack.length === 0) {
					sections.push(section);
				} else {
					stack[stack.length - 1].section.children.push(section);
				}

				// Push current section to stack
				stack.push({ level, section });
			} else if (currentSection && trimmed.length) {
				// Count non-empty, non-header lines as content
				currentContentCount++;
			}
		}

		// Store the count for the last section
		if (currentSection) {
			sectionCounts.push({ section: currentSection, count: currentContentCount });
		}

		// Add the counts after all sections are processed
		for (const { section, count } of sectionCounts) {
			const hasChildren = 0 < section.children.length;
			section.name += wrapCount(colorizeCount(count, hasChildren));
		}

		return sections;
	} catch (error) {
		console.error(`Error reading ${filePath}:`, error.message);
		return [];
	}
}

function scanFolder(folderPath) {
	const directories = [];
	const files = [];

	try {
		const items = fs.readdirSync(folderPath);

		for (const item of items) {
			if (item === "node_modules") continue;

			const fullPath = path.join(folderPath, item);
			const stat = fs.statSync(fullPath);

			if (stat.isFile() && (item.endsWith(".md") || item.endsWith(".mdc"))) {
				const sections = scanMarkdown(fullPath);
				const nodeData = new FileNode(item, false);
				nodeData.sections = sections;
				files.push(nodeData);
			} else if (stat.isDirectory()) {
				const subResult = scanFolder(fullPath);
				if (subResult.length > 0) {
					const nodeData = new FileNode(item, true);
					nodeData.children = subResult;
					directories.push(nodeData);
				}
			}
		}
	} catch (error) {
		console.error(`Error scanning ${folderPath}:`, error.message);
	}

	// Return directories first, then files
	return [...directories, ...files];
}

function renderTree(items, prefix = "") {
	let result = "";

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const isLast = i === items.length - 1;
		result += item.toString(prefix, isLast);
	}

	return result;
}

const toolDefinitions = {
	treeMd: {
		name: "treeMd",
		title: "tree-md",
		description: "Render a directory or Markdown file tree using the local tree-md script.",
		operation: "rendering tree",
		schema: z.object({
			paths: z
				.array(z.string())
				.nonempty()
				.describe("One or more absolute or relative paths to scan (directories, .md, or .mdc files)."),
		}),
		async handler({ paths }) {
			// Validate all paths first
			for (const targetPath of paths) {
				if (!fs.existsSync(targetPath)) {
					throw new Error(`Path not found: ${targetPath}`);
				}
			}

			let output = "";

			for (const targetPath of paths) {
				const stat = fs.statSync(targetPath);

				let rootLine = "";
				let nodes = [];

				if (stat.isDirectory()) {
					rootLine = `📁 ${ansis.yellow(targetPath)}`;
					nodes = scanFolder(targetPath);
				} else if (stat.isFile() && (targetPath.endsWith(".md") || targetPath.endsWith(".mdc"))) {
					rootLine = ansis.blueBright(`📄 ${path.basename(targetPath)}`);
					nodes = scanMarkdown(targetPath);
				} else {
					throw new Error(`Expected a directory or a Markdown (*.md / *.mdc) file: ${targetPath}`);
				}

				output += `\n${rootLine}\n${renderTree(nodes, " ")}`;
			}

			return output + "\n";
		},
	},
};

export const toolsTreeMd = Object.values(toolDefinitions);
