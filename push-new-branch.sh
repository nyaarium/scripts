#!/bin/bash

source ~/.env

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

# Confirm the push operation
echo -n "❓ Push '$new_branch' to origin? Y/N: "
read confirmation
if [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
  echo "Push cancelled."
  exit 0
fi
if [ "$confirmation" != "y" ] && [ "$confirmation" != "Y" ]; then
  echo "Expected a Y/N answer."
  exit 1
fi

git push -u origin "$main_branch:$new_branch"
git branch -u "origin/$main_branch"
git reset --hard "origin/$main_branch"
