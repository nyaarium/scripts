#!/bin/bash

source ~/.env


# Check if GitHub CLI is ready
command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
gh_ready_status=$?
if [ $gh_ready_status -ne 0 ]; then
  command -v gh >/dev/null
  if [ $? -ne 0 ]; then
    echo "⚠️  GitHub CLI is not installed. Skipping pull request."
  else
    echo "⚠️  GitHub CLI is not authenticated. Skipping pull request."
  fi
fi

set -e


# Script to push new branch and clean main

main_origin=$(git branch -r | grep -E "^\s*origin/(main|master)$")
main_branch=$(basename "$main_origin")

# If it is not either main or master, exit
if [ "$main_branch" != "main" ] && [ "$main_branch" != "master" ]; then
  echo "Could not find 'main' or 'master' branch."
  exit 1
fi

git_status=$(git status -s)
if [ -n "$git_status" ]; then
  echo "⚠️  You have uncommitted changes. Please commit or stash them before running this script."
  exit 1
fi


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

if [ $gh_ready_status -eq 0 ]; then
  echo ""
  echo "✏️  Pull request name (blank to skip):"
  read pr_title
fi

# Confirm the push operation
echo ""
echo -n "❓ Push '$new_branch' to origin? Y/N: "
read confirmation
if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
  # Continue
  echo ""
elif [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
  echo "Push cancelled."
  exit 0
else
  echo "Expected a Y/N answer."
  exit 1
fi

auto_merge="n"
if [ -n "$pr_title" ]; then
  echo -n "❓ Auto-merge pull request? Y/N: "
  read confirmation
  if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
    auto_merge="y"
  elif [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
    # Continue
    echo ""
  else
    echo "Expected a Y/N answer."
    exit 1
  fi
fi


# Push the new branch
echo ""
git push -u origin "$main_branch:$new_branch"
gh_push_status=$?
if [ $gh_push_status -eq 0 ]; then
  echo "Branch pushed to origin."
else
  echo "Failed to push branch to origin."
  git branch -u origin/$main_branch
  exit 1
fi

git branch -u "origin/$main_branch"
git reset --hard "origin/$main_branch"


if [ -n "$pr_title" ]; then
  # Create the pull request
  echo ""
  pr_url=$(gh pr create --base "$main_branch" --head "$new_branch" --title "$pr_title" --body "")
  if [ -n "$pr_url" ]; then
    echo "✅ Pull request created: $pr_url"

    if [ "$auto_merge" = "y" ]; then
      gh pr merge -m --auto "$pr_url"
    fi
  else
    echo "❌ Failed to create pull request."
  fi
fi
