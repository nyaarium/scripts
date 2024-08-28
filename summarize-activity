#!/bin/bash

source ~/.env


while true; do
    echo ""
    echo -n "❓ How many days of history to look up? Enter a number: "
    read days
    if [ -n "$days" ]; then
        break
    else
        echo "Expected a number."
    fi
done


git log --author="nyaarium" --since="$days days ago" --pretty=format:"%s" | \
jq -sR \
	--arg prompt "Summarize the following commit messages.\n\n--------\n\n" \
	--arg model "gpt-4o-mini" \
	--arg context_size "16383" \
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
