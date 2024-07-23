#!/bin/bash

source ~/.env


git diff main... -U10 | \
jq -sR \
	--arg prompt "Make up a commit message from the following diffs.\n\n--------\n\n" \
	--arg model "gpt-4o-mini" \
	--arg context_size "16383" \
	'{
		model: $model,
		messages: [
			{ role: "system", content: "You are an API. Only respond with the PLAIN TEXT response. As an API, do not repeat the request question given and do not explain or comment on anything." },
			{ role: "user", content: ($prompt + .) }
		]
	}' | \
curl -sSL -X POST "https://api.openai.com/v1/chat/completions" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer $OPENAI_KEY" \
	--data @- | \
jq -r '.choices[0].message.content'

