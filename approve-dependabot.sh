#!/bin/bash 

source ~/.env


# Check if GitHub CLI is ready
command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
gh_ready_status=$?
if [ $gh_ready_status -ne 0 ]; then
  command -v gh >/dev/null
  if [ $? -ne 0 ]; then
    echo "⚠️  GitHub CLI is not installed. Exiting script."
  else
    echo "⚠️  GitHub CLI is not authenticated. Exiting script."
  fi
  exit 1
fi

# Fetch open pull requests number, author (app/dependabot), title
gh_prs=$(gh pr list --limit 100 --state open --json number,author,title | jq -c '.[]')
echo "$gh_prs"

echo "$gh_prs" | while read -r pr; do
  pr_number=$(echo "$pr" | jq -r '.number')
  pr_author=$(echo "$pr" | jq -r '.author.login')

  if [ "$pr_author" == "app/dependabot" ]; then
    echo "Enabling auto-merge for PR $pr_number by $pr_author"
    gh pr merge "$pr_number" --auto -m

    echo "Approving PR $pr_number by $pr_author"
    gh pr review --approve "$pr_number"
  fi
done
