Be sure to add this to the top of `.bashrc`

```sh
export PATH="$HOME/scripts:$PATH"
```

**GitHub** - Installing:

```sh
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | gpg --dearmor -o /etc/apt/keyrings/githubcli-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list

apt update && apt install -y gh

# As user, run: gh auth login
```

**ChatGPT** - Create an environment file at `~/.env` with:

```sh
OPENAI_KEY=sk-xxxxxxxx
```
