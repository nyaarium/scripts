import { cursorLaunchAgent } from "./tools/cursorLaunchAgent.ts";
import { cursorGetAgentStatus } from "./tools/cursorGetAgentStatus.ts";
import { cursorListAgents } from "./tools/cursorListAgents.ts";
import { cursorAddFollowUp } from "./tools/cursorAddFollowUp.ts";
import { cursorDeleteAgent } from "./tools/cursorDeleteAgent.ts";
import { cursorGetAgentConversation } from "./tools/cursorGetAgentConversation.ts";
import { cursorListModels } from "./tools/cursorListModels.ts";
import { cursorListRepositories } from "./tools/cursorListRepositories.ts";
import { cursorWaitUntilDone } from "./tools/cursorWaitUntilDone.ts";
import { cursorMergePullRequest } from "./tools/cursorMergePullRequest.ts";

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
