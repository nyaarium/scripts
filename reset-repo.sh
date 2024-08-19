#!/bin/bash

source ~/.env

set -e


# Script to reset the repo to origin/main. This will destroy all unpushed branches and stashes.

repo_url=$(git remote get-url origin  2>/dev/null || echo "")
is_repo_initialized=$([ -n "$repo_url" ] && echo "true" || echo "false")


# If url exists, set it to "git@$url"
if [ -n "$repo_url" ]; then
	# if begins in "github.com:"
	if echo "$repo_url" | grep -qE "^github\.com:"; then
		repo_url="git@$repo_url"
	fi
fi


# Confirm the reset operation
while true; do
	echo ""
	echo "❓ Resetting the repo will DESTROY all unpushed branches and stashes."
	echo "   Currently modified files will be left untouched."
	echo "       Dir: $PWD"
	if [ "$is_repo_initialized" = "true" ]; then
		echo "       URL: $repo_url"
	fi
	echo -n "   Continue? Y/N: "
	read confirmation
	echo ""
	if [ "$confirmation" = "y" ] || [ "$confirmation" = "Y" ]; then
		break
	elif [ "$confirmation" = "n" ] || [ "$confirmation" = "N" ]; then
		exit 0
	else
		echo "❌ Expected a Y/N answer."
	fi
done


if [ "$is_repo_initialized" = "true" ]; then
	rm -rf .git
else
	# Get the repo URL
	while true; do
		echo ""
		echo "🔗 Enter the repo URL. It should look something like:"
		echo "     git@github.com:your-name/repo-name.git"
		echo -n "   Enter the git URL: "
		read repo_url
		echo ""

		# if begins in "github.com:"
		if echo "$repo_url" | grep -qE "^github\.com:"; then
			repo_url="git@$repo_url"
		fi

		if [ -z "$repo_url" ]; then
			echo "❌ Expected a URL."
		elif ! echo "$repo_url" | grep -qE "^git@github.com:"; then
			echo "❌ Expected a URL that begins with 'git@github.com:'"
		elif ! echo "$repo_url" | grep -qE "\.git$"; then
			echo "❌ Expected a URL that ends with '.git'"
		else
			break
		fi
	done
fi

git init
git remote add origin "$repo_url"
git fetch

main_origin=$(git branch -r | grep -E "^\s*origin/(main|master)$")
main_branch=$(basename "$main_origin")

git checkout -B $main_branch
git reset --soft origin/main
git branch --set-upstream-to=origin/$main_branch
git reset -q
git status -s
