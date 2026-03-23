#!/bin/bash


if [[ -f /.dockerenv ]]
then
	echo " ❗  You are inside a Docker container right now. Run this in WSL instead."
	exit
fi


# Configure SSH Agent

# Check .bashrc for "SSH Agent" block and remove it
EXISTS=$(grep -c "SSH Agent - Start" $HOME/.bashrc)
sed -i "/Start SSH Agent/,/End SSH Agent/d" $HOME/.bashrc
sed -i "/SSH Agent - Start/,/SSH Agent - End/d" $HOME/.bashrc

# Write the block to .bashrc
if [[ $EXISTS -eq 0 ]]; then
    echo "" >> $HOME/.bashrc
    echo "" >> $HOME/.bashrc
fi
echo "# ==== SSH Agent - Start ====" >> $HOME/.bashrc
echo "if [[ -z \"\$SSH_AUTH_SOCK\" ]]; then" >> $HOME/.bashrc
echo "    SSH_AGENT_SOCK=\"\$HOME/.ssh/agent.sock\"" >> $HOME/.bashrc
echo "    SSH_AGENT_ENV=\"\$HOME/.ssh/ssh-agent\"" >> $HOME/.bashrc
echo "" >> $HOME/.bashrc
echo "    if [[ -f \"\$SSH_AGENT_ENV\" ]]; then" >> $HOME/.bashrc
echo "        eval \$(cat \"\$SSH_AGENT_ENV\") > /dev/null" >> $HOME/.bashrc
echo "    fi" >> $HOME/.bashrc
echo "" >> $HOME/.bashrc
echo "    if ! ssh-add -l &>/dev/null; then" >> $HOME/.bashrc
echo "        # Kill stale agent and start fresh with pinned socket" >> $HOME/.bashrc
echo "        pkill ssh-agent 2>/dev/null" >> $HOME/.bashrc
echo "        rm -f \"\$SSH_AGENT_SOCK\"" >> $HOME/.bashrc
echo "        ssh-agent -a \"\$SSH_AGENT_SOCK\" -s &> \"\$SSH_AGENT_ENV\"" >> $HOME/.bashrc
echo "        eval \$(cat \"\$SSH_AGENT_ENV\") > /dev/null" >> $HOME/.bashrc
echo "    fi" >> $HOME/.bashrc
echo "" >> $HOME/.bashrc
echo "    # Add key to agent" >> $HOME/.bashrc
echo "    RESULT_ADD=\$(ssh-add 2>&1)" >> $HOME/.bashrc
echo "    if [[ \$? -ne 0 ]]; then" >> $HOME/.bashrc
echo "        echo \" ❌  Failed to add SSH key to agent\"" >> $HOME/.bashrc
echo "        echo \$RESULT_ADD" >> $HOME/.bashrc
echo "    fi" >> $HOME/.bashrc
echo "fi" >> $HOME/.bashrc
echo "# ==== SSH Agent - End ====" >> $HOME/.bashrc


echo " ⚙️   Your agent has been configured in bashrc. Please restart VSCode."


exit 0


# Original Code:

# ==== SSH Agent - Start ====
if [[ -z "$SSH_AUTH_SOCK" ]]; then
    SSH_AGENT_SOCK="$HOME/.ssh/agent.sock"
    SSH_AGENT_ENV="$HOME/.ssh/ssh-agent"

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
# ==== SSH Agent - End ====
