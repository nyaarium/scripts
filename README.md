Be sure to add this to the top of `.bashrc`

```sh
export PATH="$HOME/scripts:$PATH"
```

**GitHub** - Installing:

```sh
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list

apt update && apt install -y gh

# As user, run: gh auth login --with-token
```

Create an environment file at `.env` with:

```sh
CURSOR_AGENT_KEY=xxxxxxxx
OPENROUTER_KEY=xxxxxxxx
OPENAI_KEY=xxxxxxxx
TINYPNG_KEY=xxxxxxxx

DISCORD_CLIENT_ID=xxxxxxxx
DISCORD_SECRET_KEY=xxxxxxxx
DISCORD_INVITE_URL=xxxxxxxx

# https://console.cloud.google.com/auth/clients?authuser=1&project=nyaascripts&supportedpurview=project,folder
GOOGLE_CLIENT_ID=xxxxxxxx
GOOGLE_CLIENT_SECRET=xxxxxxxx
```
