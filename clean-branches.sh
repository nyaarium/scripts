#!/bin/bash

source ~/.env

set -e


git fetch --prune

for branch in $(git branch --merged | grep -v "^\*"); do
	git branch -d "$branch"
done
