import { toolsTreeMd } from "../tools/toolsTreeMd.ts";

const treeMdTool = toolsTreeMd[0];
const paths = process.argv.slice(2);
const asString = paths.includes("--string");
const filteredPaths = paths.filter((p) => p !== "--string");

if (filteredPaths.length === 0) {
	console.error("Usage: tree-md [--string] <path1> [path2] ...");
	process.exit(1);
}

const cwd = process.cwd();
const result = await treeMdTool.handler(cwd, { paths: filteredPaths, asString });

if (asString && (result as { treeString?: string })?.treeString) {
	console.log((result as { treeString: string }).treeString);
} else {
	console.log(JSON.stringify(result, null, 2));
}
