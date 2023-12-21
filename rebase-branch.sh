#!/bin/bash

source ~/.env

set -e

# Determine if the main branch is named 'main' or 'master'
main_origin=$(git branch -r | grep -E "^\s*origin/(main|master)$")
main_branch=$(basename "$main_origin")

# Prompt for the target branch to rebase onto, defaulting to the main branch
echo -n "✏️  Target branch to rebase onto. Typically main/master [$main_branch]: "
read input_target_branch
target_branch=${input_target_branch:-$main_branch}

if [ -z "$target_branch" ]; then
  echo "A target branch (rebase onto) is required."
  exit 1
fi

# Get the current branch name as the default feature branch
current_branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$current_branch" = "HEAD" ]; then
  echo "You are in a detached HEAD state. Please checkout a branch before running this script."
  exit 1
fi

# If current branch is main or master, clear $current_branch
if [ "$current_branch" = "$main_branch" ]; then
  current_branch=""
fi

# Prompt for the feature branch to rebase, defaulting to the current branch
echo -n "✏️  Feature branch to rebase onto $main_branch [$current_branch]: "
read input_feature_branch
feature_branch=${input_feature_branch:-$current_branch}

if [ -z "$feature_branch" ]; then
  echo "A feature branch is required."
  exit 1
fi

# Confirm the rebase operation
echo -n "❓ Rewrite $feature_branch to begin from $target_branch? y/n: "
read confirmation

if [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
  echo "Rebase cancelled."
  exit 0
fi
if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
  echo "Expected a Y/N answer."
  exit 1
fi

# Perform the rebase
git rebase --committer-date-is-author-date --onto "$target_branch" "$(git merge-base "$feature_branch" "$target_branch")" "$feature_branch"
