import ansis from "ansis";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

class FileSection {
	constructor(name) {
		this.name = name;
		this.children = [];
		/** @type {number} */
		this.contentLineCount = 0;
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
		const countSuffix =
			this.contentLineCount !== undefined
				? ` ${ansis.dim("(")}${this.contentLineCount ? ansis.whiteBright(this.contentLineCount) : ansis.redBright(0)}${ansis.dim(")")}`
				: "";

		let result = `${prefix + connector + coloredHeader}${countSuffix}\n`;

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

		for (const { section, count } of sectionCounts) {
			section.contentLineCount = count;
		}

		return { sections, errors: [] };
	} catch (error) {
		return { sections: [], errors: [`Error reading ${filePath}: ${error.message}`] };
	}
}

function scanFolder(folderPath) {
	const directories = [];
	const files = [];
	const errors = [];

	try {
		const items = fs.readdirSync(folderPath);

		for (const item of items) {
			if (item === "node_modules") continue;

			const fullPath = path.join(folderPath, item);

			let stat;
			try {
				stat = fs.statSync(fullPath);
			} catch (err) {
				errors.push(`Error stating ${fullPath}: ${err.message}`);
				continue;
			}

			if (stat.isFile() && (item.endsWith(".md") || item.endsWith(".mdc"))) {
				const { sections, errors: fileErrors } = scanMarkdown(fullPath);
				errors.push(...fileErrors);

				const nodeData = new FileNode(item, false);
				nodeData.sections = sections;
				files.push(nodeData);
			} else if (stat.isDirectory()) {
				const { nodes: subNodes, errors: subErrors } = scanFolder(fullPath);
				errors.push(...subErrors);

				if (subNodes.length > 0) {
					const nodeData = new FileNode(item, true);
					nodeData.children = subNodes;
					directories.push(nodeData);
				}
			}
		}
	} catch (error) {
		errors.push(`Error scanning ${folderPath}: ${error.message}`);
	}

	// Return directories first, then files
	return { nodes: [...directories, ...files], errors };
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

function sectionToStructured(section) {
	return {
		name: section.name,
		count: section.contentLineCount ?? 0,
		children: section.children.map(sectionToStructured),
	};
}

function nodeToStructured(node) {
	if (node.isDirectory) {
		return {
			name: node.name,
			children: node.children.map(nodeToStructured),
		};
	}
	return {
		name: node.name,
		sections: node.sections.map(sectionToStructured),
	};
}

const toolDefinitions = {
	treeMd: {
		name: "treeMd",
		title: "tree-md",
		description:
			"Render a directory or Markdown file tree. Returns structured JSON (tree) by default; use asString only when the user asks to see the tree printed in the reply.",
		operation: "rendering tree",
		schema: z.object({
			paths: z
				.array(z.string())
				.nonempty()
				.describe("One or more absolute or relative paths to scan (directories, .md, or .mdc files)."),
			asString: z
				.coerce.boolean()
				.optional()
				.default(false)
				.describe(
					"Set true only when the user explicitly asks to see the tree in the reply (e.g. 'show me the tree', 'pretty print it'). Leave false when the result is for your own use (reasoning, picking paths, etc.). Default false returns structured JSON in tree.",
				),
		}),
		async handler(cwd, args) {
			const { paths, asString } = toolDefinitions.treeMd.schema.parse(args);
			for (const targetPath of paths) {
				if (!path.isAbsolute(targetPath)) {
					throw new Error(`Relative path not allowed: ${targetPath}. Use an absolute path.`);
				}
			}
			for (const targetPath of paths) {
				if (!fs.existsSync(targetPath)) {
					throw new Error(`Path not found: ${targetPath}`);
				}
			}

			const allErrors = [];
			let outputString = "";
			const structuredList = [];

			for (const targetPath of paths) {
				let stat;
				try {
					stat = fs.statSync(targetPath);
				} catch (err) {
					allErrors.push(`Error stating root path ${targetPath}: ${err.message}`);
					continue;
				}

				let rootLine = "";
				let nodes = [];
				let currentErrors = [];

				if (stat.isDirectory()) {
					rootLine = `📁 ${ansis.yellow(targetPath)}`;
					const result = scanFolder(targetPath);
					nodes = result.nodes;
					currentErrors = result.errors;
				} else if (stat.isFile() && (targetPath.endsWith(".md") || targetPath.endsWith(".mdc"))) {
					rootLine = ansis.blueBright(`📄 ${path.basename(targetPath)}`);
					const result = scanMarkdown(targetPath);
					nodes = result.sections;
					currentErrors = result.errors;
				} else {
					throw new Error(`Expected a directory or a Markdown (*.md / *.mdc) file: ${targetPath}`);
				}

				allErrors.push(...currentErrors);
				outputString += `\n${rootLine}\n${renderTree(nodes, " ")}`;
				if (stat.isDirectory()) {
					structuredList.push({
						path: targetPath,
						nodes: nodes.map(nodeToStructured),
					});
				} else {
					structuredList.push({
						path: targetPath,
						nodes: [{ name: path.basename(targetPath), sections: nodes.map(sectionToStructured) }],
					});
				}
			}

			if (asString === true) {
				return { treeString: outputString + "\n", errors: allErrors };
			}
			return { tree: structuredList, errors: allErrors };
		},
	},
};

export const toolsTreeMd = Object.values(toolDefinitions);
