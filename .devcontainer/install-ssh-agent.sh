#!/bin/bash

set -e


if [[ -f /.dockerenv ]]; then
    echo " ❗  You are inside a Docker container right now. Run this in WSL instead."
    exit 1
fi


# Remove any existing SSH Agent block (both legacy marker styles)
sed -i "/Start SSH Agent/,/End SSH Agent/d" "$HOME/.bashrc"
sed -i "/SSH Agent - Start/,/SSH Agent - End/d" "$HOME/.bashrc"


# Append the current block
cat >> "$HOME/.bashrc" <<'BASHRC_EOF'


# ==== SSH Agent - Start ====
SSH_AGENT_SOCK="/tmp/ssh-agent-$(id -u).sock"
SSH_AGENT_ENV="$HOME/.ssh/ssh-agent"

# Prefer GPG agent if available and has keys
GPG_SSH_SOCK=""
if command -v gpgconf >/dev/null 2>&1; then
    GPG_SSH_SOCK=$(gpgconf --list-dirs agent-ssh-socket 2>/dev/null)
fi
if [[ -z "$GPG_SSH_SOCK" ]]; then
    GPG_SSH_SOCK="/run/user/$(id -u)/gnupg/S.gpg-agent.ssh"
fi

USE_GPG=0
if [[ -S "$GPG_SSH_SOCK" ]] && SSH_AUTH_SOCK="$GPG_SSH_SOCK" ssh-add -l &>/dev/null; then
    USE_GPG=1
fi

if [[ $USE_GPG -eq 1 ]]; then
    export SSH_AUTH_SOCK="$GPG_SSH_SOCK"
else
    # Classic ssh-agent fallback
    if [[ -f "$SSH_AGENT_ENV" ]]; then
        eval $(cat "$SSH_AGENT_ENV") > /dev/null
    fi

    if ! ssh-add -l &>/dev/null; then
        # Kill stale agent and start fresh with pinned socket
        pkill ssh-agent 2>/dev/null
        rm -f "$SSH_AGENT_SOCK"
        ssh-agent -a "$SSH_AGENT_SOCK" -s &> "$SSH_AGENT_ENV"
        eval $(cat "$SSH_AGENT_ENV") > /dev/null
    fi

    # Add key to agent
    RESULT_ADD=$(ssh-add 2>&1)
    if [[ $? -ne 0 ]]; then
        echo " ❌  Failed to add SSH key to agent"
        echo $RESULT_ADD
    fi
fi

if [[ -n "$SSH_AUTH_SOCK" ]]; then
    export HOST_SSH_AUTH_SOCK="$SSH_AUTH_SOCK"
fi
# ==== SSH Agent - End ====
BASHRC_EOF


echo " ⚙️   Your agent has been configured in bashrc. Please restart VSCode."


exit 0
