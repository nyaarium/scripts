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


# Upgrade packages
echo ""
echo "y" | npx npm-check-updates -u $@
npm run purge || true
npm run reinstall-rebuild || true
success=$?
if [ $success -eq 0 ]; then
  npm i
fi
git add .
git commit -m "Package updates"

# Wait for user input
echo ""
echo ""
echo "✅  Packages updated. Check that the application still works as expected."
echo "    Press enter to continue..."
read -r


while true; do
  git_status=$(git status -s)
  if [ -n "$git_status" ]; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them before continuing."
    exit 1
  else
    break
  fi
done


pr_title="Package updates"
git_push="n"
auto_merge="n"


# Configure the pull request / branch
new_branch="package-updates"


# Confirm the push operation
if [ $gh_ready_status -eq 0 ]; then
  while true; do
    echo ""
    echo -n "❓ Push '$new_branch' to origin? Y/N: "
    read confirmation
    if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
      git_push="y"
        break
    elif [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
      git_push="n"
        break
    else
      echo "Expected a Y/N answer."
    fi
  done
fi


# If git_push, confirm the auto-merge
while [ "$git_push" = "y" ]; do
  if [ -n "$pr_title" ]; then
    echo ""
    echo -n "❓ Auto-merge pull request? Y/N: "
    read confirmation
    if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
      auto_merge="y"
      break
    elif [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
      auto_merge="n"
      break
    else
      echo "Expected a Y/N answer."
    fi
  else
    break
  fi
done


# Push the new branch
if [ "$git_push" = "y" ]; then
  echo ""
  git push --force -u origin "$main_branch:$new_branch"
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
else
  git branch "$new_branch"
  git reset --hard "origin/$main_branch"
  git checkout "$new_branch"
fi


if [ "$git_push" = "y" ]; then
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
fi
