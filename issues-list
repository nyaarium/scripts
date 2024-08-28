#!/bin/bash

source ~/.env


gh issue list --limit 100 --state open --json number,title | jq -r '.[] | [.number, .title] | @tsv'
