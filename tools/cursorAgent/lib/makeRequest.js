import https from "node:https";

export function makeRequest(endpoint, method, data = null) {
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
			res.on("data", (chunk) => { body += chunk; });
			res.on("end", () => {
				try {
					const responseData = body ? JSON.parse(body) : {};
					if (res.statusCode >= 200 && res.statusCode < 300) {
						resolve(responseData);
					} else {
						reject(new Error(`Request failed with status code ${res.statusCode}: ${responseData.message || body}`));
					}
				} catch (parseError) {
					reject(new Error(`Failed to parse response: ${parseError.message}`));
				}
			});
		});

		req.on("error", (err) => reject(new Error(`Request failed: ${err.message}`)));
		if (data) req.write(JSON.stringify(data));
		req.end();
	});
}
