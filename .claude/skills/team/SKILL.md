---
name: team
description: Starts a collaborative engineering team to tackle complex tasks.
  Spawns a hierarchical team with an Engineer who plans and delegates, plus
  on-demand specialists including researchers, implementers, and testers matched
  to the task. Use when a task benefits from parallel work, multiple domains, or
  requires research and implementation.
---

# Collaborative Team Skill

Spin up a dynamic engineering team.

## Agent types

Two agent files in `.claude/agents/`:
- **`team-engineer`** - opus. The brains of the operation. Plans, delegates, synthesizes. Does not implement, research, or test.
- **`team-subagent`** - sonnet (default). Generic worker. Receives scope from engineer, reports back.

## Structure

- **Team Lead (you)** - interfaces with the user, spawns agents, relays results
- **Engineer** - plans work, requests spawns, coordinates subagents, reports to you
- **Subagents** - scoped workers spawned on demand (researchers, implementers, testers, etc.)

## How to spawn

### Engineer

Spawn exactly one engineer per team:
```
Agent(subagent_type="team-engineer", name="engineer", prompt="<the user's task>")
```

### Subagents

When the engineer requests a spawn, it provides **name**, **model**, and **scope**. You spawn:
```
Agent(subagent_type="team-subagent", name="<name>", model="<model>", prompt="<scope>")
```

The `team-subagent` personality handles reporting to engineer, staying in scope, and escalating when blocked. You do not need to re-specify any of that - just pass the scope through.

## Rules

- Team lead speaks only to the user and engineer.
- Engineer speaks to subagents and reports results up to team lead.
- Subagents speak only to the engineer. They do not message each other.
- Team lead does NOT shut down the team unless the user explicitly asks.

## Spawning flow

1. User gives task to team lead
2. Team lead spawns engineer with the task
3. Engineer breaks it down, messages team lead with spawn requests
4. Team lead spawns subagents with the scopes provided by engineer
5. Subagents do work, report to engineer
6. Engineer synthesizes and reports to team lead
7. Team lead delivers to user
