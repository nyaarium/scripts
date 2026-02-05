import { cursorLaunchAgent } from "./tools/cursorLaunchAgent.js";
import { cursorGetAgentStatus } from "./tools/cursorGetAgentStatus.js";
import { cursorListAgents } from "./tools/cursorListAgents.js";
import { cursorAddFollowUp } from "./tools/cursorAddFollowUp.js";
import { cursorDeleteAgent } from "./tools/cursorDeleteAgent.js";
import { cursorGetAgentConversation } from "./tools/cursorGetAgentConversation.js";
import { cursorListModels } from "./tools/cursorListModels.js";
import { cursorListRepositories } from "./tools/cursorListRepositories.js";
import { cursorWaitUntilDone } from "./tools/cursorWaitUntilDone.js";
import { cursorMergePullRequest } from "./tools/cursorMergePullRequest.js";

export const toolsCursorAgent = [
	cursorLaunchAgent,
	cursorGetAgentStatus,
	cursorListAgents,
	cursorAddFollowUp,
	cursorDeleteAgent,
	cursorGetAgentConversation,
	cursorListModels,
	cursorListRepositories,
	cursorWaitUntilDone,
	cursorMergePullRequest,
];
