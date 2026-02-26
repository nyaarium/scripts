import { z } from "zod";
import { getGmailClient } from "./lib/auth.js";

function getHeader(payload, name) {
	const header = payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
	return header?.value ?? null;
}

function decodeBody(part) {
	if (!part?.body?.data) return null;
	const data = part.body.data;
	try {
		return Buffer.from(data, "base64url").toString("utf8");
	} catch {
		try {
			return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
		} catch {
			return null;
		}
	}
}

function findBodyInPart(part) {
	if (part?.body?.data) return decodeBody(part);
	if (part?.parts?.length) {
		const textPart = part.parts.find((p) => p.mimeType === "text/plain");
		if (textPart) return findBodyInPart(textPart);
		const htmlPart = part.parts.find((p) => p.mimeType === "text/html");
		if (htmlPart) return findBodyInPart(htmlPart);
		return findBodyInPart(part.parts[0]) ?? null;
	}
	return null;
}

function extractBody(payload) {
	if (payload?.body?.data) return decodeBody(payload);
	if (payload?.parts?.length) {
		const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
		if (textPart) return findBodyInPart(textPart);
		const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
		if (htmlPart) return findBodyInPart(htmlPart);
		for (const part of payload.parts) {
			const body = findBodyInPart(part);
			if (body) return body;
		}
	}
	return null;
}

function formatMessage(msg) {
	const payload = msg.payload ?? {};
	return {
		id: msg.id,
		threadId: msg.threadId,
		labelIds: msg.labelIds ?? [],
		snippet: msg.snippet ?? null,
		internalDate: msg.internalDate ?? null,
		subject: getHeader(payload, "Subject"),
		from: getHeader(payload, "From"),
		to: getHeader(payload, "To"),
		date: getHeader(payload, "Date"),
		body: extractBody(payload),
	};
}

export const gmailSearch = {
	name: "gmailSearch",
	title: "gmail-search",
	description:
		"Search Gmail using Gmail search syntax. Returns message ids and threadIds for use with gmail-fetch-messages. Query examples: 'from:user@example.com', 'subject:invoice', 'is:unread', 'after:2024/01/01'.",
	operation: "searching Gmail",
	schema: z.object({
		query: z
			.string()
			.optional()
			.default("")
			.describe(
				"Gmail search query. Leave empty for recent messages. Examples: from:user@example.com, subject:invoice, is:unread, after:2024/01/01",
			),
		maxResults: z
			.number()
			.int()
			.min(1)
			.max(100)
			.optional()
			.default(20)
			.describe("Max number of message ids to return."),
		includeSpamTrash: z
			.boolean()
			.optional()
			.default(false)
			.describe("Include messages from spam and trash."),
	}),
	async handler(cwd, { query = "", maxResults = 20, includeSpamTrash = false }) {
		const { gmail } = await getGmailClient();

		const res = await gmail.users.messages.list({
			userId: "me",
			q: query || undefined,
			maxResults,
			includeSpamTrash,
		});

		const messages = res.data.messages ?? [];
		const items = messages.map((m) => ({ id: m.id, threadId: m.threadId }));

		return {
			data: {
				messageIds: items,
				nextPageToken: res.data.nextPageToken ?? null,
				resultSizeEstimate: res.data.resultSizeEstimate ?? null,
			},
		};
	},
};

export const gmailFetchMessages = {
	name: "gmailFetchMessages",
	title: "gmail-fetch-messages",
	description:
		"Fetch full email content by message ids. Pass the id values from gmail-search results. Returns subject, from, to, date, body, snippet for each message.",
	operation: "fetching Gmail messages",
	schema: z.object({
		ids: z
			.array(z.string())
			.min(1)
			.max(50)
			.describe("Array of Gmail message ids from gmail-search."),
	}),
	async handler(cwd, { ids }) {
		const { gmail } = await getGmailClient();

		const messages = await Promise.all(
			ids.map(async (id) => {
				const res = await gmail.users.messages.get({
					userId: "me",
					id,
					format: "full",
				});
				return formatMessage(res.data);
			}),
		);

		return { data: messages };
	},
};
