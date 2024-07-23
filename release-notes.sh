#!/bin/bash

source ~/.env


git diff main... -U10 | \
jq -sR \
	--arg prompt "For a release page, explain in markdown bullet points what changes were made. Categorize them into Features, Fixes, Changes, and any other categories that you need. Exclude the code block backticks.\n\n--------\n\n" \
	--arg model "gpt-4o" \
	'{
		model: $model,
		messages: [
			{ role: "system", content: "You are an API. Only respond with the PLAIN TEXT response. As an API, do not repeat the request question given, and do not explain or comment on anything more than necessary." },
			{ role: "user", content: ($prompt + .) }
		]
	}' | \
curl -sSL -X POST "https://api.openai.com/v1/chat/completions" \
	-H "Content-Type: application/json" \
	-H "Authorization: Bearer $OPENAI_KEY" \
	--data @- | \
jq -r '.choices[0].message.content'
