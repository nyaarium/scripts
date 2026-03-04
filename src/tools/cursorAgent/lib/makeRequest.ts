import https from "node:https";

/** Makes an authenticated request to api.cursor.com. Rejects on non-2xx or parse failure. */
export function makeRequest(endpoint: string, method: string, data: unknown = null): Promise<unknown> {
	const apiKey = process.env.CURSOR_AGENT_KEY;
	if (!apiKey) {
		return Promise.reject(new Error("CURSOR_AGENT_KEY environment variable is not set"));
	}

	return new Promise((resolve, reject) => {
		const options = {
			hostname: "api.cursor.com",
			path: endpoint,
			method,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
		};

		const req = https.request(options, (res) => {
			let body = "";
			res.on("data", (chunk: Buffer) => { body += chunk; });
			res.on("end", () => {
				try {
					const responseData = body ? JSON.parse(body) : {};
					if (res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300) {
						resolve(responseData);
					} else {
						reject(new Error(`Request failed with status code ${res.statusCode}: ${(responseData as { message?: string }).message || body}`));
					}
				} catch (parseError) {
					reject(new Error(`Failed to parse response: ${(parseError as Error).message}`));
				}
			});
		});

		req.on("error", (err: Error) => reject(new Error(`Request failed: ${err.message}`)));
		if (data) req.write(JSON.stringify(data));
		req.end();
	});
}
