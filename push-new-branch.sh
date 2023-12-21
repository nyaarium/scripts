#!/bin/bash

source ~/.env

set -e

# Script to push new branch and clean main

echo ""
echo "✏️  Enter the new branch name:"
read new_branch
new_branch=$(echo "$new_branch" | sed -e "s/[^a-zA-Z0-9]/-/g")

if [ -z "$new_branch" ]; then
  echo "A branch name is required."
  exit 0
fi

if [ "$new_branch" = "main" ] || [ "$new_branch" = "master" ]; then
  echo "Branch name cannot be 'main' or 'master'."
  exit 1
fi

origin=$(git branch -r | grep -E "^\s*origin/(main|master)$")
branch=$(basename "$origin")
git push -u origin "$branch:$new_branch"
git branch -u "origin/$branch"
git reset --hard "origin/$branch"
